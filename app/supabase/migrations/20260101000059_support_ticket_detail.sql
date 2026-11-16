-- Lot 8 : détail d'un ticket de support.
--  - support_tickets.course_id : formation concernée (facultative) ;
--  - support_messages : réponses à l'utilisateur et notes internes (jamais lues par le demandeur), texte brut ;
--  - support_ticket_files : pièces jointes (bucket privé « support-files », 10 Mo, PDF / images / texte ; écriture administrateur, dossier <user_id>/...) ;
--  - admin_get_support_ticket : ticket, demandeur, formation, messages et pièces jointes en un appel ;
--  - réponse (un ticket nouveau passe « en cours » et revient à l'auteur s'il n'a pas de responsable), note interne, pièces jointes,
--    réassignation à un administrateur ou au support, changement de catégorie, duplication ; tout est tracé dans le journal d'audit.
-- Le demandeur peut lire les réponses (pas les notes internes) de ses tickets ; aucun écran côté utilisateur n'existe encore.

alter table public.support_tickets add column course_id uuid references public.courses(id) on delete set null;
create index on public.support_tickets (course_id);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.support_messages (ticket_id, created_at);
alter table public.support_messages enable row level security;
create policy support_messages_admin on public.support_messages for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy support_messages_requester on public.support_messages for select
  using (not internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.requester_id = auth.uid()));

create table public.support_ticket_files (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  path text not null check (char_length(path) between 3 and 300 and path !~ '\.\.'),
  name text not null check (char_length(name) between 1 and 200),
  size bigint not null check (size >= 0),
  mime text check (mime is null or char_length(mime) <= 100),
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.support_ticket_files (ticket_id, created_at);
alter table public.support_ticket_files enable row level security;
create policy support_ticket_files_admin on public.support_ticket_files for all using (public.has_role('admin')) with check (public.has_role('admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('support-files', 'support-files', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists support_files_admin_write on storage.objects;
create policy support_files_admin_write on storage.objects for insert
  with check (bucket_id = 'support-files' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'));
drop policy if exists support_files_admin_read on storage.objects;
create policy support_files_admin_read on storage.objects for select using (bucket_id = 'support-files' and public.has_role('admin'));
drop policy if exists support_files_admin_delete on storage.objects;
create policy support_files_admin_delete on storage.objects for delete using (bucket_id = 'support-files' and public.has_role('admin'));

-- La création accepte la formation concernée
drop function if exists public.admin_create_support_ticket(uuid, text, text, text, text);
create or replace function public.admin_create_support_ticket(p_requester uuid, p_subject text, p_description text, p_category text, p_priority text, p_course uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tid uuid; ref text;
begin
  perform public._admin_only();
  if not exists (select 1 from public.profiles where id = p_requester) then raise exception 'requester_not_found'; end if;
  if p_course is not null and not exists (select 1 from public.courses where id = p_course) then raise exception 'course_not_found'; end if;
  insert into public.support_tickets (requester_id, subject, description, category, priority, course_id, created_by)
  values (p_requester, btrim(p_subject), nullif(btrim(coalesce(p_description, '')), ''), p_category, p_priority, p_course, auth.uid())
  returning id, reference into tid, ref;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'support.create', 'support_ticket', tid::text, jsonb_build_object('reference', ref, 'category', p_category, 'priority', p_priority));
  return jsonb_build_object('id', tid, 'reference', ref);
end $$;

create or replace function public.admin_get_support_ticket(p_ticket uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  perform public._admin_only();
  select jsonb_build_object(
    'ticket', jsonb_build_object('id', t.id, 'reference', t.reference, 'subject', t.subject, 'description', t.description, 'category', t.category, 'priority', t.priority,
      'status', t.status, 'created_at', t.created_at, 'updated_at', t.updated_at, 'resolved_at', t.resolved_at, 'assigned_to', t.assigned_to,
      'course_id', t.course_id, 'course_title', c.title),
    'requester', jsonb_build_object('id', r.id, 'name', coalesce(nullif(r.full_name, ''), r.email), 'email', r.email, 'phone', r.phone, 'avatar_url', r.avatar_url,
      'code', coalesce(r.learner_code, (select ro.name from public.user_roles ur join public.roles ro on ro.id = ur.role_id where ur.user_id = r.id order by ro.code limit 1))),
    'messages', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'author_id', m.author_id, 'author_name', coalesce(nullif(a.full_name, ''), a.email),
        'author_avatar', a.avatar_url, 'internal', m.internal, 'body', m.body, 'created_at', m.created_at, 'is_requester', m.author_id = t.requester_id) order by m.created_at, m.id), '[]'::jsonb)
      from public.support_messages m join public.profiles a on a.id = m.author_id where m.ticket_id = t.id),
    'files', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'size', f.size, 'mime', f.mime, 'created_at', f.created_at) order by f.created_at, f.id), '[]'::jsonb)
      from public.support_ticket_files f where f.ticket_id = t.id)
  ) into res
  from public.support_tickets t join public.profiles r on r.id = t.requester_id left join public.courses c on c.id = t.course_id
  where t.id = p_ticket;
  if res is null then raise exception 'ticket_not_found'; end if;
  return res;
end $$;

-- Réponse à l'utilisateur ou note interne ; un ticket nouveau passe « en cours » et revient à l'auteur s'il n'a pas de responsable
create or replace function public.admin_post_support_message(p_ticket uuid, p_body text, p_internal boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare cur record; mid uuid; body text := btrim(coalesce(p_body, ''));
begin
  perform public._admin_only();
  if char_length(body) < 1 or char_length(body) > 5000 then raise exception 'body_invalid'; end if;
  select status, assigned_to into cur from public.support_tickets where id = p_ticket for update;
  if not found then raise exception 'ticket_not_found'; end if;
  if cur.status = 'archived' then raise exception 'ticket_closed'; end if;
  insert into public.support_messages (ticket_id, author_id, body, internal) values (p_ticket, auth.uid(), body, coalesce(p_internal, false)) returning id into mid;
  if not coalesce(p_internal, false) and cur.status = 'new' then
    update public.support_tickets set status = 'in_progress', assigned_to = coalesce(assigned_to, auth.uid()) where id = p_ticket;
  else
    update public.support_tickets set updated_at = now() where id = p_ticket;
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when coalesce(p_internal, false) then 'support.note' else 'support.reply' end, 'support_ticket', p_ticket::text, jsonb_build_object('message', mid));
  return mid;
end $$;

create or replace function public.admin_add_support_file(p_ticket uuid, p_path text, p_name text, p_size bigint, p_mime text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid; st text;
begin
  perform public._admin_only();
  if p_path is null or position(auth.uid()::text || '/' in p_path) <> 1 or p_path ~ '\.\.' then raise exception 'path_invalid'; end if;
  select status into st from public.support_tickets where id = p_ticket for update;
  if st is null then raise exception 'ticket_not_found'; end if;
  if st = 'archived' then raise exception 'ticket_closed'; end if;
  insert into public.support_ticket_files (ticket_id, path, name, size, mime, uploaded_by) values (p_ticket, p_path, left(btrim(p_name), 200), greatest(coalesce(p_size, 0), 0), p_mime, auth.uid())
  returning id into fid;
  update public.support_tickets set updated_at = now() where id = p_ticket;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'support.file.add', 'support_ticket', p_ticket::text, jsonb_build_object('file', fid, 'name', left(btrim(p_name), 200)));
  return fid;
end $$;

-- Retire la pièce jointe et renvoie son chemin de stockage (à supprimer ensuite par l'appelant)
create or replace function public.admin_remove_support_file(p_file uuid)
returns text language plpgsql security definer set search_path = public as $$
declare f record;
begin
  perform public._admin_only();
  select ticket_id, path, name into f from public.support_ticket_files where id = p_file;
  if not found then raise exception 'file_not_found'; end if;
  delete from public.support_ticket_files where id = p_file;
  update public.support_tickets set updated_at = now() where id = f.ticket_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'support.file.remove', 'support_ticket', f.ticket_id::text, jsonb_build_object('name', f.name));
  return f.path;
end $$;

-- Responsables possibles : administrateurs et équipe support
create or replace function public.admin_support_staff()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', coalesce(nullif(p.full_name, ''), p.email)) order by p.full_name, p.email), '[]'::jsonb)
    from public.profiles p where p.status = 'active' and exists (select 1 from public.user_roles ur join public.roles ro on ro.id = ur.role_id where ur.user_id = p.id and ro.code in ('admin', 'support')));
end $$;

create or replace function public.admin_reassign_support_ticket(p_ticket uuid, p_assignee uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cur record;
begin
  perform public._admin_only();
  if p_assignee is not null and not exists (select 1 from public.user_roles ur join public.roles ro on ro.id = ur.role_id where ur.user_id = p_assignee and ro.code in ('admin', 'support')) then
    raise exception 'assignee_invalid';
  end if;
  select status, assigned_to into cur from public.support_tickets where id = p_ticket for update;
  if not found then raise exception 'ticket_not_found'; end if;
  if cur.status in ('resolved', 'archived') then raise exception 'ticket_closed'; end if;
  update public.support_tickets set assigned_to = p_assignee, status = case when p_assignee is not null and cur.status = 'new' then 'in_progress' else cur.status end where id = p_ticket;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'support.reassign', 'support_ticket', p_ticket::text, jsonb_build_object('from', cur.assigned_to, 'to', p_assignee));
end $$;

create or replace function public.admin_set_support_category(p_ticket uuid, p_category text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  perform public._admin_only();
  if p_category not in ('formations', 'paiements', 'certifications', 'sessions', 'compte', 'documents', 'technique', 'utilisateurs', 'evaluations', 'autres') then raise exception 'category_invalid'; end if;
  select category into cur from public.support_tickets where id = p_ticket for update;
  if cur is null then raise exception 'ticket_not_found'; end if;
  update public.support_tickets set category = p_category where id = p_ticket;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'support.category', 'support_ticket', p_ticket::text, jsonb_build_object('from', cur, 'to', p_category));
end $$;

-- Copie le ticket (demandeur, sujet, description, catégorie, priorité, formation) en un nouveau ticket « nouveau », sans responsable ni messages
create or replace function public.admin_duplicate_support_ticket(p_ticket uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare src record; tid uuid; ref text;
begin
  perform public._admin_only();
  select * into src from public.support_tickets where id = p_ticket;
  if not found then raise exception 'ticket_not_found'; end if;
  insert into public.support_tickets (requester_id, subject, description, category, priority, course_id, created_by)
  values (src.requester_id, src.subject, src.description, src.category, src.priority, src.course_id, auth.uid()) returning id, reference into tid, ref;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'support.duplicate', 'support_ticket', tid::text, jsonb_build_object('from', src.reference, 'reference', ref));
  return jsonb_build_object('id', tid, 'reference', ref);
end $$;

revoke execute on function public.admin_create_support_ticket(uuid, text, text, text, text, uuid) from public, anon;
revoke execute on function public.admin_get_support_ticket(uuid) from public, anon;
revoke execute on function public.admin_post_support_message(uuid, text, boolean) from public, anon;
revoke execute on function public.admin_add_support_file(uuid, text, text, bigint, text) from public, anon;
revoke execute on function public.admin_remove_support_file(uuid) from public, anon;
revoke execute on function public.admin_support_staff() from public, anon;
revoke execute on function public.admin_reassign_support_ticket(uuid, uuid) from public, anon;
revoke execute on function public.admin_set_support_category(uuid, text) from public, anon;
revoke execute on function public.admin_duplicate_support_ticket(uuid) from public, anon;
grant execute on function public.admin_create_support_ticket(uuid, text, text, text, text, uuid) to authenticated;
grant execute on function public.admin_get_support_ticket(uuid) to authenticated;
grant execute on function public.admin_post_support_message(uuid, text, boolean) to authenticated;
grant execute on function public.admin_add_support_file(uuid, text, text, bigint, text) to authenticated;
grant execute on function public.admin_remove_support_file(uuid) to authenticated;
grant execute on function public.admin_support_staff() to authenticated;
grant execute on function public.admin_reassign_support_ticket(uuid, uuid) to authenticated;
grant execute on function public.admin_set_support_category(uuid, text) to authenticated;
grant execute on function public.admin_duplicate_support_ticket(uuid) to authenticated;
