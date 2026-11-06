-- Lot 4 : gestion des catégories de formations par l'administration.
--  - statut (active / en attente / inactive), date de création, icône et couleur d'affichage ;
--  - seules les catégories actives sont visibles du public (le personnel voit tout) ;
--  - liste filtrable avec nombre de formations et d'apprenants, indicateurs, changement de statut tracé.

alter table public.categories
  add column status text not null default 'active' check (status in ('active','pending','inactive')),
  add column created_at timestamptz not null default now(),
  add column icon text not null default 'folder' check (char_length(icon) between 2 and 30),
  add column color text not null default 'blue' check (char_length(color) between 2 and 20);

create index on public.categories (status);

update public.categories set icon = 'shield', color = 'purple' where slug = 'securite-privee';
update public.categories set icon = 'cross', color = 'green' where slug = 'secourisme';
update public.categories set icon = 'flame', color = 'red' where slug = 'securite-incendie';
update public.categories set icon = 'triangle-alert', color = 'orange' where slug = 'prevention-risques';
update public.categories set icon = 'siren', color = 'amber' where slug = 'situations-urgence';

drop policy categories_public_read on public.categories;
create policy categories_public_read on public.categories for select
  using (status = 'active' or public.is_staff());

create or replace function public.admin_categories_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
begin
  perform public._admin_only();
  return jsonb_build_object(
    'categories', jsonb_build_object(
      'count', (select count(*) from public.categories),
      'month', (select count(*) from public.categories where created_at >= cur),
      'prev', (select count(*) from public.categories where created_at >= prev and created_at < cur)),
    'courses', jsonb_build_object(
      'count', (select count(*) from public.courses where category_id is not null and status <> 'archived'),
      'month', (select count(*) from public.courses where category_id is not null and status <> 'archived' and created_at >= cur),
      'prev', (select count(*) from public.courses where category_id is not null and status <> 'archived' and created_at >= prev and created_at < cur),
      'categories', (select count(distinct category_id) from public.courses where category_id is not null and status <> 'archived')),
    'learners', jsonb_build_object(
      'count', (select count(distinct e.learner_id) from public.enrollments e join public.courses c on c.id = e.course_id
                where c.category_id is not null and e.status in ('confirmed','completed')),
      'month', (select count(distinct e.learner_id) from public.enrollments e join public.courses c on c.id = e.course_id
                where c.category_id is not null and e.status in ('confirmed','completed') and e.enrolled_at >= cur),
      'prev', (select count(distinct e.learner_id) from public.enrollments e join public.courses c on c.id = e.course_id
                where c.category_id is not null and e.status in ('confirmed','completed') and e.enrolled_at >= prev and e.enrolled_at < cur)),
    'inactive', (select count(*) from public.categories where status = 'inactive'));
end $$;

-- p_sort : 'recent' (défaut), 'old', 'name_asc', 'name_desc', 'courses_desc', 'learners_desc'
create or replace function public.admin_list_categories(
  p_q text default '', p_status text default '', p_sort text default 'recent', p_limit integer default 20, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
  total integer;
  rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 20), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*) into total from public.categories k
    where (q = '' or k.name ilike '%' || q || '%' or coalesce(k.description, '') ilike '%' || q || '%')
      and (coalesce(p_status, '') = '' or k.status = p_status);

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by
        case when p_sort = 'old' then s.created_at end asc,
        case when p_sort = 'name_asc' then s.name end asc,
        case when p_sort = 'name_desc' then s.name end desc,
        case when p_sort = 'courses_desc' then s.courses end desc,
        case when p_sort = 'learners_desc' then s.learners end desc,
        case when p_sort not in ('old', 'name_asc', 'name_desc', 'courses_desc', 'learners_desc') then s.created_at end desc, s.id) as ord,
      s.*
    from (
      select k.id, k.name, k.slug, k.description, k.status, k.created_at, k.icon, k.color,
        (select count(*) from public.courses c where c.category_id = k.id and c.status <> 'archived') as courses,
        (select count(distinct e.learner_id) from public.enrollments e join public.courses c on c.id = e.course_id
           where c.category_id = k.id and e.status in ('confirmed','completed')) as learners
      from public.categories k
      where (q = '' or k.name ilike '%' || q || '%' or coalesce(k.description, '') ilike '%' || q || '%')
        and (coalesce(p_status, '') = '' or k.status = p_status)
    ) s
    order by ord
    limit p_limit offset p_offset
  ) t;

  return jsonb_build_object('total', total, 'rows', rows);
end $$;

create or replace function public.admin_set_category_status(p_category uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._admin_only();
  if p_status not in ('active', 'pending', 'inactive') then raise exception 'status_invalid'; end if;
  update public.categories set status = p_status where id = p_category;
  if not found then raise exception 'category_not_found'; end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'category.status', 'category', p_category::text, jsonb_build_object('status', p_status));
end $$;

revoke execute on function public.admin_categories_stats() from public, anon;
revoke execute on function public.admin_list_categories(text, text, text, integer, integer) from public, anon;
revoke execute on function public.admin_set_category_status(uuid, text) from public, anon;
grant execute on function public.admin_categories_stats() to authenticated;
grant execute on function public.admin_list_categories(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_set_category_status(uuid, text) to authenticated;
