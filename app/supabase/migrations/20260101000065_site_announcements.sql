-- Bande d'information défilante de la page d'accueil (« marquee »), gérée dans Paramètres > Bande d'info.
--  - site_announcements : messages courts, avec lien facultatif, activables et ordonnés ;
--  - lecture publique des messages actifs, écriture réservée aux administrateurs via les fonctions ci-dessous (tracées dans le journal d'audit).

create table public.site_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) between 3 and 200),
  link_url text check (link_url is null or (char_length(link_url) <= 300 and (link_url ~ '^/[^/\s]' or link_url ~* '^https?://[^\s]+$'))),
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);
create index on public.site_announcements (active, position);
alter table public.site_announcements enable row level security;
create policy site_announcements_public_read on public.site_announcements for select using (active or public.has_role('admin'));
create policy site_announcements_admin_write on public.site_announcements for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- Crée (p_id null) ou modifie un message
create or replace function public.admin_save_announcement(p_id uuid, p_message text, p_link text, p_active boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid; msg text := btrim(coalesce(p_message, '')); lnk text := nullif(btrim(coalesce(p_link, '')), '');
begin
  perform public._admin_only();
  if char_length(msg) < 3 or char_length(msg) > 200 then raise exception 'message_invalid'; end if;
  if p_id is null then
    insert into public.site_announcements (message, link_url, active, position, created_by)
    values (msg, lnk, coalesce(p_active, true), coalesce((select max(position) + 1 from public.site_announcements), 0), auth.uid())
    returning id into rid;
  else
    update public.site_announcements set message = msg, link_url = lnk, active = coalesce(p_active, active), updated_at = now() where id = p_id returning id into rid;
    if rid is null then raise exception 'announcement_not_found'; end if;
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_id is null then 'announcement.create' else 'announcement.update' end, 'site_announcement', rid::text, jsonb_build_object('message', left(msg, 80), 'active', coalesce(p_active, true)));
  return rid;
end $$;

create or replace function public.admin_delete_announcement(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m text;
begin
  perform public._admin_only();
  delete from public.site_announcements where id = p_id returning message into m;
  if not found then raise exception 'announcement_not_found'; end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'announcement.delete', 'site_announcement', p_id::text, jsonb_build_object('message', left(m, 80)));
end $$;

-- Échange la place du message avec son voisin (p_dir : -1 vers le haut, 1 vers le bas)
create or replace function public.admin_move_announcement(p_id uuid, p_dir integer)
returns void language plpgsql security definer set search_path = public as $$
declare ordered uuid[]; i integer; j integer; tmp uuid;
begin
  perform public._admin_only();
  select array_agg(id order by position, created_at, id) into ordered from public.site_announcements;
  i := array_position(ordered, p_id);
  if i is null then raise exception 'announcement_not_found'; end if;
  j := i + case when p_dir < 0 then -1 else 1 end;
  if j < 1 or j > array_length(ordered, 1) then return; end if;
  tmp := ordered[i]; ordered[i] := ordered[j]; ordered[j] := tmp;
  for k in 1..array_length(ordered, 1) loop
    update public.site_announcements set position = k where id = ordered[k];
  end loop;
end $$;

revoke execute on function public.admin_save_announcement(uuid, text, text, boolean) from public, anon;
revoke execute on function public.admin_delete_announcement(uuid) from public, anon;
revoke execute on function public.admin_move_announcement(uuid, integer) from public, anon;
grant execute on function public.admin_save_announcement(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_delete_announcement(uuid) to authenticated;
grant execute on function public.admin_move_announcement(uuid, integer) to authenticated;
