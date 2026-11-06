-- Lot 4 : création d'une catégorie par l'administration.
--  - code unique, ordre d'affichage, description détaillée, image de couverture ;
--  - visibilité sur la plateforme et dans le catalogue public ;
--  - bucket public « category-covers » (écriture réservée aux administrateurs, dossier <user_id>/...).

alter table public.categories
  add column code text check (code is null or code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' and char_length(code) between 3 and 30),
  add column display_order integer not null default 0 check (display_order between 0 and 9999),
  add column long_description text check (long_description is null or char_length(long_description) <= 2000),
  add column cover_url text check (cover_url is null or cover_url ~ '^https://'),
  add column visible_platform boolean not null default true,
  add column visible_catalogue boolean not null default true;

create unique index categories_code_key on public.categories (code) where code is not null;

drop policy categories_public_read on public.categories;
create policy categories_public_read on public.categories for select
  using ((status = 'active' and visible_platform) or public.is_staff());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('category-covers', 'category-covers', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy category_covers_admin_write on storage.objects for all
  using (bucket_id = 'category-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'))
  with check (bucket_id = 'category-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'));
create policy category_covers_public_read on storage.objects for select using (bucket_id = 'category-covers');
