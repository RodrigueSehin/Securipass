-- Lot 3 — espace apprenant : progression, notifications, présences, évaluations.
-- Toute écriture passe par des fonctions SQL contrôlées ou par des déclencheurs ; la RLS reste la barrière réelle.

-- ---------- Helpers ----------
create or replace function public.content_course(_content uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select m.course_id from public.learning_contents c
  join public.course_modules m on m.id = c.module_id where c.id = _content;
$$;

-- plpgsql : la table evaluations n'existe pas encore à ce stade (corps SQL validé à la création)
create or replace function public.evaluation_course(_evaluation uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  return (select course_id from public.evaluations where id = _evaluation);
end $$;

-- Un apprenant accède à une évaluation publiée de sa formation (et de sa session si elle en a une).
create or replace function public.can_take_evaluation(_evaluation uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.evaluations e
    where e.id = _evaluation and e.status = 'published'
      and public.has_course_access(e.course_id)
      and (e.session_id is null or public.is_enrolled_in_session(e.session_id)));
end $$;

-- ---------- Progression ----------
create table public.content_completions (
  learner_id uuid not null references public.profiles(id) on delete cascade,
  content_id uuid not null references public.learning_contents(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (learner_id, content_id)
);
alter table public.content_completions enable row level security;
create policy completions_read on public.content_completions for select
  using (learner_id = auth.uid() or public.is_staff() or public.owns_course(public.content_course(content_id)));

create or replace function public.set_content_completed(p_content uuid, p_done boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare c public.learning_contents%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into c from public.learning_contents where id = p_content;
  if not found or c.status <> 'published' or not public.can_read_module(c.module_id) then
    raise exception 'content_not_available';
  end if;
  if not public.has_course_access(public.content_course(p_content)) then raise exception 'not_enrolled'; end if;
  if p_done then
    insert into public.content_completions (learner_id, content_id) values (auth.uid(), p_content)
      on conflict do nothing;
  else
    delete from public.content_completions where learner_id = auth.uid() and content_id = p_content;
  end if;
  return p_done;
end $$;

-- ---------- Notifications (dans l'application) ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in (
    'enrollment_confirmed','enrollment_waitlisted','waitlist_promoted',
    'session_changed','session_cancelled','evaluation_available','evaluation_result')),
  title text not null,
  body text,
  link text check (link is null or link ~ '^/'),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on public.notifications (recipient_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select using (recipient_id = auth.uid());
-- Le destinataire peut marquer une notification comme lue, rien d'autre : un déclencheur refuse toute autre modification
-- (un revoke de colonne ne suffit pas, les droits par table sont accordés par défaut sur Supabase).
create policy notifications_mark_read on public.notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create or replace function public.notifications_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id is distinct from old.id or new.recipient_id is distinct from old.recipient_id
     or new.kind is distinct from old.kind or new.title is distinct from old.title
     or new.body is distinct from old.body or new.link is distinct from old.link
     or new.created_at is distinct from old.created_at then
    raise exception 'notification_read_only' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger notifications_guard_trg before update on public.notifications
  for each row execute function public.notifications_guard();

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.notifications set read_at = now()
    where recipient_id = auth.uid() and read_at is null
      and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public._notify(_recipient uuid, _kind text, _title text, _body text, _link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (recipient_id, kind, title, body, link)
  values (_recipient, _kind, _title, _body, _link);
$$;

create or replace function public.notify_enrollment()
returns trigger language plpgsql security definer set search_path = public as $$
declare ctitle text;
begin
  select title into ctitle from public.courses where id = new.course_id;
  if tg_op = 'INSERT' and new.status = 'confirmed' then
    perform public._notify(new.learner_id, 'enrollment_confirmed', 'Inscription confirmée',
      ctitle, '/app/inscriptions');
  elsif tg_op = 'INSERT' and new.status = 'waitlisted' then
    perform public._notify(new.learner_id, 'enrollment_waitlisted', 'Vous êtes en liste d’attente',
      ctitle, '/app/inscriptions');
  elsif tg_op = 'UPDATE' and old.status = 'waitlisted' and new.status = 'confirmed' then
    perform public._notify(new.learner_id, 'waitlist_promoted', 'Une place s’est libérée',
      ctitle, '/app/inscriptions');
  end if;
  return new;
end $$;
create trigger enrollments_notify after insert or update of status on public.enrollments
  for each row execute function public.notify_enrollment();

create or replace function public.notify_session_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare ctitle text; r record;
begin
  if new.status = old.status and new.start_at = old.start_at and new.end_at = old.end_at
     and new.location is not distinct from old.location and new.delivery_mode = old.delivery_mode
     and new.timezone = old.timezone then
    return new;
  end if;
  if new.status not in ('scheduled','cancelled') then return new; end if;
  select title into ctitle from public.courses where id = new.course_id;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    -- sessions_guard annule les inscriptions dans la même transaction : on notifie celles-là (cancelled_at = now())
    for r in select learner_id from public.enrollments where session_id = new.id and cancelled_at = now() loop
      perform public._notify(r.learner_id, 'session_cancelled', 'Session annulée', ctitle, '/app/inscriptions');
    end loop;
  else
    for r in select learner_id from public.enrollments
             where session_id = new.id and status in ('confirmed','completed','suspended') loop
      perform public._notify(r.learner_id, 'session_changed', 'Session modifiée',
        ctitle || ' — ' || new.title, '/app/inscriptions');
    end loop;
  end if;
  return new;
end $$;
create trigger sessions_notify after update on public.sessions
  for each row execute function public.notify_session_change();

-- ---------- Présences ----------
-- Saisie par le formateur de la session (Lot 4) ; l'apprenant ne fait que consulter les siennes.
create table public.attendance_records (
  session_id uuid not null references public.sessions(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('present','absent','late','excused')),
  justification text check (char_length(justification) <= 500),
  recorded_by uuid references public.profiles(id),
  recorded_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (session_id, learner_id)
);
create index on public.attendance_records (learner_id);
alter table public.attendance_records enable row level security;
create policy attendance_read on public.attendance_records for select
  using (learner_id = auth.uid() or public.is_pedagogy_staff() or public.is_staff()
         or exists (select 1 from public.sessions s where s.id = session_id and s.instructor_id = auth.uid()));
create policy attendance_write on public.attendance_records for all
  using (public.is_pedagogy_staff() or exists (select 1 from public.sessions s where s.id = session_id and s.instructor_id = auth.uid()))
  with check (public.is_pedagogy_staff() or exists (select 1 from public.sessions s where s.id = session_id and s.instructor_id = auth.uid()));

create or replace function public.attendance_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.enrollments e
    where e.session_id = new.session_id and e.learner_id = new.learner_id and e.status in ('confirmed','completed','suspended')) then
    raise exception 'learner_not_in_session';
  end if;
  if tg_op = 'INSERT' then
    new.recorded_by := auth.uid(); new.recorded_at := now();
  end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;
create trigger attendance_guard_trg before insert or update on public.attendance_records
  for each row execute function public.attendance_guard();

-- ---------- Évaluations ----------
-- Créées par le formateur ou le personnel (Lot 4). Les réponses correctes vivent dans une table réservée au personnel.
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  instructions text,
  time_limit_minutes integer check (time_limit_minutes is null or time_limit_minutes > 0),
  max_attempts integer not null default 1 check (max_attempts between 1 and 10),
  passing_score integer not null default 70 check (passing_score between 0 and 100),
  due_at timestamptz,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.evaluations (course_id, status);
create trigger evaluations_touch before update on public.evaluations
  for each row execute function public.touch_updated_at();
alter table public.evaluations enable row level security;
create policy evaluations_read on public.evaluations for select
  using (public.owns_course(course_id) or public.is_staff() or public.can_take_evaluation(id));
create policy evaluations_write on public.evaluations for all
  using (public.owns_course(course_id) or public.is_pedagogy_staff())
  with check (public.owns_course(course_id) or public.is_pedagogy_staff());

create table public.evaluation_questions (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  position integer not null default 0,
  prompt text not null check (char_length(prompt) between 2 and 1000),
  kind text not null default 'single' check (kind in ('single','multiple')),
  -- [{ "id": "a", "label": "..." }, ...] : jamais de bonne réponse ici
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10),
  points integer not null default 1 check (points > 0)
);
create index on public.evaluation_questions (evaluation_id, position);
alter table public.evaluation_questions enable row level security;
create policy questions_read on public.evaluation_questions for select
  using (public.owns_course(public.evaluation_course(evaluation_id)) or public.is_staff()
         or public.can_take_evaluation(evaluation_id));
create policy questions_write on public.evaluation_questions for all
  using (public.owns_course(public.evaluation_course(evaluation_id)) or public.is_pedagogy_staff())
  with check (public.owns_course(public.evaluation_course(evaluation_id)) or public.is_pedagogy_staff());

create table public.evaluation_answer_keys (
  question_id uuid primary key references public.evaluation_questions(id) on delete cascade,
  correct_option_ids text[] not null check (cardinality(correct_option_ids) > 0)
);
alter table public.evaluation_answer_keys enable row level security;
create policy answer_keys_staff on public.evaluation_answer_keys for all
  using (exists (select 1 from public.evaluation_questions q
           where q.id = question_id and (public.owns_course(public.evaluation_course(q.evaluation_id)) or public.is_pedagogy_staff())))
  with check (exists (select 1 from public.evaluation_questions q
           where q.id = question_id and (public.owns_course(public.evaluation_course(q.evaluation_id)) or public.is_pedagogy_staff())));

create table public.evaluation_attempts (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  submitted_at timestamptz,
  answers jsonb,
  score_percent integer check (score_percent is null or score_percent between 0 and 100),
  passed boolean
);
create index on public.evaluation_attempts (evaluation_id, learner_id);
-- Une seule tentative en cours à la fois
create unique index evaluation_attempts_one_open on public.evaluation_attempts (evaluation_id, learner_id)
  where submitted_at is null;
alter table public.evaluation_attempts enable row level security;
create policy attempts_read on public.evaluation_attempts for select
  using (learner_id = auth.uid() or public.owns_course(public.evaluation_course(evaluation_id)) or public.is_staff());

create or replace function public.notify_evaluation_published()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status = 'published' and old.status <> 'published' then
    for r in select learner_id from public.enrollments
             where course_id = new.course_id and status in ('confirmed','completed')
               and (new.session_id is null or session_id = new.session_id) loop
      perform public._notify(r.learner_id, 'evaluation_available', 'Évaluation à passer', new.title, '/app/evaluations');
    end loop;
  end if;
  return new;
end $$;
create trigger evaluations_notify after update of status on public.evaluations
  for each row execute function public.notify_evaluation_published();

-- Démarre une tentative (ou reprend celle en cours). Refuse si la limite de tentatives ou l'échéance est atteinte.
create or replace function public.start_evaluation(p_evaluation uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare e public.evaluations%rowtype; open_id uuid; open_deadline timestamptz; used integer; dl timestamptz; aid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into e from public.evaluations where id = p_evaluation;
  if not found or not public.can_take_evaluation(p_evaluation) then raise exception 'evaluation_not_available'; end if;

  select id, deadline_at into open_id, open_deadline from public.evaluation_attempts
    where evaluation_id = p_evaluation and learner_id = auth.uid() and submitted_at is null;
  if open_id is not null then
    if open_deadline is null or open_deadline > now() then return open_id; end if;
    -- Tentative expirée : elle est close sans réponse
    update public.evaluation_attempts set submitted_at = now(), score_percent = 0, passed = false
      where id = open_id;
  end if;

  if e.due_at is not null and e.due_at <= now() then raise exception 'evaluation_closed'; end if;
  select count(*) into used from public.evaluation_attempts
    where evaluation_id = p_evaluation and learner_id = auth.uid();
  if used >= e.max_attempts then raise exception 'no_attempt_left'; end if;

  dl := case when e.time_limit_minutes is null then e.due_at
             when e.due_at is null then now() + make_interval(mins => e.time_limit_minutes)
             else least(e.due_at, now() + make_interval(mins => e.time_limit_minutes)) end;
  insert into public.evaluation_attempts (evaluation_id, learner_id, deadline_at)
    values (p_evaluation, auth.uid(), dl) returning id into aid;
  return aid;
end $$;

-- Corrige et enregistre une tentative. p_answers : { "<question_id>": ["<option_id>", ...] }.
-- Notation : une question est juste si l'ensemble des options cochées est exactement celui attendu.
create or replace function public.submit_evaluation(p_attempt uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.evaluation_attempts%rowtype; e public.evaluations%rowtype; q record;
  earned integer := 0; total integer := 0; pct integer; ok boolean; chosen text[]; expected text[];
  answers_out jsonb := '{}'::jsonb; expired boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into a from public.evaluation_attempts where id = p_attempt for update;
  if not found or a.learner_id <> auth.uid() then raise exception 'attempt_not_found'; end if;
  if a.submitted_at is not null then raise exception 'attempt_already_submitted'; end if;
  select * into e from public.evaluations where id = a.evaluation_id;

  expired := a.deadline_at is not null and a.deadline_at < now();
  if expired then
    update public.evaluation_attempts set submitted_at = now(), score_percent = 0, passed = false where id = a.id;
    return jsonb_build_object('status', 'expired');
  end if;

  for q in select qu.id, qu.points, k.correct_option_ids
           from public.evaluation_questions qu
           join public.evaluation_answer_keys k on k.question_id = qu.id
           where qu.evaluation_id = e.id loop
    total := total + q.points;
    chosen := array(select jsonb_array_elements_text(coalesce(p_answers -> q.id::text, '[]'::jsonb)));
    expected := q.correct_option_ids;
    ok := (select array_agg(x order by x) from unnest(chosen) x) is not distinct from
          (select array_agg(x order by x) from unnest(expected) x);
    if ok then earned := earned + q.points; end if;
    answers_out := answers_out || jsonb_build_object(q.id::text, to_jsonb(chosen));
  end loop;

  pct := case when total = 0 then 0 else round(earned * 100.0 / total)::integer end;
  update public.evaluation_attempts
    set submitted_at = now(), answers = answers_out, score_percent = pct, passed = pct >= e.passing_score
    where id = a.id;
  perform public._notify(a.learner_id, 'evaluation_result', 'Résultat publié', e.title, '/app/evaluations');
  return jsonb_build_object('status', 'graded', 'score_percent', pct, 'passed', pct >= e.passing_score);
end $$;

-- ---------- Droits d'exécution ----------
revoke execute on function public.set_content_completed(uuid, boolean) from public, anon;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
revoke execute on function public.start_evaluation(uuid) from public, anon;
revoke execute on function public.submit_evaluation(uuid, jsonb) from public, anon;
revoke execute on function public._notify(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.set_content_completed(uuid, boolean) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.start_evaluation(uuid) to authenticated;
grant execute on function public.submit_evaluation(uuid, jsonb) to authenticated;

-- ---------- Fichiers : un inscrit peut lire les fichiers de ses formations ----------
create policy course_files_enrolled_read on storage.objects for select
  using (bucket_id = 'course-files' and exists (
    select 1 from public.learning_contents c
    join public.course_modules m on m.id = c.module_id
    where c.file_path = storage.objects.name and c.status = 'published'
      and public.has_course_access(m.course_id)));
