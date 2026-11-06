-- Lot 4 : paramètres de publication de l'étape 5 de l'assistant.
--  - mise en avant dans le catalogue (les formations mises en avant passent en tête du tri par pertinence et de l'accueil) ;
--  - inscriptions ouvertes ou fermées (la fermeture bloque l'inscription en ligne ; le formateur peut toujours inscrire à la main).

alter table public.courses
  add column featured boolean not null default false,
  add column registrations_open boolean not null default true;

create or replace function public._do_enroll(_learner uuid, _course uuid, _session uuid, _actor uuid, _manual boolean, _code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.courses%rowtype; s public.sessions%rowtype; new_status text; eid uuid; open_sessions integer; approval boolean;
begin
  select * into c from public.courses where id = _course;
  if not found or c.status <> 'published' or (c.publish_at is not null and c.publish_at > now()) then raise exception 'course_not_available'; end if;
  if not c.registrations_open and not _manual then raise exception 'registrations_closed_course'; end if;
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
