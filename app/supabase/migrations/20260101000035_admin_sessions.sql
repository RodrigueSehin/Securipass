-- Lot 4 : gestion des sessions par l'administration.
--  - liste de toutes les sessions (hors brouillons) : formation, formateur, dates, lieu, places, statut affiché ;
--  - indicateurs : total, en cours, à venir, terminées, annulées ;
--  - annulation et rétablissement d'une session, tracés dans le journal d'audit.
-- Statut affiché : « en cours » et « terminée » se déduisent des dates d'une session planifiée.

create or replace function public._session_display_status(p_status text, p_start timestamptz, p_end timestamptz)
returns text language sql stable as $$
  select case
    when p_status = 'draft' then 'draft'
    when p_status = 'cancelled' then 'cancelled'
    when p_status = 'completed' or p_end <= now() then 'completed'
    when p_start <= now() then 'in_progress'
    else 'planned' end;
$$;

create or replace function public.admin_sessions_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
  res jsonb;
begin
  perform public._admin_only();
  select jsonb_build_object(
    'total', jsonb_build_object('count', count(*),
      'month', count(*) filter (where s.start_at >= cur and s.start_at < cur + interval '1 month'),
      'prev', count(*) filter (where s.start_at >= prev and s.start_at < cur)),
    'in_progress', jsonb_build_object('count', count(*) filter (where d = 'in_progress'),
      'month', count(*) filter (where d = 'in_progress' and s.start_at >= cur and s.start_at < cur + interval '1 month'),
      'prev', count(*) filter (where d = 'in_progress' and s.start_at >= prev and s.start_at < cur)),
    'planned', jsonb_build_object('count', count(*) filter (where d = 'planned'),
      'month', count(*) filter (where d = 'planned' and s.start_at >= cur and s.start_at < cur + interval '1 month'),
      'prev', count(*) filter (where d = 'planned' and s.start_at >= prev and s.start_at < cur)),
    'completed', jsonb_build_object('count', count(*) filter (where d = 'completed'),
      'month', count(*) filter (where d = 'completed' and s.start_at >= cur and s.start_at < cur + interval '1 month'),
      'prev', count(*) filter (where d = 'completed' and s.start_at >= prev and s.start_at < cur)),
    'cancelled', jsonb_build_object('count', count(*) filter (where d = 'cancelled'),
      'month', count(*) filter (where d = 'cancelled' and s.start_at >= cur and s.start_at < cur + interval '1 month'),
      'prev', count(*) filter (where d = 'cancelled' and s.start_at >= prev and s.start_at < cur))
  ) into res
  from (select s.*, public._session_display_status(s.status, s.start_at, s.end_at) as d from public.sessions s where s.status <> 'draft') s;
  return res;
end $$;

-- Formations qui ont au moins une session : choix du filtre « Formation »
create or replace function public.admin_sessions_options()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return jsonb_build_object('courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title) order by c.title), '[]'::jsonb)
    from public.courses c where exists (select 1 from public.sessions s where s.course_id = c.id and s.status <> 'draft')));
end $$;

-- p_status : planned | in_progress | completed | cancelled ; p_mode : onsite | online | hybrid ; p_sort : recent (défaut) | old
create or replace function public.admin_list_sessions(
  p_q text default '', p_course uuid default null, p_status text default '', p_mode text default '',
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
  from public.sessions s join public.courses c on c.id = s.course_id join public.profiles i on i.id = s.instructor_id
  where s.status <> 'draft'
    and (q = '' or s.title ilike '%' || q || '%' or s.reference ilike '%' || q || '%' or c.title ilike '%' || q || '%'
         or i.full_name ilike '%' || q || '%' or coalesce(s.location, '') ilike '%' || q || '%')
    and (p_course is null or s.course_id = p_course)
    and (coalesce(p_status, '') = '' or public._session_display_status(s.status, s.start_at, s.end_at) = p_status)
    and (coalesce(p_mode, '') = '' or s.delivery_mode = p_mode)
    and (p_from is null or s.end_at >= p_from::timestamptz)
    and (p_to is null or s.start_at < (p_to + 1)::timestamptz);

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by
        case when p_sort = 'old' then s.start_at end asc,
        case when p_sort <> 'old' then s.start_at end desc, s.id) as ord,
      s.id, s.reference, s.title, s.start_at, s.end_at, s.timezone, s.delivery_mode, s.location, s.capacity, s.status as raw_status,
      public._session_display_status(s.status, s.start_at, s.end_at) as display_status,
      public.session_seats_taken(s.id) as taken,
      c.id as course_id, c.title as course_title, c.cover_url as course_cover,
      k.slug as category_slug, k.name as category_name,
      i.id as instructor_id, i.full_name as instructor_name, i.avatar_url as instructor_avatar
    from public.sessions s join public.courses c on c.id = s.course_id join public.profiles i on i.id = s.instructor_id
    left join public.categories k on k.id = c.category_id
    where s.status <> 'draft'
      and (q = '' or s.title ilike '%' || q || '%' or s.reference ilike '%' || q || '%' or c.title ilike '%' || q || '%'
           or i.full_name ilike '%' || q || '%' or coalesce(s.location, '') ilike '%' || q || '%')
      and (p_course is null or s.course_id = p_course)
      and (coalesce(p_status, '') = '' or public._session_display_status(s.status, s.start_at, s.end_at) = p_status)
      and (coalesce(p_mode, '') = '' or s.delivery_mode = p_mode)
      and (p_from is null or s.end_at >= p_from::timestamptz)
      and (p_to is null or s.start_at < (p_to + 1)::timestamptz)
    order by ord
    limit p_limit offset p_offset
  ) t;

  return jsonb_build_object('total', total, 'rows', rows);
end $$;

-- Annule une session (planifiée ou en cours) ou rétablit une session annulée
create or replace function public.admin_set_session_status(p_session uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  perform public._admin_only();
  if p_status not in ('scheduled', 'cancelled') then raise exception 'status_invalid'; end if;
  select status into cur from public.sessions where id = p_session;
  if cur is null then raise exception 'session_not_found'; end if;
  if cur not in ('scheduled', 'cancelled') then raise exception 'session_locked'; end if;
  update public.sessions set status = p_status where id = p_session;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_status = 'cancelled' then 'session.cancel' else 'session.restore' end, 'session', p_session::text, '{}'::jsonb);
end $$;

revoke execute on function public.admin_sessions_stats() from public, anon;
revoke execute on function public.admin_sessions_options() from public, anon;
revoke execute on function public.admin_list_sessions(text, uuid, text, text, date, date, text, integer, integer) from public, anon;
revoke execute on function public.admin_set_session_status(uuid, text) from public, anon;
grant execute on function public.admin_sessions_stats() to authenticated;
grant execute on function public.admin_sessions_options() to authenticated;
grant execute on function public.admin_list_sessions(text, uuid, text, text, date, date, text, integer, integer) to authenticated;
grant execute on function public.admin_set_session_status(uuid, text) to authenticated;
