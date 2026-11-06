-- Lot 4 : factures, remboursements et avoirs gérés par l'administration.
--  - invoices : numéro FACT-AAAA-NNNN ; une facture est créée automatiquement pour chaque paiement (et suit son statut) ; des factures manuelles sont possibles ;
--  - refunds : numéro RMB-AAAA-NNNN, rattaché à une facture payée ; statuts in_progress → refunded | rejected ;
--  - credit_notes : numéro AV-AAAA-NNNN, rattaché à une facture ;
--  - listes, indicateurs, changements de statut tracés dans le journal d'audit.
-- Statut d'une facture : paid | pending | cancelled. Les montants sont en FCFA.

create sequence public.invoice_number_seq;
create sequence public.refund_number_seq;
create sequence public.credit_note_number_seq;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('FACT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0')),
  payment_id uuid unique references public.payments(id) on delete set null,
  learner_id uuid references public.profiles(id),
  organization_id uuid references public.organizations(id),
  course_id uuid references public.courses(id),
  label text check (label is null or char_length(label) <= 200),
  amount bigint not null check (amount > 0),
  status text not null default 'pending' check (status in ('paid', 'pending', 'cancelled')),
  issued_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 500),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (learner_id is not null or organization_id is not null)
);
create index on public.invoices (status, issued_at desc);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('RMB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.refund_number_seq')::text, 4, '0')),
  invoice_id uuid not null references public.invoices(id),
  amount bigint not null check (amount > 0),
  reason text not null check (char_length(reason) between 2 and 500),
  status text not null default 'in_progress' check (status in ('in_progress', 'refunded', 'rejected')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.refunds (status, requested_at desc);
create index on public.refunds (invoice_id);

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('AV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.credit_note_number_seq')::text, 4, '0')),
  invoice_id uuid not null references public.invoices(id),
  amount bigint not null check (amount > 0),
  reason text not null check (char_length(reason) between 2 and 500),
  issued_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.credit_notes (invoice_id);

create trigger invoices_touch before update on public.invoices for each row execute function public.touch_updated_at();
create trigger refunds_touch before update on public.refunds for each row execute function public.touch_updated_at();
alter table public.invoices enable row level security;
alter table public.refunds enable row level security;
alter table public.credit_notes enable row level security;
create policy invoices_admin on public.invoices for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy invoices_own on public.invoices for select using (learner_id = auth.uid());
create policy refunds_admin on public.refunds for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy credit_notes_admin on public.credit_notes for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- Une facture par paiement, qui en suit le statut
create or replace function public._invoice_status_of_payment(p_status text)
returns text language sql immutable as $$
  select case p_status when 'confirmed' then 'paid' when 'pending' then 'pending' else 'cancelled' end;
$$;

create or replace function public._sync_invoice_with_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.invoices (payment_id, learner_id, organization_id, course_id, label, amount, status, issued_at, created_by)
    values (new.id, new.learner_id, new.organization_id, new.course_id, new.label, new.amount, public._invoice_status_of_payment(new.status), new.paid_at, new.created_by)
    on conflict (payment_id) do nothing;
  else
    update public.invoices set status = public._invoice_status_of_payment(new.status) where payment_id = new.id and status <> public._invoice_status_of_payment(new.status);
  end if;
  return new;
end $$;
create trigger payments_sync_invoice after insert or update of status on public.payments
  for each row execute function public._sync_invoice_with_payment();

-- Reprise : une facture pour chaque paiement existant
insert into public.invoices (payment_id, learner_id, organization_id, course_id, label, amount, status, issued_at, created_by)
select p.id, p.learner_id, p.organization_id, p.course_id, p.label, p.amount, public._invoice_status_of_payment(p.status), p.paid_at, p.created_by
from public.payments p order by p.paid_at;

create or replace function public.admin_billing_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
begin
  perform public._admin_only();
  return jsonb_build_object(
    'invoices', (select jsonb_build_object('count', count(*), 'month', count(*) filter (where issued_at >= cur), 'prev', count(*) filter (where issued_at >= prev and issued_at < cur),
      'paid', count(*) filter (where status = 'paid'), 'pending', count(*) filter (where status = 'pending')) from public.invoices),
    'refunds', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(amount) filter (where status <> 'rejected'), 0)) from public.refunds),
    'credit_notes', (select count(*) from public.credit_notes));
end $$;

create or replace function public.admin_billing_options()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return jsonb_build_object(
    'courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title) order by c.title), '[]'::jsonb)
      from public.courses c where exists (select 1 from public.invoices i where i.course_id = c.id)),
    'all_courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'price', c.price_amount) order by c.title), '[]'::jsonb) from public.courses c where c.status = 'published'),
    'learners', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', coalesce(nullif(p.full_name, ''), p.email)) order by p.full_name), '[]'::jsonb)
      from (select pr.id, pr.full_name, pr.email from public.profiles pr where public._is_learner(pr.id) order by pr.full_name limit 1000) p),
    'organizations', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) order by o.name), '[]'::jsonb) from public.organizations o),
    -- Factures payées sur lesquelles un remboursement ou un avoir est encore possible
    'refundable', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'number', x.number, 'payer', x.payer, 'amount', x.amount, 'available', x.available) order by x.issued_at desc), '[]'::jsonb)
      from (select i.id, i.number, i.issued_at, i.amount, coalesce(nullif(l.full_name, ''), l.email, o.name) as payer,
              i.amount - coalesce((select sum(r.amount) from public.refunds r where r.invoice_id = i.id and r.status <> 'rejected'), 0)
                       - coalesce((select sum(c.amount) from public.credit_notes c where c.invoice_id = i.id), 0) as available
            from public.invoices i left join public.profiles l on l.id = i.learner_id left join public.organizations o on o.id = i.organization_id
            where i.status = 'paid' order by i.issued_at desc limit 500) x where x.available > 0));
end $$;

create or replace function public._invoice_filter_ids(p_q text, p_course uuid, p_status text, p_from date, p_to date)
returns table (id uuid) language plpgsql stable security definer set search_path = public as $$
declare q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
begin
  return query
  select i.id from public.invoices i
  left join public.profiles l on l.id = i.learner_id left join public.organizations o on o.id = i.organization_id left join public.courses c on c.id = i.course_id
  where (q = '' or i.number ilike '%' || q || '%' or coalesce(l.full_name, '') ilike '%' || q || '%' or coalesce(o.name, '') ilike '%' || q || '%'
         or coalesce(c.title, '') ilike '%' || q || '%' or coalesce(i.label, '') ilike '%' || q || '%')
    and (p_course is null or i.course_id = p_course)
    and (coalesce(p_status, '') = '' or i.status = p_status)
    and (p_from is null or i.issued_at >= p_from::timestamptz)
    and (p_to is null or i.issued_at < (p_to + 1)::timestamptz);
end $$;
revoke execute on function public._invoice_filter_ids(text, uuid, text, date, date) from public, anon, authenticated;

create or replace function public.admin_list_invoices(
  p_q text default '', p_course uuid default null, p_status text default '', p_from date default null, p_to date default null, p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare total integer; rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  select count(*) into total from public._invoice_filter_ids(p_q, p_course, p_status, p_from, p_to);
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by i.issued_at desc, i.id) as ord, i.id, i.number, i.amount, i.status, i.issued_at,
      coalesce(c.title, i.label, 'Facture') as purpose, coalesce(nullif(l.full_name, ''), l.email, o.name) as payer_name, l.avatar_url as payer_avatar, (i.learner_id is null) as payer_is_company
    from public.invoices i left join public.profiles l on l.id = i.learner_id left join public.organizations o on o.id = i.organization_id left join public.courses c on c.id = i.course_id
    where i.id in (select id from public._invoice_filter_ids(p_q, p_course, p_status, p_from, p_to))
    order by ord limit p_limit offset p_offset
  ) t;
  return jsonb_build_object('total', total, 'rows', rows);
end $$;

-- p_status : in_progress | refunded | rejected
create or replace function public.admin_list_refunds(
  p_q text default '', p_status text default '', p_from date default null, p_to date default null, p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
  total integer; rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  select count(*) into total from public.refunds r join public.invoices i on i.id = r.invoice_id
    left join public.profiles l on l.id = i.learner_id left join public.organizations o on o.id = i.organization_id
    where (q = '' or r.number ilike '%' || q || '%' or i.number ilike '%' || q || '%' or coalesce(l.full_name, '') ilike '%' || q || '%' or coalesce(o.name, '') ilike '%' || q || '%')
      and (coalesce(p_status, '') = '' or r.status = p_status)
      and (p_from is null or r.requested_at >= p_from::timestamptz) and (p_to is null or r.requested_at < (p_to + 1)::timestamptz);
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by r.requested_at desc, r.id) as ord, r.id, r.number, r.amount, r.reason, r.status, r.requested_at, i.number as invoice_number,
      coalesce(nullif(l.full_name, ''), l.email, o.name) as payer_name, l.avatar_url as payer_avatar, (i.learner_id is null) as payer_is_company
    from public.refunds r join public.invoices i on i.id = r.invoice_id
      left join public.profiles l on l.id = i.learner_id left join public.organizations o on o.id = i.organization_id
    where (q = '' or r.number ilike '%' || q || '%' or i.number ilike '%' || q || '%' or coalesce(l.full_name, '') ilike '%' || q || '%' or coalesce(o.name, '') ilike '%' || q || '%')
      and (coalesce(p_status, '') = '' or r.status = p_status)
      and (p_from is null or r.requested_at >= p_from::timestamptz) and (p_to is null or r.requested_at < (p_to + 1)::timestamptz)
    order by ord limit p_limit offset p_offset
  ) t;
  return jsonb_build_object('total', total, 'rows', rows);
end $$;

create or replace function public.admin_list_credit_notes(
  p_q text default '', p_from date default null, p_to date default null, p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
  total integer; rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  select count(*) into total from public.credit_notes c join public.invoices i on i.id = c.invoice_id
    left join public.profiles l on l.id = i.learner_id left join public.organizations o on o.id = i.organization_id
    where (q = '' or c.number ilike '%' || q || '%' or i.number ilike '%' || q || '%' or coalesce(l.full_name, '') ilike '%' || q || '%' or coalesce(o.name, '') ilike '%' || q || '%')
      and (p_from is null or c.issued_at >= p_from::timestamptz) and (p_to is null or c.issued_at < (p_to + 1)::timestamptz);
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by c.issued_at desc, c.id) as ord, c.id, c.number, c.amount, c.reason, c.issued_at, i.number as invoice_number,
      coalesce(nullif(l.full_name, ''), l.email, o.name) as payer_name, l.avatar_url as payer_avatar, (i.learner_id is null) as payer_is_company
    from public.credit_notes c join public.invoices i on i.id = c.invoice_id
      left join public.profiles l on l.id = i.learner_id left join public.organizations o on o.id = i.organization_id
    where (q = '' or c.number ilike '%' || q || '%' or i.number ilike '%' || q || '%' or coalesce(l.full_name, '') ilike '%' || q || '%' or coalesce(o.name, '') ilike '%' || q || '%')
      and (p_from is null or c.issued_at >= p_from::timestamptz) and (p_to is null or c.issued_at < (p_to + 1)::timestamptz)
    order by ord limit p_limit offset p_offset
  ) t;
  return jsonb_build_object('total', total, 'rows', rows);
end $$;

create or replace function public.admin_recent_refunds(p_limit integer default 3)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'number', x.number, 'amount', x.amount, 'status', x.status, 'requested_at', x.requested_at, 'payer_name', x.payer_name) order by x.requested_at desc), '[]'::jsonb)
    from (select r.id, r.number, r.amount, r.status, r.requested_at, coalesce(nullif(l.full_name, ''), l.email, o.name) as payer_name
          from public.refunds r join public.invoices i on i.id = r.invoice_id left join public.profiles l on l.id = i.learner_id left join public.organizations o on o.id = i.organization_id
          order by r.requested_at desc limit least(greatest(coalesce(p_limit, 3), 1), 10)) x);
end $$;

-- Une facture en attente est marquée payée ou annulée ; les autres statuts sont définitifs
create or replace function public.admin_set_invoice_status(p_invoice uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  perform public._admin_only();
  if p_status not in ('paid', 'cancelled') then raise exception 'status_invalid'; end if;
  select status into cur from public.invoices where id = p_invoice for update;
  if cur is null then raise exception 'invoice_not_found'; end if;
  if cur <> 'pending' then raise exception 'invoice_locked'; end if;
  update public.invoices set status = p_status where id = p_invoice;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'invoice.' || p_status, 'invoice', p_invoice::text, jsonb_build_object('from', cur));
end $$;

-- Un remboursement en cours est effectué ou refusé
create or replace function public.admin_set_refund_status(p_refund uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  perform public._admin_only();
  if p_status not in ('refunded', 'rejected') then raise exception 'status_invalid'; end if;
  select status into cur from public.refunds where id = p_refund for update;
  if cur is null then raise exception 'refund_not_found'; end if;
  if cur <> 'in_progress' then raise exception 'refund_locked'; end if;
  update public.refunds set status = p_status, processed_at = now() where id = p_refund;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'refund.' || p_status, 'refund', p_refund::text, jsonb_build_object('from', cur));
end $$;

revoke execute on function public._invoice_status_of_payment(text) from public, anon, authenticated;
revoke execute on function public._sync_invoice_with_payment() from public, anon, authenticated;
revoke execute on function public.admin_billing_stats() from public, anon;
revoke execute on function public.admin_billing_options() from public, anon;
revoke execute on function public.admin_list_invoices(text, uuid, text, date, date, integer, integer) from public, anon;
revoke execute on function public.admin_list_refunds(text, text, date, date, integer, integer) from public, anon;
revoke execute on function public.admin_list_credit_notes(text, date, date, integer, integer) from public, anon;
revoke execute on function public.admin_recent_refunds(integer) from public, anon;
revoke execute on function public.admin_set_invoice_status(uuid, text) from public, anon;
revoke execute on function public.admin_set_refund_status(uuid, text) from public, anon;
grant execute on function public.admin_billing_stats() to authenticated;
grant execute on function public.admin_billing_options() to authenticated;
grant execute on function public.admin_list_invoices(text, uuid, text, date, date, integer, integer) to authenticated;
grant execute on function public.admin_list_refunds(text, text, date, date, integer, integer) to authenticated;
grant execute on function public.admin_list_credit_notes(text, date, date, integer, integer) to authenticated;
grant execute on function public.admin_recent_refunds(integer) to authenticated;
grant execute on function public.admin_set_invoice_status(uuid, text) to authenticated;
grant execute on function public.admin_set_refund_status(uuid, text) to authenticated;
