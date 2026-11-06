-- Lot 4 : gestion des entreprises clientes par l'administration.
--  - statut « en attente » (validation du compte entreprise) ;
--  - liste filtrable : contact principal, secteur, apprenants, formations, statut, date d'inscription ;
--  - indicateurs : total, actives, en cours de formation, formations terminées, nouvelles ;
--  - changement de statut tracé dans le journal d'audit.

alter table public.organizations drop constraint if exists organizations_status_check;
alter table public.organizations add constraint organizations_status_check check (status in ('active','pending','suspended'));

create or replace function public.admin_companies_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
begin
  perform public._admin_only();
  return jsonb_build_object(
    'total', jsonb_build_object(
      'count', (select count(*) from public.organizations),
      'month', (select count(*) from public.organizations where created_at >= cur),
      'prev', (select count(*) from public.organizations where created_at >= prev and created_at < cur)),
    'active', jsonb_build_object(
      'count', (select count(*) from public.organizations where status = 'active'),
      'month', (select count(*) from public.organizations where status = 'active' and created_at >= cur),
      'prev', (select count(*) from public.organizations where status = 'active' and created_at >= prev and created_at < cur)),
    'in_training', jsonb_build_object(
      'companies', (select count(distinct e.organization_id) from public.enrollments e where e.organization_id is not null and e.status = 'confirmed'),
      'learners', (select count(distinct e.learner_id) from public.enrollments e where e.organization_id is not null and e.status = 'confirmed')),
    'completed', jsonb_build_object(
      'count', (select count(*) from public.enrollments e where e.organization_id is not null and e.status = 'completed'),
      'month', (select count(*) from public.enrollments e where e.organization_id is not null and e.status = 'completed' and e.completed_at >= cur),
      'prev', (select count(*) from public.enrollments e where e.organization_id is not null and e.status = 'completed' and e.completed_at >= prev and e.completed_at < cur),
      'rating_avg', (select round(avg(rv.rating)::numeric, 1) from public.course_reviews rv
         where exists (select 1 from public.enrollments e where e.organization_id is not null and e.learner_id = rv.learner_id and e.course_id = rv.course_id))),
    'new', jsonb_build_object(
      'month', (select count(*) from public.organizations where created_at >= cur),
      'prev', (select count(*) from public.organizations where created_at >= prev and created_at < cur)));
end $$;

-- Valeurs proposées dans les filtres « Secteur » et « Ville »
create or replace function public.admin_companies_options()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return jsonb_build_object(
    'industries', (select coalesce(jsonb_agg(v order by v), '[]'::jsonb) from (select distinct btrim(industry) v from public.organizations where btrim(coalesce(industry, '')) <> '') s),
    'cities', (select coalesce(jsonb_agg(v order by v), '[]'::jsonb) from (select distinct btrim(city) v from public.organizations where btrim(coalesce(city, '')) <> '') s));
end $$;

create or replace function public._company_filter_ids(p_q text, p_industry text, p_status text, p_city text)
returns table (id uuid) language sql stable security definer set search_path = public as $$
  select o.id from public.organizations o
  where (p_q = '' or o.name ilike '%' || p_q || '%' or coalesce(o.industry, '') ilike '%' || p_q || '%' or coalesce(o.city, '') ilike '%' || p_q || '%'
         or exists (select 1 from public.organization_members m join public.profiles p on p.id = m.user_id
                    where m.organization_id = o.id and (p.full_name ilike '%' || p_q || '%' or p.email ilike '%' || p_q || '%')))
    and (coalesce(p_industry, '') = '' or o.industry = p_industry)
    and (coalesce(p_status, '') = '' or o.status = p_status)
    and (coalesce(p_city, '') = '' or o.city = p_city);
$$;
revoke execute on function public._company_filter_ids(text, text, text, text) from public, anon, authenticated;

-- p_sort : 'recent' (défaut), 'old', 'status'
create or replace function public.admin_list_companies(
  p_q text default '', p_industry text default '', p_status text default '', p_city text default '',
  p_sort text default 'recent', p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
  total integer;
  rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*) into total from public._company_filter_ids(q, p_industry, p_status, p_city);

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by
        case when p_sort = 'old' then o.created_at end asc,
        case when p_sort = 'status' then array_position(array['active','pending','suspended'], o.status) end asc,
        case when p_sort not in ('old') then o.created_at end desc, o.id) as ord,
      o.id, o.name, o.industry, o.city, o.status, o.created_at,
      c.full_name as contact_name, c.email as contact_email, c.phone as contact_phone,
      (select count(*) from (
          select e.learner_id from public.enrollments e where e.organization_id = o.id
          union
          select m.user_id from public.organization_members m where m.organization_id = o.id and m.status = 'active' and m.role = 'member') l) as learners,
      (select count(distinct e.course_id) from public.enrollments e where e.organization_id = o.id) as courses
    from public._company_filter_ids(q, p_industry, p_status, p_city) f
    join public.organizations o on o.id = f.id
    left join lateral (
      select p.full_name, p.email, p.phone from public.organization_members m join public.profiles p on p.id = m.user_id
      where m.organization_id = o.id and m.status = 'active'
      order by array_position(array['owner','manager','member'], m.role), m.id limit 1) c on true
    order by ord
    limit p_limit offset p_offset
  ) t;

  return jsonb_build_object('total', total, 'rows', rows);
end $$;

create or replace function public.admin_set_company_status(p_org uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._admin_only();
  if p_status not in ('active', 'pending', 'suspended') then raise exception 'status_invalid'; end if;
  update public.organizations set status = p_status where id = p_org;
  if not found then raise exception 'company_not_found'; end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'company.status', 'organization', p_org::text, jsonb_build_object('status', p_status));
end $$;

revoke execute on function public.admin_companies_stats() from public, anon;
revoke execute on function public.admin_companies_options() from public, anon;
revoke execute on function public.admin_list_companies(text, text, text, text, text, integer, integer) from public, anon;
revoke execute on function public.admin_set_company_status(uuid, text) from public, anon;
grant execute on function public.admin_companies_stats() to authenticated;
grant execute on function public.admin_companies_options() to authenticated;
grant execute on function public.admin_list_companies(text, text, text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_set_company_status(uuid, text) to authenticated;
