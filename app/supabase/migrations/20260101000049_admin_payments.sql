-- Lot 4 : paiements gérés par l'administration.
--  - table payments : référence PAY-AAAA-NNNN, payeur (apprenant ou entreprise), objet (formation, certification, session, autre service),
--    montant en FCFA, mode, statut (confirmed | pending | failed | cancelled), date de paiement ;
--  - les montants déjà encaissés saisis sur les inscriptions (amount_paid) sont repris comme paiements de formation ;
--  - liste, indicateurs, évolution sur 6 mois, répartition par type, confirmation / échec / annulation d'un paiement en attente.
-- Les paiements sont saisis par l'administration : aucun paiement en ligne n'est déclenché.

create sequence public.payment_ref_seq;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('PAY-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.payment_ref_seq')::text, 4, '0')),
  kind text not null default 'course' check (kind in ('course', 'certification', 'session', 'other')),
  learner_id uuid references public.profiles(id),
  organization_id uuid references public.organizations(id),
  course_id uuid references public.courses(id),
  enrollment_id uuid references public.enrollments(id),
  label text check (label is null or char_length(label) <= 200),
  amount bigint not null check (amount > 0),
  method text not null check (method in ('mobile_money', 'card', 'bank_transfer', 'cash', 'cheque')),
  status text not null default 'pending' check (status in ('confirmed', 'pending', 'failed', 'cancelled')),
  paid_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 500),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (learner_id is not null or organization_id is not null)
);
create index on public.payments (status, paid_at desc);
create index on public.payments (course_id);
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();
alter table public.payments enable row level security;
create policy payments_staff on public.payments for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy payments_own on public.payments for select using (learner_id = auth.uid());

-- Reprise des montants saisis sur les inscriptions
insert into public.payments (kind, learner_id, course_id, enrollment_id, amount, method, status, paid_at, created_by)
select 'course', e.learner_id, e.course_id, e.id, e.amount_paid, coalesce(e.payment_method, 'cash'),
       case e.payment_status when 'paid' then 'confirmed' when 'unpaid' then 'failed' else 'pending' end, e.enrolled_at, e.created_by
from public.enrollments e where coalesce(e.amount_paid, 0) > 0
order by e.enrolled_at;

create or replace function public.admin_payments_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
  res jsonb;
begin
  perform public._admin_only();
  select jsonb_build_object(
    'total', coalesce(sum(amount), 0),
    'total_month', coalesce(sum(amount) filter (where paid_at >= cur), 0),
    'total_prev', coalesce(sum(amount) filter (where paid_at >= prev and paid_at < cur), 0),
    'confirmed', coalesce(sum(amount) filter (where status = 'confirmed'), 0),
    'pending', coalesce(sum(amount) filter (where status = 'pending'), 0),
    'failed', coalesce(sum(amount) filter (where status in ('failed', 'cancelled')), 0),
    'counts', jsonb_build_object('all', count(*), 'confirmed', count(*) filter (where status = 'confirmed'), 'pending', count(*) filter (where status = 'pending'),
                                 'failed', count(*) filter (where status in ('failed', 'cancelled'))),
    'by_kind', jsonb_build_object(
      'course', coalesce(sum(amount) filter (where status = 'confirmed' and kind = 'course'), 0),
      'certification', coalesce(sum(amount) filter (where status = 'confirmed' and kind = 'certification'), 0),
      'session', coalesce(sum(amount) filter (where status = 'confirmed' and kind = 'session'), 0),
      'other', coalesce(sum(amount) filter (where status = 'confirmed' and kind = 'other'), 0)),
    'months', (select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
        'amount', coalesce((select sum(p.amount) from public.payments p where p.status = 'confirmed' and date_trunc('month', p.paid_at at time zone 'UTC') = m), 0)) order by m), '[]'::jsonb)
      from generate_series(date_trunc('month', now() at time zone 'UTC') - interval '5 months', date_trunc('month', now() at time zone 'UTC'), interval '1 month') m)
  ) into res from public.payments;
  return res;
end $$;

create or replace function public.admin_payments_options()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return jsonb_build_object(
    'courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title) order by c.title), '[]'::jsonb)
      from public.courses c where exists (select 1 from public.payments p where p.course_id = c.id)),
    'all_courses', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'price', c.price_amount) order by c.title), '[]'::jsonb) from public.courses c where c.status = 'published'),
    'learners', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', coalesce(nullif(p.full_name, ''), p.email)) order by p.full_name), '[]'::jsonb)
      from (select pr.id, pr.full_name, pr.email from public.profiles pr where public._is_learner(pr.id) order by pr.full_name limit 1000) p),
    'organizations', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) order by o.name), '[]'::jsonb) from public.organizations o));
end $$;

create or replace function public._payment_filter_ids(p_q text, p_course uuid, p_status text, p_from date, p_to date)
returns table (id uuid) language plpgsql stable security definer set search_path = public as $$
declare q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
begin
  return query
  select p.id from public.payments p
  left join public.profiles l on l.id = p.learner_id left join public.organizations o on o.id = p.organization_id left join public.courses c on c.id = p.course_id
  where (q = '' or p.reference ilike '%' || q || '%' or coalesce(l.full_name, '') ilike '%' || q || '%' or coalesce(o.name, '') ilike '%' || q || '%'
         or coalesce(c.title, '') ilike '%' || q || '%' or coalesce(p.label, '') ilike '%' || q || '%')
    and (p_course is null or p.course_id = p_course)
    and (coalesce(p_status, '') = '' or (p_status = 'failed' and p.status in ('failed', 'cancelled')) or p.status = p_status)
    and (p_from is null or p.paid_at >= p_from::timestamptz)
    and (p_to is null or p.paid_at < (p_to + 1)::timestamptz);
end $$;
revoke execute on function public._payment_filter_ids(text, uuid, text, date, date) from public, anon, authenticated;

-- p_status : confirmed | pending | failed (échoués et annulés)
create or replace function public.admin_list_payments(
  p_q text default '', p_course uuid default null, p_status text default '', p_from date default null, p_to date default null,
  p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare total integer; rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  select count(*) into total from public._payment_filter_ids(p_q, p_course, p_status, p_from, p_to);
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by p.paid_at desc, p.id) as ord, p.id, p.reference, p.kind, p.amount, p.method, p.status, p.paid_at, p.course_id,
      coalesce(c.title, p.label, 'Paiement') as purpose,
      coalesce(nullif(l.full_name, ''), l.email, o.name) as payer_name, l.avatar_url as payer_avatar, (p.learner_id is null) as payer_is_company
    from public.payments p
    left join public.profiles l on l.id = p.learner_id left join public.organizations o on o.id = p.organization_id left join public.courses c on c.id = p.course_id
    where p.id in (select id from public._payment_filter_ids(p_q, p_course, p_status, p_from, p_to))
    order by ord limit p_limit offset p_offset
  ) t;
  return jsonb_build_object('total', total, 'rows', rows);
end $$;

-- Un paiement en attente est confirmé, déclaré échoué ou annulé ; les autres statuts sont définitifs
create or replace function public.admin_set_payment_status(p_payment uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  perform public._admin_only();
  if p_status not in ('confirmed', 'failed', 'cancelled') then raise exception 'status_invalid'; end if;
  select status into cur from public.payments where id = p_payment for update;
  if cur is null then raise exception 'payment_not_found'; end if;
  if cur <> 'pending' then raise exception 'payment_locked'; end if;
  update public.payments set status = p_status where id = p_payment;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'payment.' || p_status, 'payment', p_payment::text, jsonb_build_object('from', cur));
end $$;

revoke execute on function public.admin_payments_stats() from public, anon;
revoke execute on function public.admin_payments_options() from public, anon;
revoke execute on function public.admin_list_payments(text, uuid, text, date, date, integer, integer) from public, anon;
revoke execute on function public.admin_set_payment_status(uuid, text) from public, anon;
grant execute on function public.admin_payments_stats() to authenticated;
grant execute on function public.admin_payments_options() to authenticated;
grant execute on function public.admin_list_payments(text, uuid, text, date, date, integer, integer) to authenticated;
grant execute on function public.admin_set_payment_status(uuid, text) to authenticated;
