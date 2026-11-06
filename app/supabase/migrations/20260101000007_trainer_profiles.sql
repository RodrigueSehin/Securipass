-- SECURIPASS — Annuaire public des formateurs : profils publiés par l'administration après vérification des qualifications.
-- Le nom d'affichage est copié ici (public) pour ne jamais exposer la table profiles aux visiteurs.
create table public.trainer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text not null check (char_length(display_name) between 2 and 120),
  headline text not null check (char_length(headline) between 3 and 120),
  bio text not null check (char_length(bio) between 10 and 600),
  domain text not null check (domain in ('securite','secourisme','incendie','reglementation')),
  tags text[] not null default '{}' check (cardinality(tags) <= 6),
  is_published boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.trainer_profiles (is_published, domain);
create index on public.trainer_profiles (is_demo) where is_demo;

create trigger trainer_profiles_touch before update on public.trainer_profiles
  for each row execute function public.touch_updated_at();

alter table public.trainer_profiles enable row level security;

-- Visiteurs : uniquement les profils publiés. Le formateur voit le sien ; seule l'administration crée, modifie et publie.
create policy trainer_profiles_public_read on public.trainer_profiles for select
  using (is_published);
create policy trainer_profiles_owner_read on public.trainer_profiles for select
  using (user_id = auth.uid());
create policy trainer_profiles_admin_all on public.trainer_profiles for all
  using (public.has_role('admin'))
  with check (public.has_role('admin'));
