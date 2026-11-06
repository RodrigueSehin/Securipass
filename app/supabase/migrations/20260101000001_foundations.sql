-- SECURIPASS — Lot 1 : identité, rôles, organisations, catalogue, audit
create extension if not exists "pgcrypto";

-- ---------- Rôles ----------
create table public.roles (
  id smallserial primary key,
  code text not null unique,
  name text not null,
  description text
);
insert into public.roles (code, name, description) values
  ('learner','Apprenant','Suit des formations et passe des évaluations'),
  ('instructor','Formateur','Crée des formations et organise des sessions'),
  ('company','Entreprise','Inscrit et suit ses collaborateurs'),
  ('admin','Administrateur','Pilote la plateforme'),
  ('pedagogy_manager','Responsable pédagogique','Contrôle contenus et évaluations'),
  ('certification_manager','Responsable certification','Supervise émission, révocation, vérification'),
  ('support','Support','Traite les demandes d''assistance');

-- ---------- Profils ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  phone text,
  avatar_url text,
  locale text not null default 'fr',
  timezone text not null default 'Africa/Abidjan',
  status text not null default 'active' check (status in ('active','suspended','deletion_requested')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id smallint not null references public.roles(id),
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id),
  primary key (user_id, role_id)
);

-- Fonctions d'aide RLS (security definer : évite la récursion de policies)
create or replace function public.has_role(_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.code = _role
  );
$$;
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code in ('admin','pedagogy_manager','certification_manager','support')
  );
$$;

-- Création automatique du profil + rôle apprenant à l'inscription.
-- Les rôles privilégiés ne sont JAMAIS lus depuis les métadonnées client.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name',''),
          new.email,
          new.raw_user_meta_data->>'phone');
  insert into public.user_roles (user_id, role_id)
  select new.id, id from public.roles where code = 'learner';
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- Organisations ----------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration_number text,
  industry text,
  address text,
  city text,
  country text not null default 'CI',
  billing_email text,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','manager','member')),
  department text,
  status text not null default 'active' check (status in ('invited','active','disabled')),
  unique (organization_id, user_id)
);
create index on public.organization_members (user_id);

create or replace function public.is_org_manager(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = _org and user_id = auth.uid()
      and role in ('owner','manager') and status = 'active'
  );
$$;
create or replace function public.is_org_member(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = _org and user_id = auth.uid() and status = 'active'
  );
$$;

-- ---------- Catalogue ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  parent_id uuid references public.categories(id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id),
  category_id uuid references public.categories(id),
  title text not null,
  slug text not null unique,
  description text,
  objectives text[] not null default '{}',
  prerequisites text,
  target_audience text,
  level text not null default 'beginner' check (level in ('beginner','intermediate','advanced')),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  delivery_mode text not null default 'onsite' check (delivery_mode in ('onsite','online','hybrid')),
  price_amount numeric(12,0) not null default 0 check (price_amount >= 0), -- FCFA : pas de décimales
  currency text not null default 'XOF',
  cover_url text,
  status text not null default 'draft' check (status in ('draft','in_review','published','rejected','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.courses (status, category_id);
create index on public.courses (instructor_id);
create trigger courses_touch before update on public.courses
  for each row execute function public.touch_updated_at();

-- ---------- Audit ----------
create table public.audit_logs (
  id bigserial primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  occurred_at timestamptz not null default now(),
  ip_address inet,
  metadata jsonb not null default '{}'
);
create index on public.audit_logs (entity_type, entity_id);
create index on public.audit_logs (actor_id, occurred_at desc);

-- ---------- RLS ----------
alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.categories enable row level security;
alter table public.courses enable row level security;
alter table public.audit_logs enable row level security;

create policy roles_read on public.roles for select using (true);

create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.is_staff());
-- L'utilisateur ne modifie que son profil, sans pouvoir changer son statut
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and status = (select p.status from public.profiles p where p.id = auth.uid()));
create policy profiles_admin_update on public.profiles for update
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy user_roles_read on public.user_roles for select
  using (user_id = auth.uid() or public.is_staff());
create policy user_roles_admin_write on public.user_roles for all
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy orgs_read on public.organizations for select
  using (public.is_staff() or public.is_org_member(id));
create policy orgs_manager_update on public.organizations for update
  using (public.is_org_manager(id)) with check (public.is_org_manager(id));
create policy orgs_admin_all on public.organizations for all
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy members_read on public.organization_members for select
  using (user_id = auth.uid() or public.is_org_manager(organization_id) or public.is_staff());
create policy members_manager_write on public.organization_members for all
  using (public.is_org_manager(organization_id)) with check (public.is_org_manager(organization_id));

create policy categories_public_read on public.categories for select using (true);
create policy categories_admin_write on public.categories for all
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy courses_read on public.courses for select
  using (status = 'published' or instructor_id = auth.uid() or public.is_staff());
create policy courses_instructor_insert on public.courses for insert
  with check (instructor_id = auth.uid() and public.has_role('instructor') and status = 'draft');
-- Un formateur modifie ses formations mais ne peut pas se publier lui-même
create policy courses_instructor_update on public.courses for update
  using (instructor_id = auth.uid() and public.has_role('instructor'))
  with check (instructor_id = auth.uid() and status in ('draft','in_review','archived'));
create policy courses_staff_all on public.courses for all
  using (public.has_role('admin') or public.has_role('pedagogy_manager'))
  with check (public.has_role('admin') or public.has_role('pedagogy_manager'));

-- audit : lecture admin uniquement ; écriture via fonctions serveur (service role)
create policy audit_admin_read on public.audit_logs for select using (public.has_role('admin'));
