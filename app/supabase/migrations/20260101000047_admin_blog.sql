-- Lot 4 : blog et contenus publics gérés par l'administration.
--  - table blog_posts : article | actualité | ressource | vidéo, catégorie du blog, statut brouillon / publié / archivé ;
--  - les articles actuellement affichés par le site public (src/content/blog.ts) sont repris dans la table ;
--  - le site public continue de lire le fichier : le brancher sur cette table est une étape à part ;
--  - bucket public « blog-covers » (écriture réservée aux administrateurs, dossier <user_id>/...).
-- Lectures : compteur tenu à jour par le site public lorsqu'il lira cette table (0 d'ici là). Pas de commentaires pour l'instant.

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(title) between 2 and 200),
  excerpt text not null check (char_length(excerpt) between 2 and 500),
  body text check (body is null or char_length(body) <= 20000),
  category text not null check (category ~ '^[a-z0-9-]+$'),
  kind text not null default 'article' check (kind in ('article', 'news', 'resource', 'video')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  author_id uuid references public.profiles(id),
  published_at timestamptz,
  read_minutes integer check (read_minutes is null or read_minutes between 1 and 120),
  image text,
  views integer not null default 0 check (views >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);
create index on public.blog_posts (status, published_at desc);
create trigger blog_posts_touch before update on public.blog_posts
  for each row execute function public.touch_updated_at();
alter table public.blog_posts enable row level security;
create policy blog_posts_public_read on public.blog_posts for select using ((status = 'published' and published_at <= now()) or public.is_staff());
create policy blog_posts_admin_write on public.blog_posts for all using (public.has_role('admin')) with check (public.has_role('admin'));

insert into public.blog_posts (slug, title, excerpt, category, kind, status, published_at, read_minutes, image) values
  ('bien-utiliser-un-extincteur', 'Comment bien utiliser un extincteur ? Guide pratique étape par étape', 'Apprenez les gestes essentiels pour maîtriser un départ de feu et assurer votre sécurité et celle des autres.', 'securite-incendie', 'article', 'published', '2026-10-12T09:00:00+00:00', 5, 'blog/extincteur'),
  ('gestes-qui-sauvent-arret-cardiaque', 'Les gestes qui sauvent : que faire en cas d’arrêt cardiaque ?', 'Découvrez les étapes clés de la réanimation cardiopulmonaire (RCP) et augmentez vos chances de sauver une vie.', 'secourisme', 'article', 'published', '2026-10-08T09:00:00+00:00', 6, 'home/secourisme'),
  ('role-de-l-agent-de-securite', 'Le rôle de l’agent de sécurité dans la prévention des risques', 'Zoom sur les missions, les compétences et l’importance de l’agent de sécurité dans votre environnement de travail.', 'agent-securite', 'article', 'published', '2026-10-05T09:00:00+00:00', 4, 'home/agent-securite'),
  ('normes-et-obligations-hse', 'Normes et obligations en matière de sécurité au travail en Côte d’Ivoire', 'Tout ce qu’il faut savoir sur la réglementation HSE et les obligations légales des employeurs.', 'reglementation', 'article', 'published', '2026-09-28T09:00:00+00:00', 7, 'blog/reglementation'),
  ('pourquoi-former-ses-employes', 'Pourquoi former ses employés en sécurité ?', 'Les avantages pour les entreprises : réduction des risques, conformité réglementaire et meilleure performance.', 'entreprise', 'article', 'published', '2026-09-22T09:00:00+00:00', 5, 'home/entreprise'),
  ('videosurveillance-securite-des-sites', 'Vidéosurveillance : un outil efficace pour la sécurité des sites', 'Comment la vidéosurveillance contribue à la prévention des risques et à la protection des biens et des personnes.', 'agent-securite', 'article', 'published', '2026-09-18T09:00:00+00:00', 6, 'blog/videosurveillance'),
  ('trousse-de-premiers-secours', 'La trousse de premiers secours : que doit-elle contenir ?', 'Liste complète du matériel indispensable et conseils pour bien l’utiliser.', 'secourisme', 'article', 'published', '2026-09-12T09:00:00+00:00', 4, 'blog/trousse-secours'),
  ('types-d-incendies-et-extinction', 'Les différents types d’incendies et leurs modes d’extinction', 'Comprendre les classes de feu pour choisir le bon moyen d’extinction.', 'securite-incendie', 'article', 'published', '2026-09-08T09:00:00+00:00', 5, 'home/securite-incendie');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('blog-covers', 'blog-covers', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy blog_covers_admin_write on storage.objects for all
  using (bucket_id = 'blog-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'))
  with check (bucket_id = 'blog-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'));
create policy blog_covers_public_read on storage.objects for select using (bucket_id = 'blog-covers');

create or replace function public.admin_blog_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
begin
  perform public._admin_only();
  return jsonb_build_object(
    'published', (select jsonb_build_object('count', count(*), 'month', count(*) filter (where published_at >= cur), 'prev', count(*) filter (where published_at >= prev and published_at < cur)) from public.blog_posts where status = 'published'),
    'drafts', (select count(*) from public.blog_posts where status = 'draft'),
    'views', (select coalesce(sum(views), 0) from public.blog_posts),
    'total', (select count(*) from public.blog_posts where status <> 'archived'),
    'kinds', (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) from (select kind, count(*) as n from public.blog_posts where status <> 'archived' group by kind) k),
    'categories', (select coalesce(jsonb_object_agg(category, n), '{}'::jsonb) from (select category, count(*) as n from public.blog_posts where status <> 'archived' group by category) c));
end $$;

create or replace function public._blog_filter_ids(p_q text, p_kind text, p_category text, p_status text, p_from date, p_to date)
returns table (id uuid) language plpgsql stable security definer set search_path = public as $$
declare q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
begin
  return query
  select b.id from public.blog_posts b
  where (q = '' or b.title ilike '%' || q || '%' or b.excerpt ilike '%' || q || '%' or b.slug ilike '%' || q || '%')
    and (coalesce(p_kind, '') = '' or b.kind = p_kind)
    and (coalesce(p_category, '') = '' or b.category = p_category)
    and ((coalesce(p_status, '') = '' and b.status <> 'archived') or b.status = p_status)
    and (p_from is null or coalesce(b.published_at, b.created_at) >= p_from::timestamptz)
    and (p_to is null or coalesce(b.published_at, b.created_at) < (p_to + 1)::timestamptz);
end $$;
revoke execute on function public._blog_filter_ids(text, text, text, text, date, date) from public, anon, authenticated;

-- p_kind : article | news | resource | video ; p_status : draft | published | archived (vide = tout sauf archivés)
create or replace function public.admin_list_blog(
  p_q text default '', p_kind text default '', p_category text default '', p_status text default '', p_from date default null, p_to date default null,
  p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare total integer; rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  select count(*) into total from public._blog_filter_ids(p_q, p_kind, p_category, p_status, p_from, p_to);
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by coalesce(b.published_at, b.updated_at) desc, b.id) as ord,
      b.id, b.slug, b.title, b.category, b.kind, b.status, b.published_at, b.updated_at, b.image, b.views, a.full_name as author_name
    from public.blog_posts b left join public.profiles a on a.id = b.author_id
    where b.id in (select id from public._blog_filter_ids(p_q, p_kind, p_category, p_status, p_from, p_to))
    order by ord limit p_limit offset p_offset
  ) t;
  return jsonb_build_object('total', total, 'rows', rows);
end $$;

create or replace function public.admin_blog_drafts(p_limit integer default 3)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'updated_at', d.updated_at) order by d.updated_at desc), '[]'::jsonb)
    from (select id, title, updated_at from public.blog_posts where status = 'draft' order by updated_at desc limit least(greatest(coalesce(p_limit, 3), 1), 10)) d);
end $$;

create or replace function public.admin_set_blog_status(p_post uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  perform public._admin_only();
  if p_status not in ('draft', 'published', 'archived') then raise exception 'status_invalid'; end if;
  select status into cur from public.blog_posts where id = p_post;
  if cur is null then raise exception 'post_not_found'; end if;
  update public.blog_posts set status = p_status, published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end where id = p_post;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'blog.' || p_status, 'blog_post', p_post::text, jsonb_build_object('from', cur));
end $$;

revoke execute on function public.admin_blog_stats() from public, anon;
revoke execute on function public.admin_list_blog(text, text, text, text, date, date, integer, integer) from public, anon;
revoke execute on function public.admin_blog_drafts(integer) from public, anon;
revoke execute on function public.admin_set_blog_status(uuid, text) from public, anon;
grant execute on function public.admin_blog_stats() to authenticated;
grant execute on function public.admin_list_blog(text, text, text, text, date, date, integer, integer) to authenticated;
grant execute on function public.admin_blog_drafts(integer) to authenticated;
grant execute on function public.admin_set_blog_status(uuid, text) to authenticated;
