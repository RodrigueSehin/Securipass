-- Lot 4 : création d'un utilisateur par l'administration — service ou département du compte.
alter table public.profiles
  add column department text check (department is null or char_length(department) between 2 and 120);
