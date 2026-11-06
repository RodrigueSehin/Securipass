-- Espace formateur : évaluation globale d'un apprenant pour une session (note finale, résultat, commentaire).
--  - table session_assessments : une ligne par apprenant et par session, saisie par le formateur de la session ;
--  - l'apprenant lit sa propre évaluation ; le personnel lit tout ;
--  - l'enregistrement notifie l'apprenant. La note est stockée en pourcentage, comme evaluation_grades.

create or replace function public.session_is_mine(_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sessions s
    where s.id = _session and (s.instructor_id = auth.uid() or public.owns_course(s.course_id)));
$$;
revoke execute on function public.session_is_mine(uuid) from public, anon;
grant execute on function public.session_is_mine(uuid) to authenticated;

create table public.session_assessments (
  session_id uuid not null references public.sessions(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  score_percent integer not null check (score_percent between 0 and 100),
  passed boolean not null,
  comment text check (comment is null or char_length(comment) between 1 and 500),
  graded_by uuid references public.profiles(id),
  graded_at timestamptz not null default now(),
  primary key (session_id, learner_id)
);
create index on public.session_assessments (learner_id);
alter table public.session_assessments enable row level security;

create policy session_assessments_read on public.session_assessments for select
  using (learner_id = auth.uid() or public.session_is_mine(session_id) or public.is_staff());
create policy session_assessments_write on public.session_assessments for all
  using (public.session_is_mine(session_id) or public.is_pedagogy_staff())
  with check (
    (public.session_is_mine(session_id) or public.is_pedagogy_staff())
    and exists (select 1 from public.enrollments en
                where en.session_id = session_assessments.session_id and en.learner_id = session_assessments.learner_id
                  and en.status in ('confirmed', 'completed')));

create or replace function public.stamp_session_assessment()
returns trigger language plpgsql security definer set search_path = public as $$
declare stitle text;
begin
  new.graded_by := coalesce(auth.uid(), new.graded_by);
  new.graded_at := now();
  select title into stitle from public.sessions where id = new.session_id;
  perform public._notify(new.learner_id, 'evaluation_result', 'Évaluation publiée', stitle, '/app/evaluations');
  return new;
end $$;
create trigger session_assessments_stamp before insert or update on public.session_assessments
  for each row execute function public.stamp_session_assessment();
