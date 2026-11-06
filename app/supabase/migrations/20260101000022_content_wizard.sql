-- Lot 4 : assistant « Ajouter un contenu pédagogique » (4 étapes).
--  - nouveaux types de contenu : document, étude de cas, quiz (lié à une activité d'évaluation) ;
--  - paramètres pédagogiques : niveau requis, prérequis, contenu obligatoire, progression, téléchargement, commentaires,
--    sommaire, visibilité, date de publication et période de disponibilité, notification des apprenants ;
--  - fichiers et liens complémentaires.

-- Un brouillon peut être créé avant d'avoir son fichier : le fichier ou le lien est exigé à la publication (déclencheur ci-dessous).
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.learning_contents'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%file_path IS NOT NULL%'
  loop
    execute format('alter table public.learning_contents drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.learning_contents drop constraint learning_contents_content_type_check;
alter table public.learning_contents add constraint learning_contents_content_type_check
  check (content_type in ('video','pdf','presentation','link','text','practice','document','case_study','quiz'));

alter table public.learning_contents
  add column required_level text not null default 'beginner' check (required_level in ('beginner','intermediate','advanced')),
  add column prerequisite_content_id uuid references public.learning_contents(id) on delete set null,
  add column is_required boolean not null default true,
  add column counts_in_progress boolean not null default true,
  add column allow_download boolean not null default true,
  add column allow_comments boolean not null default true,
  add column show_in_outline boolean not null default true,
  add column is_visible boolean not null default true,
  add column notify_learners boolean not null default false,
  add column publish_at timestamptz,
  add column available_until timestamptz,
  add column evaluation_id uuid references public.evaluations(id) on delete set null;
alter table public.learning_contents add constraint learning_contents_not_own_prerequisite check (prerequisite_content_id is null or prerequisite_content_id <> id);
alter table public.learning_contents add constraint learning_contents_window check (available_until is null or publish_at is null or available_until > publish_at);

-- Visibilité d'un contenu : publié, non masqué, date de publication atteinte et période de disponibilité non échue.
create or replace function public.content_visible(_status text, _visible boolean, _publish_at timestamptz, _until timestamptz)
returns boolean language sql stable as $$
  select _status = 'published' and _visible and (_publish_at is null or _publish_at <= now()) and (_until is null or _until > now());
$$;

create or replace function public.content_module(_content uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select module_id from public.learning_contents where id = _content;
$$;

-- Publication : le contenu doit avoir de quoi être affiché.
create or replace function public.learning_contents_publish_guard()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' then
    if new.content_type in ('video','pdf','presentation','document','link') and new.file_path is null and new.external_url is null then
      raise exception 'content_media_required' using errcode = '23514';
    end if;
    if new.content_type = 'quiz' and new.evaluation_id is null then
      raise exception 'content_quiz_required' using errcode = '23514';
    end if;
    if new.content_type in ('case_study','practice') and coalesce(nullif(btrim(new.description), ''), nullif(btrim(new.body), '')) is null then
      raise exception 'content_text_required' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger learning_contents_publish_guard_trg before insert or update on public.learning_contents
  for each row execute function public.learning_contents_publish_guard();

-- Lecture des contenus : les inscrits ne voient que les contenus visibles.
drop policy contents_read on public.learning_contents;
create policy contents_read on public.learning_contents for select
  using (public.owns_module(module_id) or public.is_staff()
         or (public.content_visible(status, is_visible, publish_at, available_until) and public.can_read_module(module_id)));

drop policy course_files_enrolled_read on storage.objects;
create policy course_files_enrolled_read on storage.objects for select
  using (bucket_id = 'course-files' and exists (
    select 1 from public.learning_contents c
    join public.course_modules m on m.id = c.module_id
    where c.file_path = storage.objects.name
      and public.content_visible(c.status, c.is_visible, c.publish_at, c.available_until)
      and public.has_course_access(m.course_id)));

-- ---------- Fichiers et liens complémentaires d'un contenu ----------
create table public.content_attachments (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.learning_contents(id) on delete cascade,
  kind text not null check (kind in ('file','link')),
  name text not null check (char_length(name) between 1 and 200),
  file_path text,
  url text check (url is null or url ~ '^https://'),
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  mime_type text,
  created_at timestamptz not null default now(),
  check ((kind = 'file' and file_path is not null) or (kind = 'link' and url is not null))
);
create index on public.content_attachments (content_id);
alter table public.content_attachments enable row level security;

create policy content_attachments_read on public.content_attachments for select
  using (public.owns_module(public.content_module(content_id)) or public.is_staff()
         or exists (select 1 from public.learning_contents c
                    where c.id = content_attachments.content_id
                      and public.content_visible(c.status, c.is_visible, c.publish_at, c.available_until)
                      and public.can_read_module(c.module_id)
                      and (content_attachments.kind = 'link' or c.allow_download)));
create policy content_attachments_write on public.content_attachments for all
  using (public.owns_module(public.content_module(content_id)))
  with check (public.owns_module(public.content_module(content_id)));

create policy course_files_attachments_read on storage.objects for select
  using (bucket_id = 'course-files' and exists (
    select 1 from public.content_attachments a
    join public.learning_contents c on c.id = a.content_id
    join public.course_modules m on m.id = c.module_id
    where a.file_path = storage.objects.name and c.allow_download
      and public.content_visible(c.status, c.is_visible, c.publish_at, c.available_until)
      and public.has_course_access(m.course_id)));

-- ---------- Progression : visibilité et prérequis ----------
create or replace function public.set_content_completed(p_content uuid, p_done boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare c public.learning_contents%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into c from public.learning_contents where id = p_content;
  if not found or not public.content_visible(c.status, c.is_visible, c.publish_at, c.available_until) or not public.can_read_module(c.module_id) then
    raise exception 'content_not_available';
  end if;
  if not public.has_course_access(public.content_course(p_content)) then raise exception 'not_enrolled'; end if;
  if p_done and c.prerequisite_content_id is not null and not exists (
    select 1 from public.content_completions where learner_id = auth.uid() and content_id = c.prerequisite_content_id
  ) then
    raise exception 'prerequisite_content_missing';
  end if;
  if p_done then
    insert into public.content_completions (learner_id, content_id) values (auth.uid(), p_content)
      on conflict do nothing;
  else
    delete from public.content_completions where learner_id = auth.uid() and content_id = p_content;
  end if;
  return p_done;
end $$;

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
    where m.course_id = e.course_id and lc.is_required
      and public.content_visible(lc.status, lc.is_visible, lc.publish_at, lc.available_until)
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

-- ---------- Notification des apprenants à la publication d'un contenu ----------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'enrollment_confirmed','enrollment_waitlisted','waitlist_promoted',
  'session_changed','session_cancelled','evaluation_available','evaluation_result',
  'message_received','certificate_issued','certificate_revoked',
  'enrollment_pending','enrollment_request','enrollment_declined',
  'enrollment_new','forum_question','forum_reply','content_published'));

create or replace function public.notify_content_published()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; cid uuid;
begin
  if new.status <> 'published' or not new.notify_learners or not new.is_visible then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'published' then return new; end if;
  if new.publish_at is not null and new.publish_at > now() then return new; end if;
  select m.course_id into cid from public.course_modules m where m.id = new.module_id;
  for r in select learner_id from public.enrollments where course_id = cid and status in ('confirmed','completed') loop
    perform public._notify(r.learner_id, 'content_published', 'Nouveau contenu disponible', new.title, '/app/formations/' || cid);
  end loop;
  return new;
end $$;
create trigger contents_notify_published after insert or update of status on public.learning_contents
  for each row execute function public.notify_content_published();

-- ---------- Fiche publique : sommaire ----------
create or replace function public.public_course_detail(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c record;
begin
  select co.id, co.slug, co.title, co.description, co.objectives, co.prerequisites, co.target_audience, co.level,
         co.duration_minutes, co.delivery_mode, co.price_amount, co.currency, co.cover_url, co.language, co.competencies,
         co.evaluation_modalities, co.certificate_conditions, co.certificate_validity_months, co.cancellation_policy,
         co.accessibility, co.prerequisite_course_id, cat.name as cat_name, cat.slug as cat_slug,
         p.full_name as instructor_name, co.subtitle, co.enrollment_mode, co.keywords, co.audience_types,
         co.payment_methods, co.allow_installments, co.parent_course_id, co.registrations_open
    into c
    from public.courses co
    left join public.categories cat on cat.id = co.category_id
    left join public.profiles p on p.id = co.instructor_id
    where co.slug = p_slug and co.status = 'published' and (co.publish_at is null or co.publish_at <= now());
  if not found then return null; end if;

  return jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'title', c.title, 'description', c.description, 'objectives', c.objectives,
    'prerequisites', c.prerequisites, 'target_audience', c.target_audience, 'level', c.level,
    'duration_minutes', c.duration_minutes, 'delivery_mode', c.delivery_mode, 'price_amount', c.price_amount,
    'currency', c.currency, 'cover_url', c.cover_url, 'language', c.language, 'competencies', c.competencies,
    'evaluation_modalities', c.evaluation_modalities, 'certificate_conditions', c.certificate_conditions,
    'certificate_validity_months', c.certificate_validity_months, 'cancellation_policy', c.cancellation_policy,
    'accessibility', c.accessibility,
    'subtitle', c.subtitle, 'enrollment_mode', c.enrollment_mode, 'keywords', to_jsonb(c.keywords),
    'audience_types', to_jsonb(c.audience_types),
    'payment_methods', to_jsonb(c.payment_methods), 'allow_installments', c.allow_installments,
    'registrations_open', c.registrations_open,
    'parent_course', (select jsonb_build_object('title', pc.title, 'slug', pc.slug)
                      from public.courses pc where pc.id = c.parent_course_id and pc.status = 'published'
                        and (pc.publish_at is null or pc.publish_at <= now())),
    'rating', (select jsonb_build_object('average', round(avg(r.rating)::numeric, 1), 'total', count(*))
               from public.course_reviews r where r.course_id = c.id having count(*) > 0),
    'category', case when c.cat_name is null then null else jsonb_build_object('name', c.cat_name, 'slug', c.cat_slug) end,
    'instructor_name', c.instructor_name,
    'prerequisite_course', (select jsonb_build_object('title', pc.title, 'slug', pc.slug)
                            from public.courses pc where pc.id = c.prerequisite_course_id and pc.status = 'published'),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', m.title, 'description', m.description,
        'contents', coalesce((
          select jsonb_agg(jsonb_build_object('title', lc.title, 'type', lc.content_type, 'duration_minutes', lc.duration_minutes)
                           order by lc.position)
          from public.learning_contents lc where lc.module_id = m.id and lc.show_in_outline
            and public.content_visible(lc.status, lc.is_visible, lc.publish_at, lc.available_until)), '[]'::jsonb)
      ) order by m.position)
      from public.course_modules m where m.course_id = c.id), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'title', s.title, 'start_at', s.start_at, 'end_at', s.end_at, 'timezone', s.timezone,
        'delivery_mode', s.delivery_mode, 'location', s.location, 'capacity', s.capacity,
        'seats_taken', public.session_seats_taken(s.id), 'registration_deadline', s.registration_deadline,
        'waitlist_enabled', s.waitlist_enabled) order by s.start_at)
      from public.sessions s where s.course_id = c.id and s.status = 'scheduled' and s.end_at > now()), '[]'::jsonb)
  );
end $$;

-- Fichier principal : nom d'origine, taille et type, pour l'aperçu et le récapitulatif.
alter table public.learning_contents
  add column file_name text check (file_name is null or char_length(file_name) <= 255),
  add column file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  add column file_mime text;
