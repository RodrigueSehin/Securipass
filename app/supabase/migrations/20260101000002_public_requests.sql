-- SECURIPASS — Lot 1 : demandes issues des formulaires publics (contact, devis, candidature formateur)
-- Les insertions passent par une action serveur (service role) avec anti-spam ; aucun accès anonyme direct.
create table public.public_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact','quote','trainer_application')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 200),
  phone text,
  organization text,
  subject text,
  message text not null check (char_length(message) between 10 and 4000),
  payload jsonb not null default '{}',
  ip_address inet,
  status text not null default 'new' check (status in ('new','in_progress','done','spam')),
  handled_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.public_requests (email, created_at desc);
create index on public.public_requests (ip_address, created_at desc);
create index on public.public_requests (status, created_at desc);

alter table public.public_requests enable row level security;

-- Lecture et traitement réservés à l'administration et au support. Pas de policy d'insertion : service role uniquement.
create policy requests_staff_read on public.public_requests for select
  using (public.has_role('admin') or public.has_role('support'));
create policy requests_staff_update on public.public_requests for update
  using (public.has_role('admin') or public.has_role('support'))
  with check (public.has_role('admin') or public.has_role('support'));
