-- Lot 4 : modes d'inscription (libre, sur validation du formateur, par code d'accès) et demandes en attente.

alter table public.courses
  add column enrollment_mode text not null default 'free' check (enrollment_mode in ('free','approval','code'));

-- Le code d'accès est dans une table à part : la lecture publique des formations ne doit jamais l'exposer.
create table public.course_access_codes (
  course_id uuid primary key references public.courses(id) on delete cascade,
  code text not null check (char_length(code) between 4 and 40)
);
alter table public.course_access_codes enable row level security;
create policy access_codes_owner on public.course_access_codes for all
  using (public.owns_course(course_id) or public.is_pedagogy_staff())
  with check (public.owns_course(course_id) or public.is_pedagogy_staff());

-- Nouveau statut : demande d'inscription en attente de la décision du formateur (ne prend aucune place).
alter table public.enrollments drop constraint enrollments_status_check;
alter table public.enrollments add constraint enrollments_status_check check (status in (
  'pending_payment','pending_approval','confirmed','waitlisted','cancelled','completed','suspended','expired'));
drop index public.enrollments_one_active;
create unique index enrollments_one_active on public.enrollments (learner_id, course_id)
  where status in ('pending_payment','pending_approval','confirmed','waitlisted','suspended');

-- Notifications : demande envoyée, nouvelle demande (formateur), demande refusée.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'enrollment_confirmed','enrollment_waitlisted','waitlist_promoted',
  'session_changed','session_cancelled','evaluation_available','evaluation_result',
  'message_received','certificate_issued','certificate_revoked',
  'enrollment_pending','enrollment_request','enrollment_declined'));

create or replace function public.notify_enrollment()
returns trigger language plpgsql security definer set search_path = public as $$
declare ctitle text; instructor uuid;
begin
  select title, instructor_id into ctitle, instructor from public.courses where id = new.course_id;
  if tg_op = 'INSERT' and new.status = 'confirmed' then
    perform public._notify(new.learner_id, 'enrollment_confirmed', 'Inscription confirmée', ctitle, '/app/inscriptions');
  elsif tg_op = 'INSERT' and new.status = 'waitlisted' then
    perform public._notify(new.learner_id, 'enrollment_waitlisted', 'Vous êtes en liste d’attente', ctitle, '/app/inscriptions');
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

-- Inscription : même règles qu'avant, plus le code d'accès et la mise en attente de validation.
drop function public._do_enroll(uuid, uuid, uuid, uuid, boolean);
drop function public.enroll_self(uuid, uuid);

create or replace function public._do_enroll(_learner uuid, _course uuid, _session uuid, _actor uuid, _manual boolean, _code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.courses%rowtype; s public.sessions%rowtype; new_status text; eid uuid; open_sessions integer; approval boolean;
begin
  select * into c from public.courses where id = _course;
  if not found or c.status <> 'published' then raise exception 'course_not_available'; end if;
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

create or replace function public.enroll_self(p_course uuid, p_session uuid default null, p_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return public._do_enroll(auth.uid(), p_course, p_session, auth.uid(), false, p_code);
end $$;

-- Décision du formateur (ou du personnel pédagogique) sur une demande d'inscription.
create or replace function public.review_enrollment(p_enrollment uuid, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.enrollments%rowtype; s public.sessions%rowtype; new_status text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into e from public.enrollments where id = p_enrollment;
  if not found then raise exception 'enrollment_not_found'; end if;
  if not (public.owns_course(e.course_id) or public.is_pedagogy_staff()) then raise exception 'forbidden'; end if;

  -- Même ordre de verrouillage que l'inscription : session d'abord, puis inscription
  if e.session_id is not null then select * into s from public.sessions where id = e.session_id for update; end if;
  select * into e from public.enrollments where id = p_enrollment for update;
  if e.status <> 'pending_approval' then raise exception 'not_pending'; end if;

  if not p_approve then
    update public.enrollments set status = 'cancelled', cancelled_at = now() where id = p_enrollment;
    new_status := 'cancelled';
  else
    if e.session_id is null then
      new_status := 'confirmed';
    else
      if s.status <> 'scheduled' or s.end_at <= now() then raise exception 'session_invalid'; end if;
      if public.session_seats_taken(e.session_id) < s.capacity then new_status := 'confirmed';
      elsif s.waitlist_enabled then new_status := 'waitlisted';
      else raise exception 'session_full';
      end if;
    end if;
    update public.enrollments set status = new_status where id = p_enrollment;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_approve then 'enrollment.approved' else 'enrollment.declined' end, 'enrollment', p_enrollment::text,
          jsonb_build_object('status', new_status));
  return jsonb_build_object('status', new_status);
end $$;

revoke execute on function public._do_enroll(uuid, uuid, uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.enroll_self(uuid, uuid, text) from public, anon;
revoke execute on function public.review_enrollment(uuid, boolean) from public, anon;
grant execute on function public.enroll_self(uuid, uuid, text) to authenticated;
grant execute on function public.review_enrollment(uuid, boolean) to authenticated;

-- Copie d'une formation : reprend aussi le mode d'inscription et le code d'accès.
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
      default_capacity, language_requirement, enrollment_mode)
  values (c.instructor_id, c.category_id, c.title || ' (copie)', c.slug || '-copie-' || substr(md5(random()::text), 1, 6),
      c.description, c.objectives, c.prerequisites, c.target_audience, c.level, c.duration_minutes, c.delivery_mode,
      c.price_amount, c.currency, c.cover_url, 'draft', c.language, c.competencies, c.evaluation_modalities,
      c.certificate_conditions, c.certificate_validity_months, c.cancellation_policy, c.accessibility,
      c.prerequisite_course_id, c.subtitle, c.course_code, c.external_reference, c.certificate_template_id,
      c.audience_types, c.keywords, c.default_capacity, c.language_requirement, c.enrollment_mode)
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

-- Lecture publique d'une formation : ajoute sous-titre, mode d'inscription (jamais le code), mots-clés, publics et note moyenne.
create or replace function public.public_course_detail(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c record;
begin
  select co.id, co.slug, co.title, co.description, co.objectives, co.prerequisites, co.target_audience, co.level,
         co.duration_minutes, co.delivery_mode, co.price_amount, co.currency, co.cover_url, co.language, co.competencies,
         co.evaluation_modalities, co.certificate_conditions, co.certificate_validity_months, co.cancellation_policy,
         co.accessibility, co.prerequisite_course_id, cat.name as cat_name, cat.slug as cat_slug,
         p.full_name as instructor_name, co.subtitle, co.enrollment_mode, co.keywords, co.audience_types
    into c
    from public.courses co
    left join public.categories cat on cat.id = co.category_id
    left join public.profiles p on p.id = co.instructor_id
    where co.slug = p_slug and co.status = 'published';
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

-- Annulation : une demande en attente de validation peut être retirée par l'apprenant ou refusée par le formateur.
create or replace function public.cancel_enrollment(p_enrollment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e public.enrollments%rowtype; s public.sessions%rowtype; is_owner boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into e from public.enrollments where id = p_enrollment;
  if not found then raise exception 'enrollment_not_found'; end if;
  is_owner := public.owns_course(e.course_id) or public.is_pedagogy_staff();
  if e.learner_id <> auth.uid() and not is_owner then raise exception 'forbidden'; end if;

  -- Même ordre de verrouillage que l'inscription : session d'abord, puis inscription
  if e.session_id is not null then
    select * into s from public.sessions where id = e.session_id for update;
  end if;
  select * into e from public.enrollments where id = p_enrollment for update;
  if e.status not in ('pending_payment','pending_approval','confirmed','waitlisted','suspended') then raise exception 'not_cancellable'; end if;
  if not is_owner and e.status <> 'pending_approval' and e.session_id is not null and s.start_at <= now() then raise exception 'session_started'; end if;

  update public.enrollments set status = 'cancelled', cancelled_at = now() where id = p_enrollment;
  if e.session_id is not null then perform public._promote_waitlist(e.session_id); end if;
end $$;
