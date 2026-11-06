-- Lot 4 : gestion des formateurs par l'administration.
--  - type de contrat (interne / externe), propre à l'administration ;
--  - liste filtrable : spécialités (catégories des formations), formations, apprenants, note moyenne, date d'ajout ;
--  - indicateurs : total, actifs, en mission (session en cours), spécialités couvertes, note moyenne.

create table public.trainer_contracts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  contract_type text not null check (contract_type in ('internal','external')),
  updated_at timestamptz not null default now()
);
alter table public.trainer_contracts enable row level security;
create policy trainer_contracts_admin_all on public.trainer_contracts for all
  using (public.has_role('admin')) with check (public.has_role('admin'));

create or replace function public._trainer_filter_ids(p_q text, p_category uuid, p_status text, p_contract text)
returns table (id uuid) language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.role_id = (select r.id from public.roles r where r.code = 'instructor')
  where (p_q = '' or p.full_name ilike '%' || p_q || '%' or p.email ilike '%' || p_q || '%' or coalesce(p.phone, '') ilike '%' || p_q || '%'
         or exists (select 1 from public.courses c join public.categories k on k.id = c.category_id where c.instructor_id = p.id and k.name ilike '%' || p_q || '%'))
    and (coalesce(p_status, '') = '' or p.status = p_status)
    and (p_category is null or exists (select 1 from public.courses c where c.instructor_id = p.id and c.category_id = p_category and c.status <> 'archived'))
    and (coalesce(p_contract, '') = '' or coalesce((select tc.contract_type from public.trainer_contracts tc where tc.user_id = p.id), 'external') = p_contract);
$$;
revoke execute on function public._trainer_filter_ids(text, uuid, text, text) from public, anon, authenticated;

create or replace function public.admin_trainers_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
  rid smallint := (select r.id from public.roles r where r.code = 'instructor');
begin
  perform public._admin_only();
  return jsonb_build_object(
    'total', jsonb_build_object(
      'count', (select count(*) from public.user_roles where role_id = rid),
      'month', (select count(*) from public.user_roles where role_id = rid and assigned_at >= cur),
      'prev', (select count(*) from public.user_roles where role_id = rid and assigned_at >= prev and assigned_at < cur)),
    'active', jsonb_build_object(
      'count', (select count(*) from public.user_roles ur join public.profiles p on p.id = ur.user_id where ur.role_id = rid and p.status = 'active'),
      'month', (select count(*) from public.user_roles ur join public.profiles p on p.id = ur.user_id where ur.role_id = rid and p.status = 'active' and ur.assigned_at >= cur),
      'prev', (select count(*) from public.user_roles ur join public.profiles p on p.id = ur.user_id where ur.role_id = rid and p.status = 'active' and ur.assigned_at >= prev and ur.assigned_at < cur)),
    'on_mission', (select count(distinct s.instructor_id) from public.sessions s
      where s.status <> 'cancelled' and s.start_at <= now() and s.end_at >= now()),
    'specialties', (select count(distinct c.category_id) from public.courses c
      join public.user_roles ur on ur.user_id = c.instructor_id and ur.role_id = rid
      where c.category_id is not null and c.status <> 'archived'),
    'rating_avg', (select round(avg(rv.rating)::numeric, 1) from public.course_reviews rv
      join public.courses c on c.id = rv.course_id join public.user_roles ur on ur.user_id = c.instructor_id and ur.role_id = rid),
    'rating_count', (select count(*) from public.course_reviews rv
      join public.courses c on c.id = rv.course_id join public.user_roles ur on ur.user_id = c.instructor_id and ur.role_id = rid));
end $$;

-- p_sort : 'recent' (défaut), 'old', 'rating_desc', 'rating_asc'
create or replace function public.admin_list_trainers(
  p_q text default '', p_category uuid default null, p_status text default '', p_contract text default '',
  p_sort text default 'recent', p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
  rid smallint := (select r.id from public.roles r where r.code = 'instructor');
  total integer;
  rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  select count(*) into total from public._trainer_filter_ids(q, p_category, p_status, p_contract);

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by
        case when p_sort = 'old' then ur.assigned_at end asc,
        case when p_sort = 'rating_asc' then (select avg(rv.rating) from public.course_reviews rv join public.courses c on c.id = rv.course_id where c.instructor_id = p.id) end asc nulls last,
        case when p_sort = 'rating_desc' then (select avg(rv.rating) from public.course_reviews rv join public.courses c on c.id = rv.course_id where c.instructor_id = p.id) end desc nulls last,
        case when p_sort not in ('old', 'rating_asc', 'rating_desc') then ur.assigned_at end desc, p.id) as ord,
      p.id, p.full_name, p.email, p.phone, p.avatar_url, p.status,
      ur.assigned_at as added_at,
      coalesce((select tc.contract_type from public.trainer_contracts tc where tc.user_id = p.id), 'external') as contract_type,
      (select coalesce(jsonb_agg(k.name order by k.name), '[]'::jsonb) from public.categories k
         where k.id in (select c.category_id from public.courses c where c.instructor_id = p.id and c.status <> 'archived' and c.category_id is not null)) as specialties,
      (select count(*) from public.courses c where c.instructor_id = p.id and c.status <> 'archived') as courses,
      (select count(distinct e.learner_id) from public.enrollments e join public.courses c on c.id = e.course_id
         where c.instructor_id = p.id and e.status in ('confirmed','completed')) as learners,
      (select round(avg(rv.rating)::numeric, 1) from public.course_reviews rv join public.courses c on c.id = rv.course_id where c.instructor_id = p.id) as rating,
      (select count(*) from public.course_reviews rv join public.courses c on c.id = rv.course_id where c.instructor_id = p.id) as reviews
    from public._trainer_filter_ids(q, p_category, p_status, p_contract) f
    join public.profiles p on p.id = f.id
    join public.user_roles ur on ur.user_id = p.id and ur.role_id = rid
    order by ord
    limit p_limit offset p_offset
  ) t;

  return jsonb_build_object('total', total, 'rows', rows);
end $$;

create or replace function public.admin_set_trainer_contract(p_user uuid, p_contract text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._admin_only();
  if p_contract not in ('internal', 'external') then raise exception 'contract_invalid'; end if;
  if not exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p_user and r.code = 'instructor') then
    raise exception 'user_not_found';
  end if;
  insert into public.trainer_contracts (user_id, contract_type) values (p_user, p_contract)
    on conflict (user_id) do update set contract_type = excluded.contract_type, updated_at = now();
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'trainer.contract', 'user', p_user::text, jsonb_build_object('contract', p_contract));
end $$;

revoke execute on function public.admin_trainers_stats() from public, anon;
revoke execute on function public.admin_list_trainers(text, uuid, text, text, text, integer, integer) from public, anon;
revoke execute on function public.admin_set_trainer_contract(uuid, text) from public, anon;
grant execute on function public.admin_trainers_stats() to authenticated;
grant execute on function public.admin_list_trainers(text, uuid, text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_set_trainer_contract(uuid, text) to authenticated;
