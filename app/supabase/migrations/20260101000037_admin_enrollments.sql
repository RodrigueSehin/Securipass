-- Lot 4 : gestion des inscriptions par l'administration.
--  - liste de toutes les inscriptions : apprenant, formation, session, date, statut ;
--  - indicateurs : total, en attente, validées, refusées ou annulées ;
--  - la validation, le refus et l'annulation passent par review_enrollment et cancel_enrollment (règles déjà en place).
-- Groupes de statuts : pending = pending_approval + pending_payment ; validated = confirmed + completed ; refused = cancelled.

create or replace function public._enrollment_group(p_status text)
returns text language sql immutable as $$
  select case
    when p_status in ('pending_approval', 'pending_payment') then 'pending'
    when p_status in ('confirmed', 'completed') then 'validated'
    when p_status = 'cancelled' then 'refused'
    else p_status end;
$$;

create or replace function public.admin_enrollments_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
  res jsonb;
begin
  perform public._admin_only();
  select jsonb_build_object(
    'total', jsonb_build_object('count', count(*),
      'month', count(*) filter (where e.enrolled_at >= cur),
      'prev', count(*) filter (where e.enrolled_at >= prev and e.enrolled_at < cur)),
    'pending', jsonb_build_object('count', count(*) filter (where g = 'pending'),
      'month', count(*) filter (where g = 'pending' and e.enrolled_at >= cur),
      'prev', count(*) filter (where g = 'pending' and e.enrolled_at >= prev and e.enrolled_at < cur)),
    'validated', jsonb_build_object('count', count(*) filter (where g = 'validated'),
      'month', count(*) filter (where g = 'validated' and e.enrolled_at >= cur),
      'prev', count(*) filter (where g = 'validated' and e.enrolled_at >= prev and e.enrolled_at < cur)),
    'refused', jsonb_build_object('count', count(*) filter (where g = 'refused'),
      'month', count(*) filter (where g = 'refused' and e.enrolled_at >= cur),
      'prev', count(*) filter (where g = 'refused' and e.enrolled_at >= prev and e.enrolled_at < cur))
  ) into res
  from (select e.*, public._enrollment_group(e.status) as g from public.enrollments e) e;
  return res;
end $$;

-- Formations et sessions proposées par les filtres
create or replace function public.admin_enrollments_options()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return jsonb_build_object(
    'courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title) order by c.title), '[]'::jsonb)
      from public.courses c where exists (select 1 from public.enrollments e where e.course_id = c.id)),
    'sessions', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'course_id', s.course_id) order by s.start_at desc), '[]'::jsonb)
      from public.sessions s where s.status <> 'draft' and exists (select 1 from public.enrollments e where e.session_id = s.id)));
end $$;

-- p_status : pending | validated | refused | waitlisted | suspended | expired ; p_sort : recent (défaut) | old
create or replace function public.admin_list_enrollments(
  p_q text default '', p_course uuid default null, p_session uuid default null, p_status text default '',
  p_from date default null, p_to date default null, p_sort text default 'recent', p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
  total integer;
  rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*) into total
  from public.enrollments e join public.profiles l on l.id = e.learner_id join public.courses c on c.id = e.course_id
  where (q = '' or l.full_name ilike '%' || q || '%' or l.email ilike '%' || q || '%' or coalesce(l.phone, '') ilike '%' || q || '%' or c.title ilike '%' || q || '%')
    and (p_course is null or e.course_id = p_course)
    and (p_session is null or e.session_id = p_session)
    and (coalesce(p_status, '') = '' or public._enrollment_group(e.status) = p_status)
    and (p_from is null or e.enrolled_at >= p_from::timestamptz)
    and (p_to is null or e.enrolled_at < (p_to + 1)::timestamptz);

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by
        case when p_sort = 'old' then e.enrolled_at end asc,
        case when p_sort <> 'old' then e.enrolled_at end desc, e.id) as ord,
      e.id, e.status, e.enrolled_at,
      l.id as learner_id, l.full_name as learner_name, l.avatar_url as learner_avatar, l.phone as learner_phone, l.email as learner_email,
      c.id as course_id, c.title as course_title,
      s.id as session_id, s.title as session_title, s.timezone as session_timezone
    from public.enrollments e join public.profiles l on l.id = e.learner_id join public.courses c on c.id = e.course_id
    left join public.sessions s on s.id = e.session_id
    where (q = '' or l.full_name ilike '%' || q || '%' or l.email ilike '%' || q || '%' or coalesce(l.phone, '') ilike '%' || q || '%' or c.title ilike '%' || q || '%')
      and (p_course is null or e.course_id = p_course)
      and (p_session is null or e.session_id = p_session)
      and (coalesce(p_status, '') = '' or public._enrollment_group(e.status) = p_status)
      and (p_from is null or e.enrolled_at >= p_from::timestamptz)
      and (p_to is null or e.enrolled_at < (p_to + 1)::timestamptz)
    order by ord
    limit p_limit offset p_offset
  ) t;

  return jsonb_build_object('total', total, 'rows', rows);
end $$;

revoke execute on function public._enrollment_group(text) from public, anon, authenticated;
revoke execute on function public.admin_enrollments_stats() from public, anon;
revoke execute on function public.admin_enrollments_options() from public, anon;
revoke execute on function public.admin_list_enrollments(text, uuid, uuid, text, date, date, text, integer, integer) from public, anon;
grant execute on function public.admin_enrollments_stats() to authenticated;
grant execute on function public.admin_enrollments_options() to authenticated;
grant execute on function public.admin_list_enrollments(text, uuid, uuid, text, date, date, text, integer, integer) to authenticated;
