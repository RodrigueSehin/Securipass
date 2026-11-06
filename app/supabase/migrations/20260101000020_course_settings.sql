-- Lot 4 : paramètres d'une formation (étape 4 de l'assistant de création).
--  - publication : à la validation, immédiate ou planifiée à une date (la formation reste invisible avant cette date) ;
--  - tarification : moyens de paiement acceptés et paiement en plusieurs fois (configuration affichée sur la fiche) ;
--  - options pédagogiques : téléchargement des supports, forum de questions, discussions entre apprenants, progression visible ;
--  - notifications : le formateur est averti de chaque inscription ; certificat délivré automatiquement ;
--  - formation parent.

alter table public.courses
  add column publication_mode text not null default 'publish' check (publication_mode in ('draft','publish','scheduled')),
  add column publish_at timestamptz,
  add column payment_methods text[] not null default '{}' check (payment_methods <@ array['mobile_money','card','bank_transfer']::text[]),
  add column allow_installments boolean not null default false,
  add column allow_downloads boolean not null default true,
  add column forum_enabled boolean not null default true,
  add column allow_discussions boolean not null default true,
  add column show_progress boolean not null default true,
  add column notify_instructor boolean not null default true,
  add column auto_certificate boolean not null default false,
  add column parent_course_id uuid references public.courses(id) on delete set null;
alter table public.courses add constraint courses_schedule_required check (publication_mode <> 'scheduled' or publish_at is not null);
alter table public.courses add constraint courses_parent_not_self check (parent_course_id is null or parent_course_id <> id);

-- ---------- Visibilité : une formation validée n'est visible qu'à partir de sa date de publication ----------
create or replace function public.course_is_published(_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses
    where id = _course and status = 'published' and (publish_at is null or publish_at <= now()));
$$;

drop policy courses_read on public.courses;
create policy courses_read on public.courses for select
  using ((status = 'published' and (publish_at is null or publish_at <= now())) or instructor_id = auth.uid() or public.is_staff());

create or replace function public.courses_with_open_sessions()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct s.course_id from public.sessions s
  join public.courses c on c.id = s.course_id and c.status = 'published' and (c.publish_at is null or c.publish_at <= now())
  where s.status = 'scheduled' and coalesce(s.registration_deadline, s.start_at) > now()
    and public.session_seats_taken(s.id) < s.capacity;
$$;

-- ---------- Notifications : nouvelle inscription, forum ----------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'enrollment_confirmed','enrollment_waitlisted','waitlist_promoted',
  'session_changed','session_cancelled','evaluation_available','evaluation_result',
  'message_received','certificate_issued','certificate_revoked',
  'enrollment_pending','enrollment_request','enrollment_declined',
  'enrollment_new','forum_question','forum_reply'));

create or replace function public.notify_enrollment()
returns trigger language plpgsql security definer set search_path = public as $$
declare ctitle text; instructor uuid; notify_trainer boolean;
begin
  select title, instructor_id, notify_instructor into ctitle, instructor, notify_trainer from public.courses where id = new.course_id;
  if tg_op = 'INSERT' and new.status = 'confirmed' then
    perform public._notify(new.learner_id, 'enrollment_confirmed', 'Inscription confirmée', ctitle, '/app/inscriptions');
    if notify_trainer and instructor <> new.learner_id then
      perform public._notify(instructor, 'enrollment_new', 'Nouvelle inscription', ctitle, '/formateur/formations/' || new.course_id || '/sessions');
    end if;
  elsif tg_op = 'INSERT' and new.status = 'waitlisted' then
    perform public._notify(new.learner_id, 'enrollment_waitlisted', 'Vous êtes en liste d’attente', ctitle, '/app/inscriptions');
    if notify_trainer and instructor <> new.learner_id then
      perform public._notify(instructor, 'enrollment_new', 'Nouvelle inscription en liste d’attente', ctitle, '/formateur/formations/' || new.course_id || '/sessions');
    end if;
  elsif tg_op = 'INSERT' and new.status = 'pending_approval' then
    perform public._notify(new.learner_id, 'enrollment_pending', 'Demande d’inscription envoyée',
      ctitle || ' : en attente de la validation du formateur', '/app/inscriptions');
    perform public._notify(instructor, 'enrollment_request', 'Nouvelle demande d’inscription', ctitle,
      '/formateur/formations/' || new.course_id || '/sessions');
  elsif tg_op = 'UPDATE' and old.status = 'waitlisted' and new.status = 'confirmed' then
    perform public._notify(new.learner_id, 'waitlist_promoted', 'Une place s’est libérée', ctitle, '/app/inscriptions');
  elsif tg_op = 'UPDATE' and old.status = 'pending_approval' and new.status = 'confirmed' then
    perform public._notify(new.learner_id, 'enrollment_confirmed', 'Inscription confirmée', ctitle, '/app/inscriptions');
  elsif tg_op = 'UPDATE' and old.status = 'pending_approval' and new.status = 'waitlisted' then
    perform public._notify(new.learner_id, 'enrollment_waitlisted', 'Vous êtes en liste d’attente', ctitle, '/app/inscriptions');
  elsif tg_op = 'UPDATE' and old.status = 'pending_approval' and new.status = 'cancelled'
        and auth.uid() is distinct from new.learner_id then
    perform public._notify(new.learner_id, 'enrollment_declined', 'Demande d’inscription refusée', ctitle, '/app/inscriptions');
  end if;
  return new;
end $$;

-- ---------- Inscription : la formation doit être visible (publiée à la date prévue) ----------
create or replace function public._do_enroll(_learner uuid, _course uuid, _session uuid, _actor uuid, _manual boolean, _code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.courses%rowtype; s public.sessions%rowtype; new_status text; eid uuid; open_sessions integer; approval boolean;
begin
  select * into c from public.courses where id = _course;
  if not found or c.status <> 'published' or (c.publish_at is not null and c.publish_at > now()) then raise exception 'course_not_available'; end if;
  if c.price_amount > 0 and not _manual then raise exception 'payment_required'; end if;
  if c.prerequisite_course_id is not null and not exists (
    select 1 from public.enrollments where learner_id = _learner and course_id = c.prerequisite_course_id and status = 'completed'
  ) then raise exception 'prerequisite_missing'; end if;
  if exists (
    select 1 from public.enrollments where learner_id = _learner and course_id = _course
      and status in ('pending_payment','pending_approval','confirmed','waitlisted','suspended')
  ) then raise exception 'already_enrolled'; end if;
  if not _manual and c.enrollment_mode = 'code' and not exists (
    select 1 from public.course_access_codes ac
    where ac.course_id = _course and lower(ac.code) = lower(btrim(coalesce(_code, '')))
  ) then raise exception 'access_code_invalid'; end if;
  approval := not _manual and c.enrollment_mode = 'approval';

  if _session is null then
    select count(*) into open_sessions from public.sessions
      where course_id = _course and status = 'scheduled' and end_at > now();
    if open_sessions > 0 then raise exception 'session_required'; end if;
    new_status := case when approval then 'pending_approval' else 'confirmed' end;
  else
    select * into s from public.sessions where id = _session for update;
    if not found or s.course_id <> _course or s.status <> 'scheduled' or s.end_at <= now() then
      raise exception 'session_invalid';
    end if;
    if not _manual and coalesce(s.registration_deadline, s.start_at) < now() then
      raise exception 'registration_closed';
    end if;
    if approval then new_status := 'pending_approval';
    elsif public.session_seats_taken(_session) < s.capacity then new_status := 'confirmed';
    elsif s.waitlist_enabled then new_status := 'waitlisted';
    else raise exception 'session_full';
    end if;
  end if;

  begin
    insert into public.enrollments (learner_id, course_id, session_id, status, created_by)
    values (_learner, _course, _session, new_status, _actor) returning id into eid;
  exception when unique_violation then
    raise exception 'already_enrolled';
  end;
  return jsonb_build_object('enrollment_id', eid, 'status', new_status);
end $$;

-- ---------- Fiche publique : visibilité, moyens de paiement, formation parent ----------
create or replace function public.public_course_detail(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c record;
begin
  select co.id, co.slug, co.title, co.description, co.objectives, co.prerequisites, co.target_audience, co.level,
         co.duration_minutes, co.delivery_mode, co.price_amount, co.currency, co.cover_url, co.language, co.competencies,
         co.evaluation_modalities, co.certificate_conditions, co.certificate_validity_months, co.cancellation_policy,
         co.accessibility, co.prerequisite_course_id, cat.name as cat_name, cat.slug as cat_slug,
         p.full_name as instructor_name, co.subtitle, co.enrollment_mode, co.keywords, co.audience_types,
         co.payment_methods, co.allow_installments, co.parent_course_id
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
          from public.learning_contents lc where lc.module_id = m.id and lc.status = 'published'), '[]'::jsonb)
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

-- ---------- Copie d'une formation : reprend tous les réglages (activités d'évaluation et code d'accès compris pour ce dernier) ----------
create or replace function public.duplicate_course(p_course uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.courses%rowtype; new_id uuid; m record; new_m uuid;
begin
  if not (public.owns_course(p_course) or public.is_pedagogy_staff()) then raise exception 'forbidden'; end if;
  select * into c from public.courses where id = p_course;
  insert into public.courses (instructor_id, category_id, title, slug, description, objectives, prerequisites, target_audience,
      level, duration_minutes, delivery_mode, price_amount, currency, cover_url, status, language, competencies,
      evaluation_modalities, certificate_conditions, certificate_validity_months, cancellation_policy, accessibility,
      prerequisite_course_id, subtitle, course_code, external_reference, certificate_template_id, audience_types, keywords,
      default_capacity, language_requirement, enrollment_mode,
      evaluation_enabled, evaluation_types, pass_mark_percent, grading_scale, grade_rounding, default_attempts, show_results,
      allow_retake, certificate_enabled, certificate_title, certificate_description, certificate_display,
      publication_mode, payment_methods, allow_installments, allow_downloads, forum_enabled, allow_discussions, show_progress,
      notify_instructor, auto_certificate, parent_course_id)
  values (c.instructor_id, c.category_id, c.title || ' (copie)', c.slug || '-copie-' || substr(md5(random()::text), 1, 6),
      c.description, c.objectives, c.prerequisites, c.target_audience, c.level, c.duration_minutes, c.delivery_mode,
      c.price_amount, c.currency, c.cover_url, 'draft', c.language, c.competencies, c.evaluation_modalities,
      c.certificate_conditions, c.certificate_validity_months, c.cancellation_policy, c.accessibility,
      c.prerequisite_course_id, c.subtitle, c.course_code, c.external_reference, c.certificate_template_id,
      c.audience_types, c.keywords, c.default_capacity, c.language_requirement, c.enrollment_mode,
      c.evaluation_enabled, c.evaluation_types, c.pass_mark_percent, c.grading_scale, c.grade_rounding, c.default_attempts, c.show_results,
      c.allow_retake, c.certificate_enabled, c.certificate_title, c.certificate_description, c.certificate_display,
      case when c.publication_mode = 'scheduled' then 'publish' else c.publication_mode end,
      c.payment_methods, c.allow_installments, c.allow_downloads, c.forum_enabled, c.allow_discussions, c.show_progress,
      c.notify_instructor, c.auto_certificate, c.parent_course_id)
  returning id into new_id;
  insert into public.course_access_codes (course_id, code)
    select new_id, code from public.course_access_codes where course_id = p_course;
  for m in select * from public.course_modules where course_id = p_course order by position loop
    insert into public.course_modules (course_id, title, description, position)
    values (new_id, m.title, m.description, m.position) returning id into new_m;
    insert into public.learning_contents (module_id, title, content_type, description, body, file_path, external_url,
        duration_minutes, position, status)
    select new_m, title, content_type, description, body, file_path, external_url, duration_minutes, position, 'draft'
    from public.learning_contents where module_id = m.id;
  end loop;
  return new_id;
end $$;

-- ---------- Forum de questions d'une formation ----------
create table public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 200),
  created_at timestamptz not null default now(),
  last_post_at timestamptz not null default now()
);
create index on public.forum_threads (course_id, last_post_at desc);

create table public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.forum_posts (thread_id, created_at);

-- Lecture : le formateur et le personnel toujours ; les inscrits tant que le forum est activé.
create or replace function public.can_read_forum(_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.owns_course(_course) or public.is_staff()
    or (public.has_course_access(_course) and exists (select 1 from public.courses where id = _course and forum_enabled));
$$;

alter table public.forum_threads enable row level security;
alter table public.forum_posts enable row level security;
create policy forum_threads_read on public.forum_threads for select using (public.can_read_forum(course_id));
create policy forum_posts_read on public.forum_posts for select
  using (exists (select 1 from public.forum_threads t where t.id = thread_id and public.can_read_forum(t.course_id)));
-- Modération : le formateur de la formation et le personnel suppriment questions et réponses
create policy forum_threads_moderate on public.forum_threads for delete using (public.owns_course(course_id) or public.is_staff());
create policy forum_posts_moderate on public.forum_posts for delete
  using (exists (select 1 from public.forum_threads t where t.id = thread_id and (public.owns_course(t.course_id) or public.is_staff())));

create or replace function public.create_forum_thread(p_course uuid, p_title text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.courses%rowtype; tid uuid; t text := btrim(coalesce(p_title, '')); b text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into c from public.courses where id = p_course;
  if not found or not c.forum_enabled then raise exception 'forum_disabled'; end if;
  if not (public.owns_course(p_course) or public.is_pedagogy_staff() or public.has_course_access(p_course)) then raise exception 'forbidden'; end if;
  if char_length(t) < 3 or char_length(t) > 200 or char_length(b) < 1 or char_length(b) > 4000 then raise exception 'invalid_post'; end if;
  insert into public.forum_threads (course_id, author_id, title) values (p_course, auth.uid(), t) returning id into tid;
  insert into public.forum_posts (thread_id, author_id, body) values (tid, auth.uid(), b);
  if c.instructor_id <> auth.uid() then
    perform public._notify(c.instructor_id, 'forum_question', 'Nouvelle question', t, '/app/forum/' || p_course);
  end if;
  return tid;
end $$;

-- Réponse : le formateur et le personnel répondent toujours ; un inscrit répond à sa propre question, et aux autres
-- seulement si les discussions entre apprenants sont autorisées.
create or replace function public.reply_forum_thread(p_thread uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare th public.forum_threads%rowtype; c public.courses%rowtype; pid uuid; b text := btrim(coalesce(p_body, '')); privileged boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into th from public.forum_threads where id = p_thread;
  if not found then raise exception 'thread_not_found'; end if;
  select * into c from public.courses where id = th.course_id;
  privileged := public.owns_course(th.course_id) or public.is_pedagogy_staff();
  if not privileged then
    if not c.forum_enabled then raise exception 'forum_disabled'; end if;
    if not public.has_course_access(th.course_id) then raise exception 'forbidden'; end if;
    if not c.allow_discussions and th.author_id <> auth.uid() then raise exception 'discussions_disabled'; end if;
  end if;
  if char_length(b) < 1 or char_length(b) > 4000 then raise exception 'invalid_post'; end if;
  insert into public.forum_posts (thread_id, author_id, body) values (p_thread, auth.uid(), b) returning id into pid;
  update public.forum_threads set last_post_at = now() where id = p_thread;
  if th.author_id <> auth.uid() then
    perform public._notify(th.author_id, 'forum_reply', 'Nouvelle réponse à votre question', th.title, '/app/forum/' || th.course_id);
  end if;
  if c.instructor_id <> auth.uid() and c.instructor_id <> th.author_id then
    perform public._notify(c.instructor_id, 'forum_reply', 'Nouvelle réponse sur le forum', th.title, '/app/forum/' || th.course_id);
  end if;
  return pid;
end $$;

revoke execute on function public.create_forum_thread(uuid, text, text) from public, anon;
revoke execute on function public.reply_forum_thread(uuid, text) from public, anon;
grant execute on function public.create_forum_thread(uuid, text, text) to authenticated;
grant execute on function public.reply_forum_thread(uuid, text) to authenticated;

-- ---------- Certificat délivré automatiquement ----------
-- Dès qu'une inscription devient éligible (leçon terminée, évaluation envoyée ou notée, présence saisie), le certificat est
-- émis avec le modèle de la formation. Une erreur ne doit jamais bloquer l'action qui l'a déclenchée.
create or replace function public._try_auto_certificate(_enrollment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e public.enrollments%rowtype; c public.courses%rowtype;
begin
  select * into e from public.enrollments where id = _enrollment;
  if not found then return; end if;
  select * into c from public.courses where id = e.course_id;
  if not c.auto_certificate or not c.certificate_enabled or c.certificate_template_id is null then return; end if;
  if exists (select 1 from public.certificates where enrollment_id = _enrollment and status in ('valid','suspended')) then return; end if;
  begin
    if (public.certificate_eligibility(_enrollment) ->> 'eligible')::boolean then
      perform public._issue_certificate(null, _enrollment, c.certificate_template_id,
        jsonb_build_object('validity_months', c.certificate_validity_months), c.instructor_id, null);
    end if;
  exception when others then
    null;
  end;
end $$;

create or replace function public.trg_auto_certificate()
returns trigger language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  if tg_table_name = 'content_completions' then
    select e.id into eid from public.enrollments e
      where e.learner_id = new.learner_id and e.course_id = public.content_course(new.content_id) and e.status in ('confirmed','completed') limit 1;
  elsif tg_table_name in ('evaluation_attempts', 'evaluation_grades') then
    select e.id into eid from public.enrollments e
      where e.learner_id = new.learner_id and e.course_id = public.evaluation_course(new.evaluation_id) and e.status in ('confirmed','completed') limit 1;
  elsif tg_table_name = 'attendance_records' then
    select e.id into eid from public.enrollments e
      where e.learner_id = new.learner_id and e.session_id = new.session_id and e.status in ('confirmed','completed') limit 1;
  end if;
  if eid is not null then perform public._try_auto_certificate(eid); end if;
  return new;
end $$;

create trigger completions_auto_certificate after insert on public.content_completions
  for each row execute function public.trg_auto_certificate();
create trigger attempts_auto_certificate after update of submitted_at on public.evaluation_attempts
  for each row when (new.submitted_at is not null) execute function public.trg_auto_certificate();
create trigger grades_auto_certificate after insert or update on public.evaluation_grades
  for each row execute function public.trg_auto_certificate();
create trigger attendance_auto_certificate after insert or update on public.attendance_records
  for each row execute function public.trg_auto_certificate();

revoke execute on function public._try_auto_certificate(uuid) from public, anon, authenticated;

-- Noms affichés dans le forum : prénom et initiale du nom (les profils des autres apprenants ne sont pas lisibles),
-- réservés à ceux qui peuvent lire le forum de la formation.
create or replace function public.forum_authors(p_course uuid)
returns table (id uuid, display_name text, is_instructor boolean)
language sql stable security definer set search_path = public as $$
  select p.id,
         case when nullif(btrim(p.full_name), '') is null then 'Participant'
              when array_length(string_to_array(btrim(p.full_name), ' '), 1) = 1 then btrim(p.full_name)
              else (string_to_array(btrim(p.full_name), ' '))[1] || ' ' ||
                   upper(left((string_to_array(btrim(p.full_name), ' '))[array_length(string_to_array(btrim(p.full_name), ' '), 1)], 1)) || '.'
         end,
         p.id = (select instructor_id from public.courses where id = p_course)
  from public.profiles p
  where public.can_read_forum(p_course)
    and (p.id in (select author_id from public.forum_threads where course_id = p_course)
         or p.id in (select fp.author_id from public.forum_posts fp join public.forum_threads t on t.id = fp.thread_id where t.course_id = p_course));
$$;
revoke execute on function public.forum_authors(uuid) from public, anon;
grant execute on function public.forum_authors(uuid) to authenticated;

-- ---------- Téléchargement des supports ----------
-- Quand il est désactivé pour la formation, les inscrits ne lisent plus les ressources des modules (ni leurs fichiers) ;
-- le formateur et le personnel y accèdent toujours.
create or replace function public.can_download_resources(_module uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.owns_module(_module) or public.is_staff()
    or (public.can_read_module(_module) and exists (
      select 1 from public.course_modules m join public.courses c on c.id = m.course_id where m.id = _module and c.allow_downloads));
$$;

drop policy module_resources_read on public.module_resources;
create policy module_resources_read on public.module_resources for select using (public.can_download_resources(module_id));

drop policy course_files_resources_read on storage.objects;
create policy course_files_resources_read on storage.objects for select
  using (bucket_id = 'course-files' and exists (
    select 1 from public.module_resources r
    join public.course_modules m on m.id = r.module_id
    join public.courses c on c.id = m.course_id
    where r.file_path = storage.objects.name and public.has_course_access(m.course_id) and c.allow_downloads));
