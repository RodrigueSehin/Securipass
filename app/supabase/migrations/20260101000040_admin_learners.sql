-- Lot 4 : gestion des apprenants par l'administration.
--  - matricule APP-AAAA-NNN attribué à chaque apprenant (rétro-rempli) ;
--  - liste : contact, entreprise, formation principale et progression, statut, date d'inscription ;
--  - indicateurs : totaux, actifs, en formation, certifiés, inactifs.
-- Formation principale : l'inscription en cours (validée), sinon en attente, sinon terminée ; les annulées et expirées sont ignorées.
-- Statut affiché : training (en formation) | certified (certificat valide) | completed (terminé sans certificat) | pending (en attente) | none (sans inscription).
-- « Inactif » = compte suspendu ou en demande de suppression.

create sequence public.learner_code_seq;
alter table public.profiles add column learner_code text;

update public.profiles p set learner_code = 'APP-' || to_char(p.created_at, 'YYYY') || '-' || lpad(n.rn::text, 3, '0')
from (
  select ur.user_id as id, nextval('public.learner_code_seq') as rn
  from (select ur.user_id, pr.created_at from public.user_roles ur
          join public.roles r on r.id = ur.role_id and r.code = 'learner'
          join public.profiles pr on pr.id = ur.user_id order by pr.created_at, ur.user_id) ur
) n
where n.id = p.id;
create unique index profiles_learner_code_key on public.profiles (learner_code) where learner_code is not null;

create or replace function public._assign_learner_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.roles r where r.id = new.role_id and r.code = 'learner') then
    update public.profiles set learner_code = 'APP-' || to_char(created_at, 'YYYY') || '-' || lpad(nextval('public.learner_code_seq')::text, 3, '0')
    where id = new.user_id and learner_code is null;
  end if;
  return new;
end $$;
create trigger user_roles_learner_code after insert on public.user_roles
  for each row execute function public._assign_learner_code();

-- Progression : contenus publiés comptés dans la progression, terminés par l'apprenant
create or replace function public._learner_progress(p_learner uuid, p_course uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(round(100.0 * count(cc.content_id) / nullif(count(*), 0))::integer, 0)
  from public.learning_contents lc
  join public.course_modules m on m.id = lc.module_id and m.course_id = p_course
  left join public.content_completions cc on cc.content_id = lc.id and cc.learner_id = p_learner
  where lc.status = 'published' and lc.counts_in_progress;
$$;

create or replace function public._learner_featured(p_learner uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select e.id from public.enrollments e
  where e.learner_id = p_learner and e.status not in ('cancelled', 'expired')
  order by case when e.status in ('confirmed', 'suspended') then 0 when e.status in ('pending_approval', 'pending_payment', 'waitlisted') then 1 else 2 end,
           e.enrolled_at desc
  limit 1;
$$;

create or replace function public._learner_display(p_learner uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when e.id is null then 'none'
    when e.status in ('confirmed', 'suspended') then 'training'
    when e.status = 'completed' then case when exists (select 1 from public.certificates c where c.enrollment_id = e.id and c.status = 'valid') then 'certified' else 'completed' end
    else 'pending' end
  from (select 1) x left join public.enrollments e on e.id = public._learner_featured(p_learner);
$$;

create or replace function public._is_learner(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id and r.code = 'learner' where ur.user_id = p_user);
$$;

-- p_tab : all | active | training | certified | inactive ; p_status : none | training | certified | completed | pending
create or replace function public._learner_filter_ids(p_q text, p_tab text, p_course uuid, p_org uuid, p_status text)
returns table (id uuid) language plpgsql stable security definer set search_path = public as $$
declare q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
begin
  return query
  select p.id from public.profiles p
  where public._is_learner(p.id)
    and (q = '' or p.full_name ilike '%' || q || '%' or p.email ilike '%' || q || '%' or coalesce(p.phone, '') ilike '%' || q || '%' or coalesce(p.learner_code, '') ilike '%' || q || '%')
    and (coalesce(p_tab, 'all') in ('all', '')
         or (p_tab = 'active' and p.status = 'active')
         or (p_tab = 'inactive' and p.status <> 'active')
         or (p_tab = 'training' and exists (select 1 from public.enrollments e where e.learner_id = p.id and e.status in ('confirmed', 'suspended')))
         or (p_tab = 'certified' and exists (select 1 from public.certificates c where c.learner_id = p.id and c.status = 'valid')))
    and (p_course is null or exists (select 1 from public.enrollments e where e.learner_id = p.id and e.course_id = p_course and e.status not in ('cancelled', 'expired')))
    and (p_org is null or exists (select 1 from public.organization_members m where m.user_id = p.id and m.organization_id = p_org and m.status = 'active'))
    and (coalesce(p_status, '') = '' or public._learner_display(p.id) = p_status);
end $$;

create or replace function public.admin_learners_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
  res jsonb;
begin
  perform public._admin_only();
  select jsonb_build_object(
    'total', jsonb_build_object('count', count(*), 'month', count(*) filter (where p.created_at >= cur), 'prev', count(*) filter (where p.created_at >= prev and p.created_at < cur)),
    'active', jsonb_build_object('count', count(*) filter (where p.status = 'active'),
      'month', count(*) filter (where p.status = 'active' and p.created_at >= cur), 'prev', count(*) filter (where p.status = 'active' and p.created_at >= prev and p.created_at < cur)),
    'inactive', jsonb_build_object('count', count(*) filter (where p.status <> 'active')),
    'training', jsonb_build_object(
      'count', (select count(distinct e.learner_id) from public.enrollments e where e.status in ('confirmed', 'suspended') and public._is_learner(e.learner_id)),
      'month', (select count(distinct e.learner_id) from public.enrollments e where e.status in ('confirmed', 'suspended') and e.enrolled_at >= cur and public._is_learner(e.learner_id)),
      'prev', (select count(distinct e.learner_id) from public.enrollments e where e.status in ('confirmed', 'suspended') and e.enrolled_at >= prev and e.enrolled_at < cur and public._is_learner(e.learner_id))),
    'certified', jsonb_build_object(
      'count', (select count(distinct c.learner_id) from public.certificates c where c.status = 'valid' and public._is_learner(c.learner_id)),
      'month', (select count(distinct c.learner_id) from public.certificates c where c.status = 'valid' and c.issued_at >= cur and public._is_learner(c.learner_id)),
      'prev', (select count(distinct c.learner_id) from public.certificates c where c.status = 'valid' and c.issued_at >= prev and c.issued_at < cur and public._is_learner(c.learner_id)))
  ) into res
  from public.profiles p where public._is_learner(p.id);
  return res;
end $$;

create or replace function public.admin_learners_options()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return jsonb_build_object(
    'courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title) order by c.title), '[]'::jsonb)
      from public.courses c where exists (select 1 from public.enrollments e where e.course_id = c.id)),
    'organizations', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) order by o.name), '[]'::jsonb)
      from public.organizations o where exists (select 1 from public.organization_members m where m.organization_id = o.id and m.status = 'active')));
end $$;

-- p_sort : recent (défaut) | old | name
create or replace function public.admin_list_learners(
  p_q text default '', p_tab text default 'all', p_course uuid default null, p_org uuid default null, p_status text default '',
  p_sort text default 'recent', p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare total integer; rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  select count(*) into total from public._learner_filter_ids(p_q, p_tab, p_course, p_org, p_status);

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by
        case when p_sort = 'old' then p.created_at end asc,
        case when p_sort = 'name' then lower(p.full_name) end asc,
        case when p_sort not in ('old', 'name') then p.created_at end desc, p.id) as ord,
      p.id, p.learner_code, p.full_name, p.avatar_url, p.email, p.phone, p.status as account_status, p.created_at,
      (select o.name from public.organization_members m join public.organizations o on o.id = m.organization_id
        where m.user_id = p.id and m.status = 'active' order by o.name limit 1) as organization,
      public._learner_display(p.id) as display_status,
      c.title as course_title, e.course_id,
      case when e.id is null then null when e.status = 'completed' then 100 else public._learner_progress(p.id, e.course_id) end as progress,
      (select count(*) from public.enrollments x where x.learner_id = p.id and x.status not in ('cancelled', 'expired')) as enrollments_count
    from public.profiles p
    join public._learner_filter_ids(p_q, p_tab, p_course, p_org, p_status) f on f.id = p.id
    left join public.enrollments e on e.id = public._learner_featured(p.id)
    left join public.courses c on c.id = e.course_id
    order by ord
    limit p_limit offset p_offset
  ) t;

  return jsonb_build_object('total', total, 'rows', rows);
end $$;

revoke execute on function public._learner_progress(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._learner_featured(uuid) from public, anon, authenticated;
revoke execute on function public._learner_display(uuid) from public, anon, authenticated;
revoke execute on function public._is_learner(uuid) from public, anon, authenticated;
revoke execute on function public._learner_filter_ids(text, text, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_learners_stats() from public, anon;
revoke execute on function public.admin_learners_options() from public, anon;
revoke execute on function public.admin_list_learners(text, text, uuid, uuid, text, text, integer, integer) from public, anon;
grant execute on function public.admin_learners_stats() to authenticated;
grant execute on function public.admin_learners_options() to authenticated;
grant execute on function public.admin_list_learners(text, text, uuid, uuid, text, text, integer, integer) to authenticated;
