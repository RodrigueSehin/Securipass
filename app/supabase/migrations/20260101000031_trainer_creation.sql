-- Lot 4 : création d'un formateur par l'administration.
--  - fiche du formateur (expérience, ville, biographie, spécialités, compétences, diplômes) ajoutée à trainer_contracts ;
--  - formations que le formateur est autorisé à animer ;
--  - les spécialités affichées et filtrées regroupent les catégories de ses formations et celles de sa fiche.

alter table public.trainer_contracts
  add column experience_years smallint check (experience_years is null or experience_years between 0 and 60),
  add column city text check (city is null or char_length(city) between 2 and 120),
  add column bio text check (bio is null or char_length(bio) between 10 and 500),
  add column main_category_id uuid references public.categories(id) on delete set null,
  add column extra_category_ids uuid[] not null default '{}' check (cardinality(extra_category_ids) <= 10),
  add column skills text[] not null default '{}' check (cardinality(skills) <= 10),
  add column diplomas text[] not null default '{}' check (cardinality(diplomas) <= 10);

create table public.trainer_courses (
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  primary key (trainer_id, course_id)
);
create index on public.trainer_courses (course_id);
alter table public.trainer_courses enable row level security;
create policy trainer_courses_admin_all on public.trainer_courses for all
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- Catégories d'un formateur : formations non archivées + fiche (spécialité principale et autres)
create or replace function public._trainer_category_ids(p_user uuid)
returns table (category_id uuid) language sql stable security definer set search_path = public as $$
  select c.category_id from public.courses c where c.instructor_id = p_user and c.status <> 'archived' and c.category_id is not null
  union
  select tc.main_category_id from public.trainer_contracts tc where tc.user_id = p_user and tc.main_category_id is not null
  union
  select unnest(tc.extra_category_ids) from public.trainer_contracts tc where tc.user_id = p_user;
$$;
revoke execute on function public._trainer_category_ids(uuid) from public, anon, authenticated;

create or replace function public._trainer_filter_ids(p_q text, p_category uuid, p_status text, p_contract text)
returns table (id uuid) language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.role_id = (select r.id from public.roles r where r.code = 'instructor')
  where (p_q = '' or p.full_name ilike '%' || p_q || '%' or p.email ilike '%' || p_q || '%' or coalesce(p.phone, '') ilike '%' || p_q || '%'
         or exists (select 1 from public._trainer_category_ids(p.id) tcat join public.categories k on k.id = tcat.category_id where k.name ilike '%' || p_q || '%'))
    and (coalesce(p_status, '') = '' or p.status = p_status)
    and (p_category is null or exists (select 1 from public._trainer_category_ids(p.id) tcat where tcat.category_id = p_category))
    and (coalesce(p_contract, '') = '' or coalesce((select tc.contract_type from public.trainer_contracts tc where tc.user_id = p.id), 'external') = p_contract);
$$;
revoke execute on function public._trainer_filter_ids(text, uuid, text, text) from public, anon, authenticated;

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
         where k.id in (select tcat.category_id from public._trainer_category_ids(p.id) tcat)) as specialties,
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
