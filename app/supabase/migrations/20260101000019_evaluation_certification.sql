-- Lot 4 : évaluation et certification d'une formation (étape 3 de l'assistant de création).
--  - réglages d'évaluation de la formation : activation, types, note minimale de réussite, échelle et arrondi des notes,
--    tentatives par défaut, affichage des résultats, rattrapage ;
--  - activités d'évaluation : type, pondération, notation par le formateur pour les activités qui ne sont pas des quiz ;
--  - réglages du certificat : activation, intitulé, description, éléments imprimés.

alter table public.courses
  add column evaluation_enabled boolean not null default true,
  add column evaluation_types text[] not null default '{}'
    check (evaluation_types <@ array['quiz','assignment','case_study','practical']::text[]),
  add column pass_mark_percent integer not null default 70 check (pass_mark_percent between 0 and 100),
  add column grading_scale integer not null default 20 check (grading_scale in (10, 20, 100)),
  add column grade_rounding text not null default 'none' check (grade_rounding in ('none','nearest','up','down')),
  add column default_attempts integer not null default 1 check (default_attempts between 1 and 10),
  add column show_results boolean not null default true,
  add column allow_retake boolean not null default false,
  add column certificate_enabled boolean not null default true,
  add column certificate_title text check (certificate_title is null or char_length(certificate_title) between 1 and 200),
  add column certificate_description text check (certificate_description is null or char_length(certificate_description) between 1 and 500),
  add column certificate_display text[] not null
    default array['holder_name','course_title','issue_date','qr','trainer_signature','issuer_signature','number']
    check (certificate_display <@ array['holder_name','course_title','issue_date','qr','trainer_signature','issuer_signature','number']::text[]);

alter table public.evaluations
  add column kind text not null default 'quiz' check (kind in ('quiz','assignment','case_study','practical')),
  add column weight_percent integer not null default 0 check (weight_percent between 0 and 100);

-- Notes saisies par le formateur pour les activités qui ne sont pas des quiz (devoir, étude de cas, évaluation pratique).
create table public.evaluation_grades (
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  score_percent integer not null check (score_percent between 0 and 100),
  feedback text check (feedback is null or char_length(feedback) between 1 and 1000),
  graded_by uuid references public.profiles(id),
  graded_at timestamptz not null default now(),
  primary key (evaluation_id, learner_id)
);
alter table public.evaluation_grades enable row level security;

create policy grades_read on public.evaluation_grades for select
  using (learner_id = auth.uid() or public.owns_course(public.evaluation_course(evaluation_id)) or public.is_staff());
-- Le formateur de la formation (ou le personnel pédagogique) note un apprenant inscrit, pour une activité non-quiz.
create policy grades_write on public.evaluation_grades for all
  using (public.owns_course(public.evaluation_course(evaluation_id)) or public.is_pedagogy_staff())
  with check (
    (public.owns_course(public.evaluation_course(evaluation_id)) or public.is_pedagogy_staff())
    and exists (select 1 from public.evaluations ev where ev.id = evaluation_id and ev.kind <> 'quiz')
    and exists (select 1 from public.enrollments en
                where en.learner_id = evaluation_grades.learner_id and en.course_id = public.evaluation_course(evaluation_id)
                  and en.status in ('confirmed','completed')));

create or replace function public.stamp_evaluation_grade()
returns trigger language plpgsql security definer set search_path = public as $$
declare etitle text;
begin
  new.graded_by := coalesce(auth.uid(), new.graded_by);
  new.graded_at := now();
  select title into etitle from public.evaluations where id = new.evaluation_id;
  perform public._notify(new.learner_id, 'evaluation_result', 'Note publiée', etitle, '/app/evaluations');
  return new;
end $$;
create trigger evaluation_grades_stamp before insert or update on public.evaluation_grades
  for each row execute function public.stamp_evaluation_grade();

-- Visibilité d'une évaluation (métadonnées) : l'évaluation doit être activée pour la formation.
create or replace function public.learner_sees_evaluation(_evaluation uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.evaluations e
    join public.courses c on c.id = e.course_id
    where e.id = _evaluation and e.status = 'published' and c.evaluation_enabled
      and public.has_course_access(e.course_id)
      and (e.session_id is null or public.is_enrolled_in_session(e.session_id)));
end $$;

-- Passage (questions, tentatives) : uniquement pour les quiz, une fois ouverts.
create or replace function public.can_take_evaluation(_evaluation uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.evaluations e
    where e.id = _evaluation and e.kind = 'quiz'
      and public.learner_sees_evaluation(e.id)
      and (e.available_at is null or e.available_at <= now()));
end $$;

-- Rattrapage : une tentative supplémentaire quand la formation l'autorise.
create or replace function public.start_evaluation(p_evaluation uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare e public.evaluations%rowtype; open_id uuid; open_deadline timestamptz; used integer; dl timestamptz; aid uuid; extra integer;
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
  select case when allow_retake then 1 else 0 end into extra from public.courses where id = e.course_id;
  select count(*) into used from public.evaluation_attempts
    where evaluation_id = p_evaluation and learner_id = auth.uid();
  if used >= e.max_attempts + coalesce(extra, 0) then raise exception 'no_attempt_left'; end if;

  dl := case when e.time_limit_minutes is null then e.due_at
             when e.due_at is null then now() + make_interval(mins => e.time_limit_minutes)
             else least(e.due_at, now() + make_interval(mins => e.time_limit_minutes)) end;
  insert into public.evaluation_attempts (evaluation_id, learner_id, deadline_at)
    values (p_evaluation, auth.uid(), dl) returning id into aid;
  return aid;
end $$;

-- Éligibilité au certificat : ajoute l'activation du certificat, les activités notées par le formateur
-- et la note minimale de réussite (moyenne pondérée des activités pondérées).
create or replace function public.certificate_eligibility(p_enrollment uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.enrollments%rowtype; s public.sessions%rowtype; c public.courses%rowtype;
  missing_contents integer; failed_evaluations integer; present_count integer; recorded_count integer;
  total_weight integer; weighted numeric;
  reasons text[] := '{}';
  min_presence constant numeric := 0.8;
begin
  select * into e from public.enrollments where id = p_enrollment;
  if not found then raise exception 'enrollment_not_found'; end if;
  if not public._can_manage_course(e.course_id) and e.learner_id <> auth.uid() then raise exception 'forbidden'; end if;
  select * into c from public.courses where id = e.course_id;

  if not c.certificate_enabled then reasons := array_append(reasons, 'certificates_disabled'); end if;
  if e.status not in ('confirmed','completed') then reasons := array_append(reasons, 'enrollment_not_active'); end if;

  select count(*) into missing_contents from public.learning_contents lc
    join public.course_modules m on m.id = lc.module_id
    where m.course_id = e.course_id and lc.status = 'published'
      and not exists (select 1 from public.content_completions cc where cc.content_id = lc.id and cc.learner_id = e.learner_id);
  if missing_contents > 0 then reasons := array_append(reasons, 'contents_incomplete'); end if;

  if c.evaluation_enabled then
    select count(*) into failed_evaluations from public.evaluations ev
      where ev.course_id = e.course_id and ev.status = 'published'
        and (ev.session_id is null or ev.session_id = e.session_id)
        and not (case when ev.kind = 'quiz'
              then exists (select 1 from public.evaluation_attempts a
                           where a.evaluation_id = ev.id and a.learner_id = e.learner_id and a.passed)
              else exists (select 1 from public.evaluation_grades g
                           where g.evaluation_id = ev.id and g.learner_id = e.learner_id and g.score_percent >= ev.passing_score) end);
    if failed_evaluations > 0 then reasons := array_append(reasons, 'evaluations_not_passed'); end if;

    -- Note finale : moyenne des meilleures notes, pondérée ; une activité sans note compte pour zéro.
    select coalesce(sum(ev.weight_percent), 0),
           coalesce(sum(ev.weight_percent * coalesce(
             case when ev.kind = 'quiz'
               then (select max(a.score_percent) from public.evaluation_attempts a
                     where a.evaluation_id = ev.id and a.learner_id = e.learner_id and a.submitted_at is not null)
               else (select g.score_percent from public.evaluation_grades g
                     where g.evaluation_id = ev.id and g.learner_id = e.learner_id) end, 0)), 0)
      into total_weight, weighted
      from public.evaluations ev
      where ev.course_id = e.course_id and ev.status = 'published' and ev.weight_percent > 0
        and (ev.session_id is null or ev.session_id = e.session_id);
    if total_weight > 0 and weighted / total_weight < c.pass_mark_percent then
      reasons := array_append(reasons, 'pass_mark_not_reached');
    end if;
  end if;

  if e.session_id is not null then
    select * into s from public.sessions where id = e.session_id;
    select count(*) filter (where status in ('present','late','excused')), count(*)
      into present_count, recorded_count
      from public.attendance_records where session_id = e.session_id and learner_id = e.learner_id;
    if recorded_count = 0 then
      if s.end_at < now() then reasons := array_append(reasons, 'attendance_not_recorded'); end if;
    elsif present_count::numeric / recorded_count < min_presence then
      reasons := array_append(reasons, 'attendance_insufficient');
    end if;
  end if;

  return jsonb_build_object('eligible', cardinality(reasons) = 0, 'reasons', to_jsonb(reasons));
end $$;

-- Émission : l'intitulé et la description de la formation servent de valeurs par défaut, et les éléments à imprimer
-- sont figés avec le certificat.
create or replace function public._issue_certificate(_id uuid, _enrollment uuid, _template uuid, _params jsonb, _actor uuid, _replaces uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e public.enrollments%rowtype; c public.courses%rowtype; s public.sessions%rowtype; t public.certificate_templates%rowtype;
  p public.profiles%rowtype; num text; tok text; vars jsonb; valid_until timestamptz; body text; title text;
  rendered_title text;
begin
  select * into e from public.enrollments where id = _enrollment;
  select * into c from public.courses where id = e.course_id;
  select * into p from public.profiles where id = e.learner_id;
  if _template is null then raise exception 'template_required'; end if;
  select * into t from public.certificate_templates where id = _template;
  if not found or t.status <> 'published' then raise exception 'template_not_available'; end if;

  if not (public.certificate_eligibility(_enrollment) ->> 'eligible')::boolean then
    raise exception 'not_eligible';
  end if;

  if _params ->> 'validity_months' is not null then
    valid_until := now() + make_interval(months => least(greatest((_params ->> 'validity_months')::int, 1), 120));
  end if;

  num := 'SP-' || to_char(now() at time zone 'Africa/Abidjan', 'YYYY') || '-' || lpad(nextval('public.certificate_number_seq')::text, 6, '0');
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  if e.session_id is not null then select * into s from public.sessions where id = e.session_id; end if;
  vars := jsonb_build_object(
    'apprenant', coalesce(nullif(p.full_name, ''), 'l’apprenant'),
    'formation', c.title,
    'session', case when s.id is null then 'accès libre' else 'session du ' || to_char(s.start_at at time zone 'Africa/Abidjan', 'DD/MM/YYYY') end,
    'date', to_char(now() at time zone 'Africa/Abidjan', 'DD/MM/YYYY'),
    'numero', num,
    'validite', case when valid_until is null then 'sans limite de validité' else 'valable jusqu’au ' || to_char(valid_until at time zone 'Africa/Abidjan', 'DD/MM/YYYY') end
  );
  title := left(coalesce(nullif(_params ->> 'title', ''), nullif(c.certificate_title, ''), t.title), 200);
  rendered_title := public._render_text(title, vars);
  body := public._render_text(left(coalesce(nullif(_params ->> 'body', ''), nullif(c.certificate_description, ''), t.body), 2000), vars);

  insert into public.certificates (id, certificate_number, verification_token, enrollment_id, learner_id, course_id, session_id,
    template_id, content, issued_by, issued_at, valid_until, pdf_path, replaces_id)
  values (coalesce(_id, gen_random_uuid()), num, tok, e.id, e.learner_id, e.course_id, e.session_id, t.id,
    jsonb_build_object(
      'holder_name', coalesce(nullif(p.full_name, ''), ''),
      'course_title', c.title,
      'session_title', coalesce(s.title, ''),
      'session_start', s.start_at,
      'layout', t.layout,
      'title', rendered_title,
      'body', body,
      'signatory_name', left(coalesce(_params ->> 'signatory_name', ''), 120),
      'signatory_role', left(coalesce(_params ->> 'signatory_role', ''), 120),
      'issuer', 'SECURIPASS',
      'issued_on', vars ->> 'date',
      'validity', vars ->> 'validite',
      'display', to_jsonb(c.certificate_display)),
    _actor, now(), valid_until, null, _replaces)
  returning id into _id;

  update public.certificates set pdf_path = id::text || '.pdf' where id = _id;
  insert into public.certificate_events (certificate_id, event_type, actor_id, metadata)
    values (_id, 'issued', _actor, jsonb_build_object('template', t.id, 'number', num));
  return jsonb_build_object('id', _id, 'certificate_number', num, 'verification_token', tok);
end $$;
