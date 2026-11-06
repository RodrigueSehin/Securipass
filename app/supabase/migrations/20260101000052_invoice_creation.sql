-- Lot 4 : création détaillée d'une facture.
--  - lignes de facture (désignation, quantité, prix unitaire, remise en %) : le montant « amount » de la facture est le total après remises ;
--  - objet, date d'échéance, conditions de paiement, modes de paiement acceptés, e-mail du client (enregistré : aucun e-mail n'est envoyé) ;
--  - statut « brouillon » : une facture brouillon n'est pas comptée parmi les factures émises ; elle s'émet (en attente) ou s'annule ;
--  - pièces jointes : table invoice_files et bucket privé « invoice-files » (écriture administrateur, dossier <user_id>/...).

alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check check (status in ('draft', 'paid', 'pending', 'cancelled'));

alter table public.invoices
  add column if not exists subject text check (subject is null or char_length(subject) <= 200),
  add column if not exists due_date date,
  add column if not exists payment_terms text check (payment_terms is null or payment_terms in ('on_receipt', 'net7', 'net14', 'net30', 'net45')),
  add column if not exists accepted_methods text[] not null default '{}',
  add column if not exists client_email text check (client_email is null or char_length(client_email) <= 254),
  add column if not exists send_email boolean not null default false;

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null default 1,
  description text not null check (char_length(description) between 2 and 200),
  quantity integer not null check (quantity between 1 and 10000),
  unit_price bigint not null check (unit_price >= 0),
  discount_percent numeric(5, 2) not null default 0 check (discount_percent between 0 and 100)
);
create index if not exists invoice_lines_invoice_idx on public.invoice_lines (invoice_id, position);
alter table public.invoice_lines enable row level security;
drop policy if exists invoice_lines_admin on public.invoice_lines;
create policy invoice_lines_admin on public.invoice_lines for all using (public.has_role('admin')) with check (public.has_role('admin'));

create table if not exists public.invoice_files (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  storage_path text not null,
  file_name text not null check (char_length(file_name) <= 200),
  size_bytes integer not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);
create index if not exists invoice_files_invoice_idx on public.invoice_files (invoice_id);
alter table public.invoice_files enable row level security;
drop policy if exists invoice_files_admin on public.invoice_files;
create policy invoice_files_admin on public.invoice_files for all using (public.has_role('admin')) with check (public.has_role('admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('invoice-files', 'invoice-files', false, 10485760, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists invoice_files_admin_write on storage.objects;
create policy invoice_files_admin_write on storage.objects for insert
  with check (bucket_id = 'invoice-files' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'));
drop policy if exists invoice_files_staff_read on storage.objects;
create policy invoice_files_staff_read on storage.objects for select using (bucket_id = 'invoice-files' and public.is_staff());

-- Indicateurs : les brouillons ne comptent pas parmi les factures émises
create or replace function public.admin_billing_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
begin
  perform public._admin_only();
  return jsonb_build_object(
    'invoices', (select jsonb_build_object('count', count(*), 'month', count(*) filter (where issued_at >= cur), 'prev', count(*) filter (where issued_at >= prev and issued_at < cur),
      'paid', count(*) filter (where status = 'paid'), 'pending', count(*) filter (where status = 'pending')) from public.invoices where status <> 'draft'),
    'refunds', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(amount) filter (where status <> 'rejected'), 0)) from public.refunds),
    'credit_notes', (select count(*) from public.credit_notes));
end $$;

-- Options : e-mail des clients (apprenants et entreprises) pour préremplir la facture
create or replace function public.admin_billing_options()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return jsonb_build_object(
    'courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title) order by c.title), '[]'::jsonb)
      from public.courses c where exists (select 1 from public.invoices i where i.course_id = c.id)),
    'all_courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'price', c.price_amount) order by c.title), '[]'::jsonb) from public.courses c where c.status = 'published'),
    'learners', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', coalesce(nullif(p.full_name, ''), p.email), 'email', p.email) order by p.full_name), '[]'::jsonb)
      from (select pr.id, pr.full_name, pr.email from public.profiles pr where public._is_learner(pr.id) order by pr.full_name limit 1000) p),
    'organizations', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'email', o.billing_email) order by o.name), '[]'::jsonb) from public.organizations o),
    'refundable', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'number', x.number, 'payer', x.payer, 'amount', x.amount, 'available', x.available) order by x.issued_at desc), '[]'::jsonb)
      from (select i.id, i.number, i.issued_at, i.amount, coalesce(nullif(l.full_name, ''), l.email, o.name) as payer,
              i.amount - coalesce((select sum(r.amount) from public.refunds r where r.invoice_id = i.id and r.status <> 'rejected'), 0)
                       - coalesce((select sum(c.amount) from public.credit_notes c where c.invoice_id = i.id), 0) as available
            from public.invoices i left join public.profiles l on l.id = i.learner_id left join public.organizations o on o.id = i.organization_id
            where i.status = 'paid' order by i.issued_at desc limit 500) x where x.available > 0));
end $$;

-- Brouillon → émise (en attente) ; en attente → payée ; brouillon ou en attente → annulée
create or replace function public.admin_set_invoice_status(p_invoice uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  perform public._admin_only();
  if p_status not in ('pending', 'paid', 'cancelled') then raise exception 'status_invalid'; end if;
  select status into cur from public.invoices where id = p_invoice for update;
  if cur is null then raise exception 'invoice_not_found'; end if;
  if (p_status = 'pending' and cur <> 'draft') or (p_status = 'paid' and cur <> 'pending') or (p_status = 'cancelled' and cur not in ('draft', 'pending')) then
    raise exception 'invoice_locked';
  end if;
  update public.invoices set status = p_status, issued_at = case when p_status = 'pending' then now() else issued_at end where id = p_invoice;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'invoice.' || p_status, 'invoice', p_invoice::text, jsonb_build_object('from', cur));
end $$;
