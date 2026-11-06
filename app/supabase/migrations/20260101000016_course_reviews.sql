-- Lot 3/4 : avis des apprenants sur les formations terminées (note de 1 à 5 et commentaire facultatif).

create table public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, learner_id)
);
create index on public.course_reviews (course_id);
create trigger course_reviews_touch before update on public.course_reviews
  for each row execute function public.touch_updated_at();

-- Un apprenant ne peut donner son avis que s'il est inscrit et a terminé toutes les leçons publiées de la formation.
create or replace function public.learner_finished_course(_course uuid, _learner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.enrollments e
      where e.course_id = _course and e.learner_id = _learner and e.status in ('confirmed','completed'))
    and exists (
      select 1 from public.learning_contents lc join public.course_modules m on m.id = lc.module_id
      where m.course_id = _course and lc.status = 'published')
    and not exists (
      select 1 from public.learning_contents lc join public.course_modules m on m.id = lc.module_id
      where m.course_id = _course and lc.status = 'published'
        and not exists (select 1 from public.content_completions cc where cc.content_id = lc.id and cc.learner_id = _learner));
$$;
revoke execute on function public.learner_finished_course(uuid, uuid) from public, anon;
grant execute on function public.learner_finished_course(uuid, uuid) to authenticated;

alter table public.course_reviews enable row level security;

create policy reviews_read on public.course_reviews for select
  using (learner_id = auth.uid() or public.owns_course(course_id) or public.is_staff());
create policy reviews_insert on public.course_reviews for insert
  with check (learner_id = auth.uid() and public.learner_finished_course(course_id, auth.uid()));
create policy reviews_update on public.course_reviews for update
  using (learner_id = auth.uid())
  with check (learner_id = auth.uid() and public.learner_finished_course(course_id, auth.uid()));
create policy reviews_delete on public.course_reviews for delete
  using (learner_id = auth.uid() or public.is_staff());

-- Note moyenne et nombre d'avis des formations publiées (lecture publique, sans exposer les avis eux-mêmes).
create or replace function public.course_rating_stats(p_courses uuid[])
returns table (course_id uuid, average numeric, total integer)
language sql stable security definer set search_path = public as $$
  select r.course_id, round(avg(r.rating)::numeric, 1), count(*)::integer
  from public.course_reviews r join public.courses c on c.id = r.course_id
  where c.status = 'published' and r.course_id = any(p_courses)
  group by r.course_id;
$$;
grant execute on function public.course_rating_stats(uuid[]) to anon, authenticated;
