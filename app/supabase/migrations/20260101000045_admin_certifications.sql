-- Lot 4 : catalogue des certifications géré par l'administration.
--  - une certification = un nom, un code et une durée de validité, rattachés à une formation (une seule par formation) ;
--  - statut : active | review (en révision) | inactive ;
--  - « Délivrés » = certificats valides de la formation ; reprise automatique des formations qui ont déjà délivré des certificats ;
--  - indicateurs : créées, délivrées, apprenants certifiés, taux de réussite aux évaluations.
-- La durée de validité du catalogue est indicative : l'émission continue d'utiliser celle de la formation.

create sequence public.certification_code_seq;

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  code text not null check (code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' and char_length(code) between 3 and 30),
  course_id uuid not null unique references public.courses(id),
  validity_months integer check (validity_months is null or validity_months between 1 and 240),
  status text not null default 'active' check (status in ('active', 'review', 'inactive')),
  category_id uuid references public.categories(id),
  level text check (level is null or level in ('beginner', 'intermediate', 'professional', 'expert')),
  description text check (description is null or char_length(description) <= 500),
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  evaluation_type text not null default 'qcm' check (evaluation_type in ('qcm', 'practical', 'qcm_practical', 'continuous')),
  passing_score integer not null default 70 check (passing_score between 0 and 100),
  max_attempts integer not null default 2 check (max_attempts between 1 and 10),
  delivery_mode text not null default 'automatic' check (delivery_mode in ('automatic', 'manual')),
  auto_pdf boolean not null default true,
  template_id uuid references public.certificate_templates(id),
  number_prefix text check (number_prefix is null or number_prefix ~ '^[A-Z0-9]{2,10}$'),
  show_public boolean not null default true,
  allow_verification boolean not null default true,
  require_proof boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index certifications_code_key on public.certifications (code);
create trigger certifications_touch before update on public.certifications
  for each row execute function public.touch_updated_at();
alter table public.certifications enable row level security;
create policy certifications_staff on public.certifications for all using (public.is_staff()) with check (public.is_staff());

-- Reprise : une certification par formation ayant déjà délivré des certificats
insert into public.certifications (name, code, course_id, validity_months, category_id, number_prefix)
select 'Certification – ' || c.title, 'CERT-' || upper(left(regexp_replace(coalesce(k.slug, 'gen'), '[^a-zA-Z]', '', 'g') || 'XXX', 3)) || '-' || lpad(nextval('public.certification_code_seq')::text, 3, '0'),
       c.id, c.certificate_validity_months, c.category_id, upper(left(regexp_replace(coalesce(k.slug, 'gen'), '[^a-zA-Z]', '', 'g') || 'XXX', 3))
from public.courses c left join public.categories k on k.id = c.category_id
where exists (select 1 from public.certificates x where x.course_id = c.id)
order by c.created_at;

create or replace function public.admin_certifications_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
  ok integer; ko integer; res jsonb;
begin
  perform public._admin_only();
  select count(*) filter (where passed), count(*) filter (where not passed) into ok, ko from public._evaluation_outcomes();
  select jsonb_build_object(
    'created', (select jsonb_build_object('count', count(*), 'month', count(*) filter (where created_at >= cur), 'prev', count(*) filter (where created_at >= prev and created_at < cur)) from public.certifications),
    'active', (select count(*) from public.certifications where status = 'active'),
    'inactive', (select count(*) from public.certifications where status <> 'active'),
    'delivered', (select jsonb_build_object('count', count(*), 'month', count(*) filter (where issued_at >= cur), 'prev', count(*) filter (where issued_at >= prev and issued_at < cur)) from public.certificates where status = 'valid'),
    'learners', (select jsonb_build_object('count', count(distinct learner_id),
        'month', count(distinct learner_id) filter (where issued_at >= cur), 'prev', count(distinct learner_id) filter (where issued_at >= prev and issued_at < cur)) from public.certificates where status = 'valid'),
    'success', jsonb_build_object('passed', ok, 'results', ok + ko)
  ) into res;
  return res;
end $$;

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
revoke execute on function public._certification_filter_ids(text, uuid, text, text) from public, anon, authenticated;

-- p_status : active | review | inactive ; p_tab : all | active | inactive
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

create or replace function public.admin_set_certification_status(p_certification uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  perform public._admin_only();
  if p_status not in ('active', 'review', 'inactive') then raise exception 'status_invalid'; end if;
  select status into cur from public.certifications where id = p_certification;
  if cur is null then raise exception 'certification_not_found'; end if;
  update public.certifications set status = p_status where id = p_certification;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'certification.' || p_status, 'certification', p_certification::text, jsonb_build_object('from', cur));
end $$;

revoke execute on function public.admin_certifications_stats() from public, anon;
revoke execute on function public.admin_certifications_options() from public, anon;
revoke execute on function public.admin_list_certifications(text, uuid, text, text, integer, integer) from public, anon;
revoke execute on function public.admin_set_certification_status(uuid, text) from public, anon;
grant execute on function public.admin_certifications_stats() to authenticated;
grant execute on function public.admin_certifications_options() to authenticated;
grant execute on function public.admin_list_certifications(text, uuid, text, text, integer, integer) to authenticated;
grant execute on function public.admin_set_certification_status(uuid, text) to authenticated;

-- Visuel de la certification : bucket public (écriture réservée aux administrateurs, dossier <user_id>/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('certification-covers', 'certification-covers', true, 2097152, array['image/jpeg','image/png'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy certification_covers_admin_write on storage.objects for all
  using (bucket_id = 'certification-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'))
  with check (bucket_id = 'certification-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'));
create policy certification_covers_public_read on storage.objects for select using (bucket_id = 'certification-covers');
