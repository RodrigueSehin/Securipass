-- Lot 3 — messagerie : conversations avec le formateur d'une formation ou avec le support, pièces jointes sécurisées,
-- statut lu / non lu, archivage par l'apprenant. Les écritures passent par des fonctions SQL.

create or replace function public.is_support()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('support') or public.has_role('admin');
$$;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('course','support')),
  learner_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  instructor_id uuid references public.profiles(id),
  archived_by_learner boolean not null default false,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'course' and course_id is not null) or (kind = 'support' and course_id is null))
);
create unique index conversations_course_one on public.conversations (learner_id, course_id) where kind = 'course';
create unique index conversations_support_one on public.conversations (learner_id) where kind = 'support';
create index on public.conversations (instructor_id) where instructor_id is not null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null default '' check (char_length(body) <= 4000),
  attachment_path text,
  attachment_name text check (attachment_name is null or char_length(attachment_name) between 1 and 200),
  attachment_size integer check (attachment_size is null or attachment_size between 1 and 10485760),
  attachment_mime text,
  created_at timestamptz not null default now(),
  check (char_length(trim(body)) > 0 or attachment_path is not null),
  check ((attachment_path is null) = (attachment_name is null))
);
create index on public.messages (conversation_id, created_at);

create table public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

-- Participants : l'apprenant, le formateur de la formation (ou personnel pédagogique), l'équipe support
create or replace function public.is_conversation_participant(_conversation uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.conversations c
    where c.id = _conversation and (
      c.learner_id = auth.uid()
      or (c.kind = 'course' and public.owns_course(c.course_id))
      or (c.kind = 'course' and public.is_pedagogy_staff())
      or (c.kind = 'support' and public.is_support())));
end $$;

alter table public.conversations enable row level security;
create policy conversations_read on public.conversations for select using (public.is_conversation_participant(id));
alter table public.messages enable row level security;
create policy messages_read on public.messages for select using (public.is_conversation_participant(conversation_id));
alter table public.conversation_reads enable row level security;
create policy reads_own on public.conversation_reads for select using (profile_id = auth.uid());

-- Notifications : nouveau message
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'enrollment_confirmed','enrollment_waitlisted','waitlist_promoted',
  'session_changed','session_cancelled','evaluation_available','evaluation_result','message_received'));

create or replace function public.open_course_conversation(p_course uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; instructor uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.has_course_access(p_course) then raise exception 'not_enrolled'; end if;
  select instructor_id into instructor from public.courses where id = p_course;
  select id into cid from public.conversations where kind = 'course' and learner_id = auth.uid() and course_id = p_course;
  if cid is null then
    insert into public.conversations (kind, learner_id, course_id, instructor_id)
      values ('course', auth.uid(), p_course, instructor) returning id into cid;
  end if;
  return cid;
end $$;

create or replace function public.open_support_conversation()
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select id into cid from public.conversations where kind = 'support' and learner_id = auth.uid();
  if cid is null then
    insert into public.conversations (kind, learner_id) values ('support', auth.uid()) returning id into cid;
  end if;
  return cid;
end $$;

-- Nom du formateur d'une conversation de cours, seulement pour un participant (aucune autre donnée du profil)
create or replace function public.conversation_instructor_name(p_conversation uuid)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_conversation_participant(p_conversation) then return null; end if;
  return (select p.full_name from public.conversations c join public.profiles p on p.id = c.instructor_id
    where c.id = p_conversation and c.kind = 'course');
end $$;

create or replace function public._mark_read(_conversation uuid, _profile uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.conversation_reads (conversation_id, profile_id, read_at) values (_conversation, _profile, now())
  on conflict (conversation_id, profile_id) do update set read_at = excluded.read_at;
$$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_conversation_participant(p_conversation) then raise exception 'forbidden'; end if;
  perform public._mark_read(p_conversation, auth.uid());
end $$;

create or replace function public.set_conversation_archived(p_conversation uuid, p_archived boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.conversations set archived_by_learner = p_archived
    where id = p_conversation and learner_id = auth.uid();
  if not found then raise exception 'forbidden'; end if;
end $$;

create or replace function public.send_message(
  p_conversation uuid, p_body text,
  p_attachment_path text default null, p_attachment_name text default null,
  p_attachment_size integer default null, p_attachment_mime text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare conv public.conversations%rowtype; mid uuid; body text := trim(coalesce(p_body, ''));
  recipient uuid; title text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into conv from public.conversations where id = p_conversation;
  if not found or not public.is_conversation_participant(p_conversation) then raise exception 'forbidden'; end if;
  if char_length(body) = 0 and p_attachment_path is null then raise exception 'empty_message'; end if;
  if char_length(body) > 4000 then raise exception 'message_too_long'; end if;

  if p_attachment_path is not null then
    -- Le fichier doit se trouver dans le dossier de cette conversation et être d'un type autorisé
    if split_part(p_attachment_path, '/', 1) <> p_conversation::text then raise exception 'attachment_invalid'; end if;
    if p_attachment_mime not in ('application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg','image/png') then raise exception 'attachment_type_not_allowed'; end if;
    if coalesce(p_attachment_size, 0) < 1 or p_attachment_size > 10485760 then raise exception 'attachment_too_large'; end if;
  end if;

  insert into public.messages (conversation_id, sender_id, body, attachment_path, attachment_name, attachment_size, attachment_mime)
  values (p_conversation, auth.uid(), body, p_attachment_path, p_attachment_name, p_attachment_size, p_attachment_mime)
  returning id into mid;

  update public.conversations set last_message_at = now(),
    archived_by_learner = case when auth.uid() <> learner_id then false else archived_by_learner end
    where id = p_conversation;
  perform public._mark_read(p_conversation, auth.uid());

  -- Notifie l'autre partie : le formateur pour une conversation de cours, l'apprenant pour une réponse
  if auth.uid() = conv.learner_id then
    recipient := case when conv.kind = 'course' then conv.instructor_id else null end;
    title := 'Nouveau message';
    if recipient is not null then
      perform public._notify(recipient, 'message_received', title, 'Un apprenant vous a écrit.', '/formateur/messages');
    end if;
  else
    perform public._notify(conv.learner_id, 'message_received', 'Nouveau message', 'Vous avez reçu une réponse.', '/app/messages?c=' || p_conversation::text);
  end if;
  return mid;
end $$;

-- ---------- Stockage des pièces jointes (privé, dossier = identifiant de la conversation) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-files', 'message-files', false, 10485760, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg','image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy message_files_upload on storage.objects for insert
  with check (bucket_id = 'message-files' and public.is_conversation_participant(((storage.foldername(name))[1])::uuid));
create policy message_files_read on storage.objects for select
  using (bucket_id = 'message-files' and public.is_conversation_participant(((storage.foldername(name))[1])::uuid));

-- ---------- Droits ----------
revoke execute on function public.is_support() from public, anon;
grant execute on function public.is_support() to authenticated;
revoke execute on function public.is_conversation_participant(uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid) to authenticated;
revoke execute on function public._mark_read(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.open_course_conversation(uuid) from public, anon;
revoke execute on function public.open_support_conversation() from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.set_conversation_archived(uuid, boolean) from public, anon;
revoke execute on function public.send_message(uuid, text, text, text, integer, text) from public, anon;
grant execute on function public.open_course_conversation(uuid) to authenticated;
grant execute on function public.open_support_conversation() to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.set_conversation_archived(uuid, boolean) to authenticated;
grant execute on function public.send_message(uuid, text, text, text, integer, text) to authenticated;
revoke execute on function public.conversation_instructor_name(uuid) from public, anon;
grant execute on function public.conversation_instructor_name(uuid) to authenticated;
