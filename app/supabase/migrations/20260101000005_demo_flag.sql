-- SECURIPASS — Données de démonstration : marqueur d'identification (exigé par la spécification)
-- Les formations de démonstration sont créées par scripts/seed-demo.mjs et supprimables en une commande.
alter table public.courses add column is_demo boolean not null default false;
create index on public.courses (is_demo) where is_demo;

-- Seul le personnel pédagogique (ou le service role, via le script) peut poser ou retirer ce marqueur :
-- un formateur ne peut ni se déclarer « démo » ni retirer la mention d'une formation de démonstration.
create or replace function public.courses_demo_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_pedagogy_staff() then return new; end if;
  if tg_op = 'INSERT' then new.is_demo := false; else new.is_demo := old.is_demo; end if;
  return new;
end $$;
create trigger courses_demo_guard_trg before insert or update on public.courses
  for each row execute function public.courses_demo_guard();
