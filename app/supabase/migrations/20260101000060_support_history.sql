-- Lot 8 : historique d'un ticket de support.
--  - admin_support_history : actions tracées dans le journal d'audit pour ce ticket (création, copie, statut, priorité, catégorie, assignation,
--    réponses, notes internes, pièces jointes), de la plus récente à la plus ancienne, avec l'auteur (nom, avatar, s'il est le demandeur),
--    les noms des responsables pour les assignations et un extrait des messages (140 caractères).
-- Aucune table ni colonne nouvelle : l'historique lit audit_logs, déjà alimenté par chaque fonction de support.

create or replace function public.admin_support_history(p_ticket uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare req uuid; res jsonb;
begin
  perform public._admin_only();
  select requester_id into req from public.support_tickets where id = p_ticket;
  if req is null then raise exception 'ticket_not_found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'action', l.action, 'occurred_at', l.occurred_at, 'metadata', l.metadata,
      'actor_id', l.actor_id, 'actor_name', coalesce(nullif(a.full_name, ''), a.email), 'actor_avatar', a.avatar_url, 'actor_is_requester', l.actor_id = req,
      'from_name', (select coalesce(nullif(p.full_name, ''), p.email) from public.profiles p where p.id::text = l.metadata->>'from'),
      'to_name', (select coalesce(nullif(p.full_name, ''), p.email) from public.profiles p where p.id::text = l.metadata->>'to'),
      'excerpt', (select left(btrim(m.body), 140) from public.support_messages m where m.id::text = l.metadata->>'message')
    ) order by l.occurred_at desc, l.id desc), '[]'::jsonb) into res
  from public.audit_logs l left join public.profiles a on a.id = l.actor_id
  where l.entity_type = 'support_ticket' and l.entity_id = p_ticket::text and l.action like 'support.%';
  return res;
end $$;

revoke execute on function public.admin_support_history(uuid) from public, anon;
grant execute on function public.admin_support_history(uuid) to authenticated;
