-- Lot 4 : gestion des présences par l'administration.
--  - heures d'arrivée et de départ (heure locale de la session) sur les présences ;
--  - liste des inscrits d'une session avec leur présence, synthèse par session et par formation, indicateurs ;
--  - saisie groupée des présences d'une session, tracée dans le journal d'audit.
-- Statuts enregistrés : present | late (compté présent) | absent | excused (absence justifiée, comptée absente).
-- Inscrits : inscriptions validées, terminées ou suspendues de la session. Sans date ni session choisie, seules les sessions déjà commencées comptent.

alter table public.attendance_records
  add column check_in time,
  add column check_out time;

create or replace function public._attendance_sessions(p_course uuid, p_session uuid, p_date date)
returns table (id uuid) language sql stable security definer set search_path = public as $$
  select s.id from public.sessions s
  where s.status <> 'draft'
    and (p_course is null or s.course_id = p_course)
    and (p_session is null or s.id = p_session)
    and (p_date is null or (s.start_at < (p_date + 1)::timestamptz and s.end_at >= p_date::timestamptz))
    and (p_session is not null or p_date is not null or s.start_at <= now());
$$;
revoke execute on function public._attendance_sessions(uuid, uuid, date) from public, anon, authenticated;

create or replace function public.admin_attendance_options()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return jsonb_build_object(
    'courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title) order by c.title), '[]'::jsonb)
      from public.courses c where exists (select 1 from public.sessions s where s.course_id = c.id and s.status <> 'draft')),
    'sessions', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'course_id', s.course_id, 'start_at', s.start_at, 'end_at', s.end_at, 'timezone', s.timezone) order by s.start_at desc), '[]'::jsonb)
      from (select * from public.sessions where status <> 'draft' order by start_at desc limit 500) s));
end $$;

-- Indicateurs sur le périmètre filtré
create or replace function public.admin_attendance_stats(p_course uuid default null, p_session uuid default null, p_date date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare enrolled integer; present integer; absent integer;
begin
  perform public._admin_only();
  select count(*) into enrolled from public.enrollments e
    where e.session_id in (select id from public._attendance_sessions(p_course, p_session, p_date)) and e.status in ('confirmed', 'completed', 'suspended');
  select count(*) filter (where a.status in ('present', 'late')), count(*) filter (where a.status in ('absent', 'excused'))
    into present, absent
    from public.attendance_records a
    where a.session_id in (select id from public._attendance_sessions(p_course, p_session, p_date));
  return jsonb_build_object('enrolled', enrolled, 'present', present, 'absent', absent);
end $$;

-- Inscrits d'une session et leur présence (null si pas encore saisie)
create or replace function public.admin_list_attendance(p_session uuid, p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare total integer; rows jsonb; head jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 200);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  select count(*) into total from public.enrollments e where e.session_id = p_session and e.status in ('confirmed', 'completed', 'suspended');

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by p.full_name, p.id) as ord,
      p.id as learner_id, p.full_name, p.avatar_url, p.learner_code,
      (select o.name from public.organization_members m join public.organizations o on o.id = m.organization_id
        where m.user_id = p.id and m.status = 'active' order by o.name limit 1) as organization,
      a.status, to_char(a.check_in, 'HH24:MI') as check_in, to_char(a.check_out, 'HH24:MI') as check_out, a.justification
    from public.enrollments e join public.profiles p on p.id = e.learner_id
    left join public.attendance_records a on a.session_id = e.session_id and a.learner_id = e.learner_id
    where e.session_id = p_session and e.status in ('confirmed', 'completed', 'suspended')
    order by ord limit p_limit offset p_offset
  ) t;

  select jsonb_build_object('session_id', s.id, 'title', s.title, 'start_at', s.start_at, 'end_at', s.end_at, 'timezone', s.timezone,
           'course_id', c.id, 'course_title', c.title,
           'delivery_mode', s.delivery_mode, 'location', s.location, 'instructor_name', i.full_name)
    into head from public.sessions s join public.courses c on c.id = s.course_id join public.profiles i on i.id = s.instructor_id where s.id = p_session;
  return jsonb_build_object('total', total, 'rows', rows, 'session', head);
end $$;

-- Synthèse par session
create or replace function public.admin_attendance_by_session(p_course uuid default null, p_date date default null, p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare total integer; rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  select count(*) into total from public._attendance_sessions(p_course, null, p_date);
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by s.start_at desc, s.id) as ord, s.id, s.title, s.start_at, s.end_at, s.timezone, c.title as course_title,
      (select count(*) from public.enrollments e where e.session_id = s.id and e.status in ('confirmed', 'completed', 'suspended')) as enrolled,
      (select count(*) from public.attendance_records a where a.session_id = s.id and a.status in ('present', 'late')) as present,
      (select count(*) from public.attendance_records a where a.session_id = s.id and a.status in ('absent', 'excused')) as absent
    from public.sessions s join public.courses c on c.id = s.course_id
    where s.id in (select id from public._attendance_sessions(p_course, null, p_date))
    order by ord limit p_limit offset p_offset
  ) t;
  return jsonb_build_object('total', total, 'rows', rows);
end $$;

-- Synthèse par formation (sessions déjà commencées)
create or replace function public.admin_attendance_by_course(p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare total integer; rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  select count(distinct s.course_id) into total from public._attendance_sessions(null, null, null) x join public.sessions s on s.id = x.id;
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by c.title, c.id) as ord, c.id, c.title,
      count(*) as sessions, sum(x.enrolled) as enrolled, sum(x.present) as present, sum(x.absent) as absent
    from public.courses c join (
      select s.course_id,
        (select count(*) from public.enrollments e where e.session_id = s.id and e.status in ('confirmed', 'completed', 'suspended')) as enrolled,
        (select count(*) from public.attendance_records a where a.session_id = s.id and a.status in ('present', 'late')) as present,
        (select count(*) from public.attendance_records a where a.session_id = s.id and a.status in ('absent', 'excused')) as absent
      from public.sessions s where s.id in (select id from public._attendance_sessions(null, null, null))
    ) x on x.course_id = c.id
    group by c.id, c.title
    order by ord limit p_limit offset p_offset
  ) t;
  return jsonb_build_object('total', total, 'rows', rows);
end $$;

-- Saisie groupée : p_rows = [{ learner, status, check_in, check_out, justification }]
create or replace function public.admin_record_attendance(p_session uuid, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare r jsonb; n integer := 0; st text;
begin
  perform public._admin_only();
  if not exists (select 1 from public.sessions where id = p_session and status <> 'draft') then raise exception 'session_invalid'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then raise exception 'rows_invalid'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    st := r ->> 'status';
    if st is null or st = '' then continue; end if;
    if st not in ('present', 'late', 'absent', 'excused') then raise exception 'status_invalid'; end if;
    insert into public.attendance_records (session_id, learner_id, status, justification, check_in, check_out)
    values (p_session, (r ->> 'learner')::uuid, st, nullif(btrim(r ->> 'justification'), ''),
            case when st in ('present', 'late') then nullif(r ->> 'check_in', '')::time end,
            case when st in ('present', 'late') then nullif(r ->> 'check_out', '')::time end)
    on conflict (session_id, learner_id) do update
      set status = excluded.status, justification = excluded.justification, check_in = excluded.check_in, check_out = excluded.check_out;
    n := n + 1;
  end loop;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'attendance.record', 'session', p_session::text, jsonb_build_object('count', n));
  return n;
end $$;

revoke execute on function public.admin_attendance_options() from public, anon;
revoke execute on function public.admin_attendance_stats(uuid, uuid, date) from public, anon;
revoke execute on function public.admin_list_attendance(uuid, integer, integer) from public, anon;
revoke execute on function public.admin_attendance_by_session(uuid, date, integer, integer) from public, anon;
revoke execute on function public.admin_attendance_by_course(integer, integer) from public, anon;
revoke execute on function public.admin_record_attendance(uuid, jsonb) from public, anon;
grant execute on function public.admin_attendance_options() to authenticated;
grant execute on function public.admin_attendance_stats(uuid, uuid, date) to authenticated;
grant execute on function public.admin_list_attendance(uuid, integer, integer) to authenticated;
grant execute on function public.admin_attendance_by_session(uuid, date, integer, integer) to authenticated;
grant execute on function public.admin_attendance_by_course(integer, integer) to authenticated;
grant execute on function public.admin_record_attendance(uuid, jsonb) to authenticated;
