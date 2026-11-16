-- Lot 8 : création détaillée d'un versement de commissions.
--  - frais, titulaire, établissement (ou opérateur), numéro de compte, motif et justificatif sur le versement ;
--    « amount » reste le total des commissions soldées, le net versé est amount - fees_amount ;
--  - justificatif : bucket privé « payout-proofs » (PDF, JPG, PNG ; écriture administrateur, dossier <user_id>/...) ;
--  - admin_payout_options : formateurs ayant des commissions en attente, avec leurs lignes à verser ;
--  - admin_create_payout : verse les commissions choisies (toutes en attente et du même formateur), en une transaction.

alter table public.payouts
  add column fees_amount bigint not null default 0 check (fees_amount >= 0),
  add column account_holder text check (account_holder is null or char_length(account_holder) <= 120),
  add column bank_name text check (bank_name is null or char_length(bank_name) <= 120),
  add column account_number text check (account_number is null or char_length(account_number) <= 60),
  add column reason text check (reason is null or char_length(reason) <= 200),
  add column proof_path text,
  add constraint payouts_fees_within_amount check (fees_amount <= amount);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('payout-proofs', 'payout-proofs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists payout_proofs_admin_write on storage.objects;
create policy payout_proofs_admin_write on storage.objects for insert
  with check (bucket_id = 'payout-proofs' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'));
drop policy if exists payout_proofs_staff_read on storage.objects;
create policy payout_proofs_staff_read on storage.objects for select
  using (bucket_id = 'payout-proofs' and public.is_staff());

create or replace function public.admin_payout_options()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return jsonb_build_object('instructors', (
    select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.name), '[]'::jsonb) from (
      select p.id, coalesce(nullif(p.full_name, ''), p.email) as name, p.email, p.phone, p.avatar_url,
        (select coalesce(jsonb_agg(row_to_json(g)::jsonb order by g.session_start nulls last, g.course_title), '[]'::jsonb) from (
          select co.id as course_id, co.title as course_title, co.cover_url, s.id as session_id, s.title as session_title, s.start_at as session_start, s.end_at as session_end,
            sum(c.amount)::bigint as amount, array_agg(c.id order by c.earned_at) as ids
          from public.commissions c
          join public.courses co on co.id = c.course_id
          left join public.sessions s on s.id = c.session_id
          where c.instructor_id = p.id and c.status = 'pending' and c.amount > 0
          group by co.id, co.title, co.cover_url, s.id, s.title, s.start_at, s.end_at) g) as groups
      from public.profiles p
      where exists (select 1 from public.commissions c where c.instructor_id = p.id and c.status = 'pending' and c.amount > 0)) t));
end $$;

create or replace function public.admin_create_payout(
  p_instructor uuid, p_commissions uuid[], p_method text, p_paid_at timestamptz, p_fees bigint,
  p_holder text, p_bank text, p_account text, p_reason text, p_proof text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ids uuid[]; locked integer; total bigint; pid uuid; ref text;
begin
  perform public._admin_only();
  if p_method is null or p_method not in ('mobile_money', 'bank_transfer', 'cash', 'cheque') then raise exception 'method_invalid'; end if;
  select coalesce(array_agg(distinct x), '{}') into ids from unnest(coalesce(p_commissions, '{}')) x;
  if cardinality(ids) = 0 then raise exception 'commissions_required'; end if;
  if p_paid_at is null or p_paid_at > now() + interval '5 minutes' then raise exception 'date_invalid'; end if;

  select count(*), coalesce(sum(amount), 0) into locked, total from (
    select amount from public.commissions where id = any(ids) and instructor_id = p_instructor and status = 'pending' for update) c;
  if locked <> cardinality(ids) then raise exception 'commissions_invalid'; end if;
  if total <= 0 then raise exception 'nothing_to_pay'; end if;
  if coalesce(p_fees, 0) < 0 or coalesce(p_fees, 0) > total then raise exception 'fees_invalid'; end if;

  insert into public.payouts (instructor_id, amount, fees_amount, method, paid_at, account_holder, bank_name, account_number, reason, proof_path, created_by)
  values (p_instructor, total, coalesce(p_fees, 0), p_method, p_paid_at, nullif(btrim(p_holder), ''), nullif(btrim(p_bank), ''), nullif(btrim(p_account), ''),
          nullif(btrim(p_reason), ''), nullif(p_proof, ''), auth.uid())
  returning id, reference into pid, ref;
  update public.commissions set status = 'paid', payout_id = pid where id = any(ids);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'payout.create', 'payout', pid::text,
          jsonb_build_object('instructor', p_instructor, 'amount', total, 'fees', coalesce(p_fees, 0), 'commissions', cardinality(ids), 'method', p_method, 'reference', ref));
  return jsonb_build_object('id', pid, 'reference', ref);
end $$;

revoke execute on function public.admin_payout_options() from public, anon;
revoke execute on function public.admin_create_payout(uuid, uuid[], text, timestamptz, bigint, text, text, text, text, text) from public, anon;
grant execute on function public.admin_payout_options() to authenticated;
grant execute on function public.admin_create_payout(uuid, uuid[], text, timestamptz, bigint, text, text, text, text, text) to authenticated;
