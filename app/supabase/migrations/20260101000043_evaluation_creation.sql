-- Lot 4 : création d'une évaluation par l'administration, et édition de ses questions.
--  - paramètres : nombre de questions prévu, mélange des questions et des réponses, résultat immédiat, mode de notation (stockés, pas encore appliqués au passage) ;
--  - questions : thématique, difficulté, explication affichée après correction (stockées) ;
--  - pièces jointes : table evaluation_files et bucket privé « evaluation-files » (écriture administrateur, dossier <user_id>/...) ;
--  - publication : un QCM sans question ne peut pas être publié.

alter table public.evaluations
  add column planned_questions integer check (planned_questions is null or planned_questions between 1 and 500),
  add column shuffle_questions boolean not null default false,
  add column shuffle_answers boolean not null default false,
  add column show_result_immediately boolean not null default false,
  add column grading_mode text not null default 'points100' check (grading_mode in ('points100', 'points20', 'pass_fail'));

alter table public.evaluation_questions
  add column category text check (category is null or char_length(category) <= 80),
  add column difficulty text check (difficulty is null or difficulty in ('easy', 'medium', 'hard')),
  add column explanation text check (explanation is null or char_length(explanation) <= 300);

create table public.evaluation_files (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  storage_path text not null,
  file_name text not null check (char_length(file_name) <= 200),
  size_bytes integer not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);
create index on public.evaluation_files (evaluation_id);
alter table public.evaluation_files enable row level security;
create policy evaluation_files_staff on public.evaluation_files for all using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('evaluation-files', 'evaluation-files', false, 10485760, array[
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy evaluation_files_admin_write on storage.objects for insert
  with check (bucket_id = 'evaluation-files' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'));
create policy evaluation_files_staff_read on storage.objects for select
  using (bucket_id = 'evaluation-files' and public.is_staff());

create or replace function public.admin_set_evaluation_status(p_evaluation uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text; k text;
begin
  perform public._admin_only();
  if p_status not in ('draft', 'published', 'archived') then raise exception 'status_invalid'; end if;
  select status, kind into cur, k from public.evaluations where id = p_evaluation;
  if cur is null then raise exception 'evaluation_not_found'; end if;
  if p_status = 'draft' and (exists (select 1 from public.evaluation_attempts where evaluation_id = p_evaluation)
                              or exists (select 1 from public.evaluation_grades where evaluation_id = p_evaluation)) then
    raise exception 'evaluation_has_results';
  end if;
  if p_status = 'published' and k = 'quiz' and not exists (select 1 from public.evaluation_questions where evaluation_id = p_evaluation) then
    raise exception 'evaluation_no_questions';
  end if;
  update public.evaluations set status = p_status where id = p_evaluation;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'evaluation.' || p_status, 'evaluation', p_evaluation::text, jsonb_build_object('from', cur));
end $$;
