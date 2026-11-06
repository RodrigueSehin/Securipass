-- Lot 3 — planification des évaluations : date d'ouverture.
-- Une évaluation publiée est visible de l'apprenant dès son ouverture (liste « À venir »), mais ses questions
-- et ses tentatives ne sont accessibles qu'à partir de la date d'ouverture.

alter table public.evaluations add column available_at timestamptz;
alter table public.evaluations add constraint evaluations_window
  check (available_at is null or due_at is null or available_at < due_at);

-- Visibilité (métadonnées seules) : publiée, formation suivie, session si elle en a une. Sans condition de date.
create or replace function public.learner_sees_evaluation(_evaluation uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.evaluations e
    where e.id = _evaluation and e.status = 'published'
      and public.has_course_access(e.course_id)
      and (e.session_id is null or public.is_enrolled_in_session(e.session_id)));
end $$;

drop policy evaluations_read on public.evaluations;
create policy evaluations_read on public.evaluations for select
  using (public.owns_course(course_id) or public.is_staff() or public.learner_sees_evaluation(id));

-- Passage (questions, tentatives) : visible seulement une fois ouverte et avant l'échéance.
create or replace function public.can_take_evaluation(_evaluation uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.evaluations e
    where e.id = _evaluation
      and public.learner_sees_evaluation(e.id)
      and (e.available_at is null or e.available_at <= now()));
end $$;
