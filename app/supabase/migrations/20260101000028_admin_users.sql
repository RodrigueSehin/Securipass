-- Lot 4 : gestion des utilisateurs par l'administration.
--  - liste filtrable avec dernière connexion (lue dans auth.users, inaccessible depuis l'API) et organisation ;
--  - indicateurs par profil avec évolution mensuelle ;
--  - changement des rôles et suspension d'un compte, tracés dans le journal d'audit.

create or replace function public._admin_only()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_role('admin') then raise exception 'forbidden'; end if;
end $$;
revoke execute on function public._admin_only() from public, anon, authenticated;

create or replace function public.admin_users_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
  res jsonb := '{}'::jsonb;
  rc text;
begin
  perform public._admin_only();
  res := jsonb_build_object('total', jsonb_build_object(
    'count', (select count(*) from public.profiles),
    'month', (select count(*) from public.profiles where created_at >= cur),
    'prev', (select count(*) from public.profiles where created_at >= prev and created_at < cur)));
  foreach rc in array array['learner','instructor','company','admin'] loop
    res := res || jsonb_build_object(rc, jsonb_build_object(
      'count', (select count(distinct ur.user_id) from public.user_roles ur join public.roles r on r.id = ur.role_id where r.code = rc),
      'month', (select count(distinct ur.user_id) from public.user_roles ur join public.roles r on r.id = ur.role_id join public.profiles p on p.id = ur.user_id where r.code = rc and p.created_at >= cur),
      'prev', (select count(distinct ur.user_id) from public.user_roles ur join public.roles r on r.id = ur.role_id join public.profiles p on p.id = ur.user_id where r.code = rc and p.created_at >= prev and p.created_at < cur)));
  end loop;
  return res;
end $$;

create or replace function public.admin_list_users(
  p_q text default '', p_role text default '', p_status text default '', p_period text default '',
  p_asc boolean default false, p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
  since timestamptz := case p_period
    when '7d' then now() - interval '7 days' when '30d' then now() - interval '30 days'
    when '90d' then now() - interval '90 days' when '365d' then now() - interval '365 days' end;
  total integer;
  rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*) into total from public.profiles p
    where (q = '' or p.full_name ilike '%' || q || '%' or p.email ilike '%' || q || '%' or coalesce(p.phone, '') ilike '%' || q || '%')
      and (coalesce(p_status, '') = '' or p.status = p_status)
      and (since is null or p.created_at >= since)
      and (coalesce(p_role, '') = '' or exists (
        select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p.id and r.code = p_role));

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by case when p_asc then t.created_at end asc, case when not p_asc then t.created_at end desc), '[]'::jsonb) into rows
  from (
    select p.id, p.full_name, p.email, p.phone, p.avatar_url, p.status, p.created_at,
      (select u.last_sign_in_at from auth.users u where u.id = p.id) as last_sign_in_at,
      (select coalesce(jsonb_agg(r.code order by array_position(array['admin','instructor','company','pedagogy_manager','certification_manager','support','learner'], r.code)), '[]'::jsonb)
         from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p.id) as roles,
      (select o.name from public.organization_members m join public.organizations o on o.id = m.organization_id
         where m.user_id = p.id and m.status = 'active' order by m.id limit 1) as organization
    from public.profiles p
    where (q = '' or p.full_name ilike '%' || q || '%' or p.email ilike '%' || q || '%' or coalesce(p.phone, '') ilike '%' || q || '%')
      and (coalesce(p_status, '') = '' or p.status = p_status)
      and (since is null or p.created_at >= since)
      and (coalesce(p_role, '') = '' or exists (
        select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p.id and r.code = p_role))
    order by case when p_asc then p.created_at end asc, case when not p_asc then p.created_at end desc, p.id
    limit p_limit offset p_offset
  ) t;

  return jsonb_build_object('total', total, 'rows', rows);
end $$;

-- Remplace l'ensemble des rôles d'un compte. Garde-fous : un administrateur ne retire pas son propre rôle d'administrateur,
-- et un compte garde toujours au moins un rôle.
create or replace function public.admin_set_user_roles(p_user uuid, p_roles text[])
returns void language plpgsql security definer set search_path = public as $$
declare codes text[]; unknown_count integer;
begin
  perform public._admin_only();
  select coalesce(array_agg(distinct c), '{}') into codes from unnest(coalesce(p_roles, '{}')) c;
  if cardinality(codes) = 0 then raise exception 'roles_required'; end if;
  select count(*) into unknown_count from unnest(codes) c where not exists (select 1 from public.roles r where r.code = c);
  if unknown_count > 0 then raise exception 'role_unknown'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'user_not_found'; end if;
  if p_user = auth.uid() and not ('admin' = any(codes)) then raise exception 'cannot_demote_self'; end if;

  delete from public.user_roles where user_id = p_user and role_id not in (select id from public.roles where code = any(codes));
  insert into public.user_roles (user_id, role_id, assigned_by)
    select p_user, r.id, auth.uid() from public.roles r where r.code = any(codes)
    on conflict (user_id, role_id) do nothing;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'user.roles', 'user', p_user::text, jsonb_build_object('roles', codes));
end $$;

create or replace function public.admin_set_user_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._admin_only();
  if p_status not in ('active', 'suspended') then raise exception 'status_invalid'; end if;
  if p_user = auth.uid() then raise exception 'cannot_suspend_self'; end if;
  update public.profiles set status = p_status where id = p_user;
  if not found then raise exception 'user_not_found'; end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_status = 'suspended' then 'user.suspend' else 'user.reactivate' end, 'user', p_user::text, '{}'::jsonb);
end $$;

revoke execute on function public.admin_users_stats() from public, anon;
revoke execute on function public.admin_list_users(text, text, text, text, boolean, integer, integer) from public, anon;
revoke execute on function public.admin_set_user_roles(uuid, text[]) from public, anon;
revoke execute on function public.admin_set_user_status(uuid, text) from public, anon;
grant execute on function public.admin_users_stats() to authenticated;
grant execute on function public.admin_list_users(text, text, text, text, boolean, integer, integer) to authenticated;
grant execute on function public.admin_set_user_roles(uuid, text[]) to authenticated;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;
