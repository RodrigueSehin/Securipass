-- Lot 4 : création d'une entreprise par l'administration.
--  - identité légale (sigle, forme juridique, NIF, description), commune, couleurs et logo ;
--  - paramètres : type de partenariat, inscriptions par l'entreprise, facturation (stockés, pas encore appliqués) ;
--  - contacts de l'entreprise (principal et secondaire) ;
--  - bucket public « company-logos » (écriture réservée aux administrateurs, dossier <user_id>/...).

alter table public.organizations
  add column short_name text check (short_name is null or char_length(short_name) <= 60),
  add column legal_form text check (legal_form is null or char_length(legal_form) <= 60),
  add column tax_id text check (tax_id is null or char_length(tax_id) <= 40),
  add column description text check (description is null or char_length(description) <= 500),
  add column commune text check (commune is null or char_length(commune) <= 100),
  add column logo_url text check (logo_url is null or logo_url ~ '^https://'),
  add column primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column secondary_color text check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column partnership_type text not null default 'client' check (partnership_type in ('client', 'partner', 'employer')),
  add column allow_enrollments boolean not null default true,
  add column invoicing_enabled boolean not null default false;

create unique index organizations_registration_key on public.organizations (lower(registration_number)) where registration_number is not null;

create table public.organization_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('primary', 'secondary')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  job_title text check (job_title is null or char_length(job_title) <= 120),
  phone text check (phone is null or char_length(phone) <= 30),
  email text check (email is null or char_length(email) <= 200),
  unique (organization_id, kind)
);
alter table public.organization_contacts enable row level security;
create policy organization_contacts_staff on public.organization_contacts for all using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('company-logos', 'company-logos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy company_logos_admin_write on storage.objects for all
  using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'))
  with check (bucket_id = 'company-logos' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'));
create policy company_logos_public_read on storage.objects for select using (bucket_id = 'company-logos');
