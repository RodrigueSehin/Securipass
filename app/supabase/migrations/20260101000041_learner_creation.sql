-- Lot 4 : création d'un apprenant par l'administration.
-- Informations réservées au personnel (lieu de naissance, pièce d'identité, notes) : table à part, jamais lue par l'apprenant ni par les formateurs.
-- Les autres informations (civilité, nationalité, adresse, situation, niveau d'études…) vont dans les colonnes existantes du profil.

create table public.learner_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  birth_place text check (birth_place is null or char_length(birth_place) <= 120),
  id_type text check (id_type is null or id_type in ('cni', 'passport', 'driving_licence', 'consular_card', 'other')),
  id_number text check (id_number is null or char_length(id_number) <= 60),
  id_valid_until date,
  notes text check (notes is null or char_length(notes) <= 500),
  updated_at timestamptz not null default now()
);
create trigger learner_private_touch before update on public.learner_private
  for each row execute function public.touch_updated_at();
alter table public.learner_private enable row level security;
create policy learner_private_staff on public.learner_private for all using (public.is_staff()) with check (public.is_staff());
