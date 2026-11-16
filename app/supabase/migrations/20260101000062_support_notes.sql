-- Onglet « Notes internes » : modification et suppression d'une note interne (jamais d'une réponse envoyée à l'utilisateur).
-- Chaque action est tracée dans le journal d'audit, donc visible dans l'historique du ticket.

create or replace function public.admin_edit_support_note(p_message uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare n record; v_body text := btrim(coalesce(p_body, ''));
begin
  perform public._admin_only();
  if char_length(v_body) < 1 or char_length(v_body) > 5000 then raise exception 'body_invalid'; end if;
  select m.ticket_id, t.status into n from public.support_messages m join public.support_tickets t on t.id = m.ticket_id where m.id = p_message and m.internal for update of m;
  if not found then raise exception 'note_not_found'; end if;
  if n.status = 'archived' then raise exception 'ticket_closed'; end if;
  update public.support_messages set body = v_body where id = p_message;
  update public.support_tickets set updated_at = now() where id = n.ticket_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'support.note.edit', 'support_ticket', n.ticket_id::text, jsonb_build_object('message', p_message));
end $$;

create or replace function public.admin_delete_support_note(p_message uuid)
returns void language plpgsql security definer set search_path = public as $$
declare n record;
begin
  perform public._admin_only();
  select m.ticket_id, t.status into n from public.support_messages m join public.support_tickets t on t.id = m.ticket_id where m.id = p_message and m.internal for update of m;
  if not found then raise exception 'note_not_found'; end if;
  if n.status = 'archived' then raise exception 'ticket_closed'; end if;
  delete from public.support_messages where id = p_message;
  update public.support_tickets set updated_at = now() where id = n.ticket_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'support.note.delete', 'support_ticket', n.ticket_id::text, '{}'::jsonb);
end $$;

revoke execute on function public.admin_edit_support_note(uuid, text) from public, anon;
revoke execute on function public.admin_delete_support_note(uuid) from public, anon;
grant execute on function public.admin_edit_support_note(uuid, text) to authenticated;
grant execute on function public.admin_delete_support_note(uuid) to authenticated;
