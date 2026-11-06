-- Lot 4 : gestion des évaluations par l'administration.
--  - liste de toutes les évaluations : formation, session, type, fenêtre de passage, participants, résultats, statut affiché ;
--  - indicateurs : total, en cours, terminées, échouées, taux de réussite ;
--  - publication, retour en brouillon et archivage, tracés dans le journal d'audit.
-- Statut affiché : draft (brouillon) | planned (publiée, pas encore ouverte) | in_progress (ouverte) | completed (échéance passée ou archivée).
-- Résultat d'un apprenant : meilleure tentative rendue (quiz) ou note saisie par le formateur (autres types), comparée à la note de réussite.
-- Participants : apprenants inscrits (validés ou terminés) à la session de l'évaluation, ou à la formation si elle n'a pas de session.

create or replace function public._evaluation_display_status(p_status text, p_available timestamptz, p_due timestamptz)
returns text language sql stable as $$
  select case
    when p_status = 'draft' then 'draft'
    when p_status = 'archived' then 'completed'
    when p_due is not null and p_due <= now() then 'completed'
    when p_available is not null and p_available > now() then 'planned'
    else 'in_progress' end;
$$;

create or replace function public._evaluation_outcomes()
returns table (evaluation_id uuid, learner_id uuid, passed boolean)
language sql stable security definer set search_path = public as $$
  select a.evaluation_id, a.learner_id, bool_or(a.passed)
  from public.evaluation_attempts a where a.submitted_at is not null and a.passed is not null
  group by a.evaluation_id, a.learner_id
  union all
  select g.evaluation_id, g.learner_id, g.score_percent >= e.passing_score
  from public.evaluation_grades g join public.evaluations e on e.id = g.evaluation_id
  where not exists (select 1 from public.evaluation_attempts a where a.evaluation_id = g.evaluation_id and a.learner_id = g.learner_id and a.submitted_at is not null);
$$;
revoke execute on function public._evaluation_display_status(text, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public._evaluation_outcomes() from public, anon, authenticated;

create or replace function public.admin_evaluations_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
  res jsonb;
  ok integer; ko integer;
begin
  perform public._admin_only();
  select count(*) filter (where passed), count(*) filter (where not passed) into ok, ko from public._evaluation_outcomes();
  select jsonb_build_object(
    'total', jsonb_build_object('count', count(*), 'month', count(*) filter (where e.created_at >= cur), 'prev', count(*) filter (where e.created_at >= prev and e.created_at < cur)),
    'planned', jsonb_build_object('count', count(*) filter (where d = 'planned')),
    'in_progress', jsonb_build_object('count', count(*) filter (where d = 'in_progress')),
    'completed', jsonb_build_object('count', count(*) filter (where d = 'completed'),
      'month', count(*) filter (where d = 'completed' and e.created_at >= cur), 'prev', count(*) filter (where d = 'completed' and e.created_at >= prev and e.created_at < cur)),
    'failed', jsonb_build_object('count', ko, 'results', ok + ko),
    'success', jsonb_build_object('passed', ok, 'results', ok + ko)
  ) into res
  from (select e.*, public._evaluation_display_status(e.status, e.available_at, e.due_at) as d from public.evaluations e) e;
  return res;
end $$;

create or replace function public.admin_evaluations_options()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return jsonb_build_object(
    'courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title) order by c.title), '[]'::jsonb)
      from public.courses c where exists (select 1 from public.evaluations e where e.course_id = c.id)),
    'sessions', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'course_id', s.course_id) order by s.start_at desc), '[]'::jsonb)
      from public.sessions s where exists (select 1 from public.evaluations e where e.session_id = s.id)));
end $$;

create or replace function public._evaluation_filter_ids(p_q text, p_course uuid, p_session uuid, p_status text, p_from date, p_to date)
returns table (id uuid) language plpgsql stable security definer set search_path = public as $$
declare q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
begin
  return query
  select e.id from public.evaluations e join public.courses c on c.id = e.course_id
  where (q = '' or e.title ilike '%' || q || '%' or c.title ilike '%' || q || '%')
    and (p_course is null or e.course_id = p_course)
    and (p_session is null or e.session_id = p_session)
    and (coalesce(p_status, '') = '' or public._evaluation_display_status(e.status, e.available_at, e.due_at) = p_status)
    and (p_from is null or coalesce(e.available_at, e.due_at, e.created_at) >= p_from::timestamptz)
    and (p_to is null or coalesce(e.available_at, e.due_at, e.created_at) < (p_to + 1)::timestamptz);
end $$;
revoke execute on function public._evaluation_filter_ids(text, uuid, uuid, text, date, date) from public, anon, authenticated;

-- p_status : draft | planned | in_progress | completed ; p_sort : recent (défaut) | old
create or replace function public.admin_list_evaluations(
  p_q text default '', p_course uuid default null, p_session uuid default null, p_status text default '',
  p_from date default null, p_to date default null, p_sort text default 'recent', p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  total integer;
  rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*) into total from public._evaluation_filter_ids(p_q, p_course, p_session, p_status, p_from, p_to);

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by
        case when p_sort = 'old' then coalesce(e.available_at, e.due_at, e.created_at) end asc,
        case when p_sort <> 'old' then coalesce(e.available_at, e.due_at, e.created_at) end desc, e.id) as ord,
      e.id, e.title, e.kind, e.status as raw_status, e.available_at, e.due_at, e.passing_score,
      public._evaluation_display_status(e.status, e.available_at, e.due_at) as display_status,
      (select count(*) from public.evaluation_questions q where q.evaluation_id = e.id) as questions,
      c.id as course_id, c.title as course_title, s.title as session_title, coalesce(s.timezone, 'Africa/Abidjan') as timezone,
      (select count(distinct en.learner_id) from public.enrollments en
         where en.course_id = e.course_id and en.status in ('confirmed', 'completed') and (e.session_id is null or en.session_id = e.session_id)) as participants,
      (select count(*) from public._evaluation_outcomes() o where o.evaluation_id = e.id) as results,
      (select count(*) from public._evaluation_outcomes() o where o.evaluation_id = e.id and o.passed) as passed
    from public.evaluations e join public._evaluation_filter_ids(p_q, p_course, p_session, p_status, p_from, p_to) f on f.id = e.id
    join public.courses c on c.id = e.course_id left join public.sessions s on s.id = e.session_id
    order by ord
    limit p_limit offset p_offset
  ) t;

  return jsonb_build_object('total', total, 'rows', rows);
end $$;

-- Publie, repasse en brouillon (impossible dès qu'un résultat existe) ou archive une évaluation
create or replace function public.admin_set_evaluation_status(p_evaluation uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  perform public._admin_only();
  if p_status not in ('draft', 'published', 'archived') then raise exception 'status_invalid'; end if;
  select status into cur from public.evaluations where id = p_evaluation;
  if cur is null then raise exception 'evaluation_not_found'; end if;
  if p_status = 'draft' and (exists (select 1 from public.evaluation_attempts where evaluation_id = p_evaluation)
                              or exists (select 1 from public.evaluation_grades where evaluation_id = p_evaluation)) then
    raise exception 'evaluation_has_results';
  end if;
  update public.evaluations set status = p_status where id = p_evaluation;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'evaluation.' || p_status, 'evaluation', p_evaluation::text, jsonb_build_object('from', cur));
end $$;

revoke execute on function public.admin_evaluations_stats() from public, anon;
revoke execute on function public.admin_evaluations_options() from public, anon;
revoke execute on function public.admin_list_evaluations(text, uuid, uuid, text, date, date, text, integer, integer) from public, anon;
revoke execute on function public.admin_set_evaluation_status(uuid, text) from public, anon;
grant execute on function public.admin_evaluations_stats() to authenticated;
grant execute on function public.admin_evaluations_options() to authenticated;
grant execute on function public.admin_list_evaluations(text, uuid, uuid, text, date, date, text, integer, integer) to authenticated;
grant execute on function public.admin_set_evaluation_status(uuid, text) to authenticated;
