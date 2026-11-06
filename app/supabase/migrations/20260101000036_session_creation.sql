-- Lot 4 : création d'une session par l'administration.
--  - effectif minimum, options d'inscription (en ligne, validation manuelle, places entreprises), image de la session ;
--  - formateurs supplémentaires (le formateur principal reste sessions.instructor_id) ;
--  - bucket public « session-covers » (écriture réservée aux administrateurs, dossier <user_id>/...) ;
--  - la liste d'administration affiche l'image de la session avant celle de la formation.
-- Seul « liste d'attente » est appliqué par les règles d'inscription ; les autres options sont enregistrées.

alter table public.sessions
  add column min_capacity integer check (min_capacity is null or min_capacity >= 1),
  add column online_registration boolean not null default true,
  add column manual_validation boolean not null default false,
  add column company_reserved boolean not null default false,
  add column cover_url text check (cover_url is null or cover_url ~ '^https://'),
  add constraint sessions_min_capacity_within_capacity check (min_capacity is null or min_capacity <= capacity);

create table public.session_instructors (
  session_id uuid not null references public.sessions(id) on delete cascade,
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  primary key (session_id, instructor_id)
);
create index on public.session_instructors (instructor_id);
alter table public.session_instructors enable row level security;
create policy session_instructors_read on public.session_instructors for select
  using (instructor_id = auth.uid() or public.is_staff());
create policy session_instructors_admin_all on public.session_instructors for all
  using (public.has_role('admin')) with check (public.has_role('admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('session-covers', 'session-covers', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy session_covers_admin_write on storage.objects for all
  using (bucket_id = 'session-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'))
  with check (bucket_id = 'session-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'));
create policy session_covers_public_read on storage.objects for select using (bucket_id = 'session-covers');

-- p_status : planned | in_progress | completed | cancelled ; p_mode : onsite | online | hybrid ; p_sort : recent (défaut) | old
create or replace function public.admin_list_sessions(
  p_q text default '', p_course uuid default null, p_status text default '', p_mode text default '',
  p_from date default null, p_to date default null, p_sort text default 'recent', p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
  total integer;
  rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*) into total
  from public.sessions s join public.courses c on c.id = s.course_id join public.profiles i on i.id = s.instructor_id
  where s.status <> 'draft'
    and (q = '' or s.title ilike '%' || q || '%' or s.reference ilike '%' || q || '%' or c.title ilike '%' || q || '%'
         or i.full_name ilike '%' || q || '%' or coalesce(s.location, '') ilike '%' || q || '%')
    and (p_course is null or s.course_id = p_course)
    and (coalesce(p_status, '') = '' or public._session_display_status(s.status, s.start_at, s.end_at) = p_status)
    and (coalesce(p_mode, '') = '' or s.delivery_mode = p_mode)
    and (p_from is null or s.end_at >= p_from::timestamptz)
    and (p_to is null or s.start_at < (p_to + 1)::timestamptz);

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by
        case when p_sort = 'old' then s.start_at end asc,
        case when p_sort <> 'old' then s.start_at end desc, s.id) as ord,
      s.id, s.reference, s.title, s.start_at, s.end_at, s.timezone, s.delivery_mode, s.location, s.capacity, s.status as raw_status,
      public._session_display_status(s.status, s.start_at, s.end_at) as display_status,
      public.session_seats_taken(s.id) as taken,
      c.id as course_id, c.title as course_title, coalesce(s.cover_url, c.cover_url) as course_cover,
      k.slug as category_slug, k.name as category_name,
      i.id as instructor_id, i.full_name as instructor_name, i.avatar_url as instructor_avatar
    from public.sessions s join public.courses c on c.id = s.course_id join public.profiles i on i.id = s.instructor_id
    left join public.categories k on k.id = c.category_id
    where s.status <> 'draft'
      and (q = '' or s.title ilike '%' || q || '%' or s.reference ilike '%' || q || '%' or c.title ilike '%' || q || '%'
           or i.full_name ilike '%' || q || '%' or coalesce(s.location, '') ilike '%' || q || '%')
      and (p_course is null or s.course_id = p_course)
      and (coalesce(p_status, '') = '' or public._session_display_status(s.status, s.start_at, s.end_at) = p_status)
      and (coalesce(p_mode, '') = '' or s.delivery_mode = p_mode)
      and (p_from is null or s.end_at >= p_from::timestamptz)
      and (p_to is null or s.start_at < (p_to + 1)::timestamptz)
    order by ord
    limit p_limit offset p_offset
  ) t;

  return jsonb_build_object('total', total, 'rows', rows);
end $$;
