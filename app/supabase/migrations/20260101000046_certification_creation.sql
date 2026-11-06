-- Lot 4 : création complète d'une certification (rattrapage de la migration 45 si elle était déjà appliquée).
-- Idempotente : ajoute les colonnes, remplace les fonctions de liste/options et crée le bucket du visuel.

alter table public.certifications
  add column if not exists category_id uuid references public.categories(id),
  add column if not exists level text check (level is null or level in ('beginner', 'intermediate', 'professional', 'expert')),
  add column if not exists description text check (description is null or char_length(description) <= 500),
  add column if not exists cover_url text check (cover_url is null or cover_url ~ '^https://'),
  add column if not exists evaluation_type text not null default 'qcm' check (evaluation_type in ('qcm', 'practical', 'qcm_practical', 'continuous')),
  add column if not exists passing_score integer not null default 70 check (passing_score between 0 and 100),
  add column if not exists max_attempts integer not null default 2 check (max_attempts between 1 and 10),
  add column if not exists delivery_mode text not null default 'automatic' check (delivery_mode in ('automatic', 'manual')),
  add column if not exists auto_pdf boolean not null default true,
  add column if not exists template_id uuid references public.certificate_templates(id),
  add column if not exists number_prefix text check (number_prefix is null or number_prefix ~ '^[A-Z0-9]{2,10}$'),
  add column if not exists show_public boolean not null default true,
  add column if not exists allow_verification boolean not null default true,
  add column if not exists require_proof boolean not null default false;

update public.certifications x set category_id = c.category_id from public.courses c where c.id = x.course_id and x.category_id is null;

create or replace function public.admin_certifications_options()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name) order by k.name), '[]'::jsonb)
      from public.categories k where exists (select 1 from public.certifications x join public.courses c on c.id = x.course_id where coalesce(x.category_id, c.category_id) = k.id)),
    'all_categories', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name) order by k.name), '[]'::jsonb) from public.categories k where k.status = 'active'),
    'templates', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'title', t.title) order by t.name), '[]'::jsonb) from public.certificate_templates t where t.status = 'published'),
    'courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'validity_months', c.certificate_validity_months) order by c.title), '[]'::jsonb)
      from public.courses c where c.status = 'published' and not exists (select 1 from public.certifications x where x.course_id = c.id)));
end $$;

create or replace function public._certification_filter_ids(p_q text, p_category uuid, p_status text, p_tab text)
returns table (id uuid) language plpgsql stable security definer set search_path = public as $$
declare q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
begin
  return query
  select x.id from public.certifications x join public.courses c on c.id = x.course_id
  where (q = '' or x.name ilike '%' || q || '%' or x.code ilike '%' || q || '%' or c.title ilike '%' || q || '%')
    and (p_category is null or coalesce(x.category_id, c.category_id) = p_category)
    and (coalesce(p_status, '') = '' or x.status = p_status)
    and (coalesce(p_tab, '') in ('', 'all') or (p_tab = 'active' and x.status = 'active') or (p_tab = 'inactive' and x.status <> 'active'));
end $$;

create or replace function public.admin_list_certifications(
  p_q text default '', p_category uuid default null, p_status text default '', p_tab text default 'all', p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare total integer; rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  select count(*) into total from public._certification_filter_ids(p_q, p_category, p_status, p_tab);
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by x.created_at, x.id) as ord, x.id, x.name, x.code, x.status, x.validity_months, x.created_at,
      c.id as course_id, c.title as course_title, k.name as category_name, k.icon as category_icon, k.color as category_color,
      (select count(*) from public.certificates ce where ce.course_id = x.course_id and ce.status = 'valid') as delivered
    from public.certifications x join public.courses c on c.id = x.course_id left join public.categories k on k.id = coalesce(x.category_id, c.category_id)
    where x.id in (select id from public._certification_filter_ids(p_q, p_category, p_status, p_tab))
    order by ord limit p_limit offset p_offset
  ) t;
  return jsonb_build_object('total', total, 'rows', rows);
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('certification-covers', 'certification-covers', true, 2097152, array['image/jpeg','image/png'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists certification_covers_admin_write on storage.objects;
create policy certification_covers_admin_write on storage.objects for all
  using (bucket_id = 'certification-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'))
  with check (bucket_id = 'certification-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'));
drop policy if exists certification_covers_public_read on storage.objects;
create policy certification_covers_public_read on storage.objects for select using (bucket_id = 'certification-covers');
