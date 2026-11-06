-- Lot 4 : assistant « Créer une session » (4 étapes).
--  - informations pédagogiques de la session : description, objectifs, niveau requis, formation prérequise, langue ;
--  - brouillon de l'assistant : les étapes sont enregistrées avant que les dates (obligatoires pour une session) soient connues.

alter table public.sessions
  add column description text check (description is null or char_length(description) <= 1000),
  add column objectives text[] not null default '{}' check (cardinality(objectives) <= 10),
  add column required_level text not null default 'beginner' check (required_level in ('beginner','intermediate','advanced')),
  add column prerequisite_course_id uuid references public.courses(id) on delete set null,
  add column language text not null default 'fr' check (language in ('fr','en'));

create table public.session_drafts (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.session_drafts (instructor_id, updated_at desc);
create trigger session_drafts_touch before update on public.session_drafts
  for each row execute function public.touch_updated_at();

alter table public.session_drafts enable row level security;
create policy session_drafts_own on public.session_drafts for all
  using (instructor_id = auth.uid() and public.has_role('instructor'))
  with check (instructor_id = auth.uid() and public.has_role('instructor'));
