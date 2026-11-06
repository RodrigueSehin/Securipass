-- Lot 4 : création détaillée d'un paiement.
--  - session concernée, montant brut, remise, frais (le montant « amount » reste le total à payer), référence de transaction de l'opérateur ;
--  - pièce justificative : bucket privé « payment-proofs » (PDF, JPG, PNG ; écriture administrateur, dossier <user_id>/...).

alter table public.payments
  add column if not exists session_id uuid references public.sessions(id),
  add column if not exists gross_amount bigint check (gross_amount is null or gross_amount > 0),
  add column if not exists discount_amount bigint not null default 0 check (discount_amount >= 0),
  add column if not exists fees_amount bigint not null default 0 check (fees_amount >= 0),
  add column if not exists transaction_ref text check (transaction_ref is null or char_length(transaction_ref) <= 80),
  add column if not exists proof_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('payment-proofs', 'payment-proofs', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists payment_proofs_admin_write on storage.objects;
create policy payment_proofs_admin_write on storage.objects for insert
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'));
drop policy if exists payment_proofs_staff_read on storage.objects;
create policy payment_proofs_staff_read on storage.objects for select
  using (bucket_id = 'payment-proofs' and public.is_staff());
