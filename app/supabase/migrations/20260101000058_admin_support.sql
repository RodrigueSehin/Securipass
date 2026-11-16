-- Lot 8 : support — tickets d'assistance gérés par l'administration.
--  - support_tickets : référence SUP-NNNN, demandeur, sujet, catégorie, priorité, statut, responsable, dates de résolution et d'archivage ;
--  - statuts : new (nouveau) | in_progress (en cours) | waiting (en attente) | resolved (résolu) | archived (archivé) ;
--    seul un ticket résolu s'archive ; le rouvrir efface ses dates de résolution et d'archivage ;
--  - délai de résolution visé (SLA) selon la priorité : haute 8 h, moyenne 24 h, basse 72 h ;
--  - liste par onglet (tous, les miens, non assignés, résolus, archivés), filtres, indicateurs et évolution, répartition par catégorie, respect du délai ;
--  - création par l'administration pour un demandeur, assignation, changement de statut et de priorité, tracés dans le journal d'audit.
-- Les tickets ne sont pas encore ouverts par les utilisateurs eux-mêmes ; le demandeur peut lire les siens.

create sequence public.support_ticket_seq;

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('SUP-' || lpad(nextval('public.support_ticket_seq')::text, 4, '0')),
  requester_id uuid not null references public.profiles(id),
  subject text not null check (char_length(subject) between 3 and 200),
  description text check (description is null or char_length(description) <= 4000),
  category text not null default 'autres' check (category in ('formations', 'paiements', 'certifications', 'sessions', 'compte', 'documents', 'technique', 'utilisateurs', 'evaluations', 'autres')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'waiting', 'resolved', 'archived')),
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  resolved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('resolved', 'archived')) = (resolved_at is not null)),
  check ((status = 'archived') = (archived_at is not null))
);
create index on public.support_tickets (status, updated_at desc);
create index on public.support_tickets (assigned_to, status);
create index on public.support_tickets (requester_id);
create index on public.support_tickets (category);
create trigger support_tickets_touch before update on public.support_tickets
  for each row execute function public.touch_updated_at();
alter table public.support_tickets enable row level security;
create policy support_tickets_admin on public.support_tickets for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy support_tickets_own on public.support_tickets for select using (requester_id = auth.uid());

create or replace function public._support_sla_hours(p_priority text)
returns integer language sql immutable as $$
  select case p_priority when 'high' then 8 when 'medium' then 24 else 72 end;
$$;
revoke execute on function public._support_sla_hours(text) from public, anon, authenticated;

create or replace function public.admin_support_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
  me uuid := auth.uid();
  res jsonb;
begin
  perform public._admin_only();
  select jsonb_build_object(
    'total', count(*),
    'total_month', count(*) filter (where created_at >= cur),
    'total_prev', count(*) filter (where created_at >= prev and created_at < cur),
    'new', count(*) filter (where status = 'new'),
    'in_progress', count(*) filter (where status = 'in_progress'),
    'waiting', count(*) filter (where status = 'waiting'),
    'resolved', count(*) filter (where status = 'resolved'),
    'archived', count(*) filter (where status = 'archived'),
    'tabs', jsonb_build_object(
      'all', count(*),
      'mine', count(*) filter (where assigned_to = me and status not in ('resolved', 'archived')),
      'unassigned', count(*) filter (where assigned_to is null and status not in ('resolved', 'archived')),
      'resolved', count(*) filter (where status = 'resolved'),
      'archived', count(*) filter (where status = 'archived')),
    'avg_seconds', (select round(avg(extract(epoch from resolved_at - created_at))) from public.support_tickets where resolved_at is not null),
    'avg_month', (select round(avg(extract(epoch from resolved_at - created_at))) from public.support_tickets where resolved_at >= cur),
    'avg_prev', (select round(avg(extract(epoch from resolved_at - created_at))) from public.support_tickets where resolved_at >= prev and resolved_at < cur),
    'sla', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where resolved_at - created_at <= make_interval(hours => public._support_sla_hours(priority))) / count(*)) end
              from public.support_tickets where resolved_at is not null),
    'sla_month', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where resolved_at - created_at <= make_interval(hours => public._support_sla_hours(priority))) / count(*)) end
              from public.support_tickets where resolved_at >= cur),
    'sla_prev', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where resolved_at - created_at <= make_interval(hours => public._support_sla_hours(priority))) / count(*)) end
              from public.support_tickets where resolved_at >= prev and resolved_at < cur),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('category', c.category, 'count', c.n) order by c.n desc, c.category), '[]'::jsonb)
                   from (select category, count(*) as n from public.support_tickets group by category) c)
  ) into res from public.support_tickets;
  return res;
end $$;

-- p_tab : all | mine | unassigned | resolved | archived
create or replace function public.admin_list_support_tickets(
  p_tab text default 'all', p_q text default '', p_category text default '', p_status text default '', p_priority text default '',
  p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_'); total integer; rows jsonb; me uuid := auth.uid();
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  with f as (
    select t.id from public.support_tickets t join public.profiles r on r.id = t.requester_id
    where (case coalesce(p_tab, 'all')
             when 'mine' then t.assigned_to = me and t.status not in ('resolved', 'archived')
             when 'unassigned' then t.assigned_to is null and t.status not in ('resolved', 'archived')
             when 'resolved' then t.status = 'resolved'
             when 'archived' then t.status = 'archived'
             else true end)
      and (q = '' or t.reference ilike '%' || q || '%' or t.subject ilike '%' || q || '%' or coalesce(r.full_name, '') ilike '%' || q || '%'
           or r.email ilike '%' || q || '%' or coalesce(r.learner_code, '') ilike '%' || q || '%')
      and (coalesce(p_category, '') = '' or t.category = p_category)
      and (coalesce(p_status, '') = '' or t.status = p_status)
      and (coalesce(p_priority, '') = '' or t.priority = p_priority)
  )
  select (select count(*) from f),
    (select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.ord), '[]'::jsonb) from (
      select row_number() over (order by t.updated_at desc, t.id) as ord, t.id, t.reference, t.subject, t.category, t.priority, t.status, t.created_at, t.updated_at,
        r.id as requester_id, coalesce(nullif(r.full_name, ''), r.email) as requester_name, r.avatar_url as requester_avatar,
        coalesce(r.learner_code, (select ro.name from public.user_roles ur join public.roles ro on ro.id = ur.role_id where ur.user_id = r.id order by ro.code limit 1)) as requester_code,
        t.assigned_to, coalesce(nullif(a.full_name, ''), a.email) as assignee_name
      from public.support_tickets t join public.profiles r on r.id = t.requester_id left join public.profiles a on a.id = t.assigned_to
      where t.id in (select id from f)
      order by ord limit p_limit offset p_offset) x)
  into total, rows;
  return jsonb_build_object('total', total, 'rows', rows);
end $$;

-- Personnes qui peuvent être demandeur d'un ticket
create or replace function public.admin_support_requesters()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', coalesce(nullif(p.full_name, ''), p.email), 'email', p.email, 'code', p.learner_code) order by p.full_name, p.email), '[]'::jsonb)
    from (select id, full_name, email, learner_code from public.profiles where status = 'active' order by full_name limit 1000) p);
end $$;

create or replace function public.admin_create_support_ticket(p_requester uuid, p_subject text, p_description text, p_category text, p_priority text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tid uuid; ref text;
begin
  perform public._admin_only();
  if not exists (select 1 from public.profiles where id = p_requester) then raise exception 'requester_not_found'; end if;
  insert into public.support_tickets (requester_id, subject, description, category, priority, created_by)
  values (p_requester, btrim(p_subject), nullif(btrim(coalesce(p_description, '')), ''), p_category, p_priority, auth.uid())
  returning id, reference into tid, ref;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'support.create', 'support_ticket', tid::text, jsonb_build_object('reference', ref, 'category', p_category, 'priority', p_priority));
  return jsonb_build_object('id', tid, 'reference', ref);
end $$;

-- Assigne le ticket à l'administrateur qui agit (p_me) ou le désassigne ; un ticket nouveau passe « en cours » à sa prise en charge
create or replace function public.admin_assign_support_ticket(p_ticket uuid, p_me boolean)
returns void language plpgsql security definer set search_path = public as $$
declare cur record;
begin
  perform public._admin_only();
  select status, assigned_to into cur from public.support_tickets where id = p_ticket for update;
  if not found then raise exception 'ticket_not_found'; end if;
  if cur.status in ('resolved', 'archived') then raise exception 'ticket_closed'; end if;
  update public.support_tickets set assigned_to = case when p_me then auth.uid() else null end,
    status = case when p_me and cur.status = 'new' then 'in_progress' else cur.status end where id = p_ticket;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), case when p_me then 'support.assign' else 'support.unassign' end, 'support_ticket', p_ticket::text, jsonb_build_object('from', cur.assigned_to));
end $$;

create or replace function public.admin_set_support_status(p_ticket uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  perform public._admin_only();
  if p_status not in ('new', 'in_progress', 'waiting', 'resolved', 'archived') then raise exception 'status_invalid'; end if;
  select status into cur from public.support_tickets where id = p_ticket for update;
  if cur is null then raise exception 'ticket_not_found'; end if;
  if p_status = 'archived' and cur <> 'resolved' then raise exception 'archive_requires_resolved'; end if;
  update public.support_tickets set status = p_status,
    resolved_at = case when p_status = 'resolved' then coalesce(resolved_at, now()) when p_status = 'archived' then resolved_at else null end,
    archived_at = case when p_status = 'archived' then now() else null end
  where id = p_ticket;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'support.status', 'support_ticket', p_ticket::text, jsonb_build_object('from', cur, 'to', p_status));
end $$;

create or replace function public.admin_set_support_priority(p_ticket uuid, p_priority text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  perform public._admin_only();
  if p_priority not in ('high', 'medium', 'low') then raise exception 'priority_invalid'; end if;
  select priority into cur from public.support_tickets where id = p_ticket for update;
  if cur is null then raise exception 'ticket_not_found'; end if;
  update public.support_tickets set priority = p_priority where id = p_ticket;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'support.priority', 'support_ticket', p_ticket::text, jsonb_build_object('from', cur, 'to', p_priority));
end $$;

revoke execute on function public.admin_support_stats() from public, anon;
revoke execute on function public.admin_list_support_tickets(text, text, text, text, text, integer, integer) from public, anon;
revoke execute on function public.admin_support_requesters() from public, anon;
revoke execute on function public.admin_create_support_ticket(uuid, text, text, text, text) from public, anon;
revoke execute on function public.admin_assign_support_ticket(uuid, boolean) from public, anon;
revoke execute on function public.admin_set_support_status(uuid, text) from public, anon;
revoke execute on function public.admin_set_support_priority(uuid, text) from public, anon;
grant execute on function public.admin_support_stats() to authenticated;
grant execute on function public.admin_list_support_tickets(text, text, text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_support_requesters() to authenticated;
grant execute on function public.admin_create_support_ticket(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_assign_support_ticket(uuid, boolean) to authenticated;
grant execute on function public.admin_set_support_status(uuid, text) to authenticated;
grant execute on function public.admin_set_support_priority(uuid, text) to authenticated;
