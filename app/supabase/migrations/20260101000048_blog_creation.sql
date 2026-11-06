-- Lot 4 : création complète d'un contenu du blog.
--  - niveau de visibilité, langue, mots-clés, titre et description SEO ;
--  - médias joints : table blog_post_files et bucket public « blog-media » (images, vidéos MP4, PDF ; écriture administrateur, dossier <user_id>/...).
-- Visibilité « membres » et langue sont enregistrées : le site public lira ces champs quand il utilisera cette table.
-- Le résumé passe à 300 caractères (les articles repris restent valides).

alter table public.blog_posts
  add column visibility text not null default 'public' check (visibility in ('public', 'members')),
  add column language text not null default 'fr' check (language in ('fr', 'en')),
  add column tags text[] not null default '{}' check (cardinality(tags) <= 10),
  add column seo_title text check (seo_title is null or char_length(seo_title) <= 70),
  add column seo_description text check (seo_description is null or char_length(seo_description) <= 160);

create table public.blog_post_files (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  storage_path text not null,
  file_name text not null check (char_length(file_name) <= 200),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);
create index on public.blog_post_files (post_id);
alter table public.blog_post_files enable row level security;
create policy blog_post_files_read on public.blog_post_files for select
  using (public.is_staff() or exists (select 1 from public.blog_posts b where b.id = post_id and b.status = 'published' and b.published_at <= now()));
create policy blog_post_files_admin_write on public.blog_post_files for all using (public.has_role('admin')) with check (public.has_role('admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('blog-media', 'blog-media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy blog_media_admin_write on storage.objects for all
  using (bucket_id = 'blog-media' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'))
  with check (bucket_id = 'blog-media' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'));
create policy blog_media_public_read on storage.objects for select using (bucket_id = 'blog-media');
