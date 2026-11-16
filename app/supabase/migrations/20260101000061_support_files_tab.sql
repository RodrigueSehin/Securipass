-- Onglet « Pièces jointes » du ticket : auteur de chaque ajout (nom, avatar, demandeur ou support)
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
    'files', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'size', f.size, 'mime', f.mime, 'created_at', f.created_at,
        'uploader_name', coalesce(nullif(u.full_name, ''), u.email), 'uploader_avatar', u.avatar_url, 'is_requester', f.uploaded_by = t.requester_id) order by f.created_at, f.id), '[]'::jsonb)
      from public.support_ticket_files f left join public.profiles u on u.id = f.uploaded_by where f.ticket_id = t.id)
  ) into res
  from public.support_tickets t join public.profiles r on r.id = t.requester_id left join public.courses c on c.id = t.course_id
  where t.id = p_ticket;
  if res is null then raise exception 'ticket_not_found'; end if;
  return res;
end $$;
