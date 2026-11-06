-- Lot 4 : ressources d'un module (documents, présentations, archives) téléchargeables par les inscrits.

create table public.module_resources (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  file_path text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  mime_type text,
  created_at timestamptz not null default now()
);
create index on public.module_resources (module_id);
alter table public.module_resources enable row level security;

-- Lecture : le formateur de la formation, le personnel et les inscrits (les ressources suivent les règles d'accès au module).
create policy module_resources_read on public.module_resources for select
  using (public.is_staff() or public.can_read_module(module_id));
create policy module_resources_write on public.module_resources for all
  using (public.owns_module(module_id)) with check (public.owns_module(module_id));

-- Stockage : jusqu'à 100 Mo par fichier et formats bureautiques courants en plus des supports existants.
update storage.buckets set
  file_size_limit = 104857600,
  allowed_mime_types = array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip', 'application/x-zip-compressed',
    'video/mp4', 'video/webm', 'image/jpeg', 'image/png']
where id = 'course-files';

-- Un inscrit peut lire les fichiers des ressources de ses formations.
create policy course_files_resources_read on storage.objects for select
  using (bucket_id = 'course-files' and exists (
    select 1 from public.module_resources r
    join public.course_modules m on m.id = r.module_id
    where r.file_path = storage.objects.name and public.has_course_access(m.course_id)));

-- La copie d'un module (duplication d'une formation) ne reprend pas les ressources : elles restent attachées à l'original.
