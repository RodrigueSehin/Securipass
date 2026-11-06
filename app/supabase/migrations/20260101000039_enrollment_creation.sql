-- Lot 4 : création d'une inscription par l'administration.
--  - référence unique INS-AAAA-NNNNN (attribuée à l'insertion, rétro-remplie pour l'existant) ;
--  - source, notes, suivi de paiement saisi par l'administrateur (montant, payé, statut, mode : informatif, aucun paiement en ligne) ;
--  - pièces jointes : table enrollment_documents et bucket privé « enrollment-docs » (écriture administrateur, dossier <user_id>/...) ;
--  - fonction admin_create_enrollment : verrouille la session, respecte la capacité et la liste d'attente, trace l'audit.

create sequence public.enrollment_ref_seq;

alter table public.enrollments
  add column reference text,
  add column source text not null default 'administration' check (source in ('administration', 'phone', 'onsite', 'company', 'online')),
  add column notes text check (notes is null or char_length(notes) <= 500),
  add column amount_due bigint check (amount_due is null or amount_due >= 0),
  add column amount_paid bigint check (amount_paid is null or amount_paid >= 0),
  add column payment_status text check (payment_status is null or payment_status in ('pending', 'to_verify', 'paid', 'unpaid')),
  add column payment_method text check (payment_method is null or payment_method in ('cash', 'mobile_money', 'bank_transfer', 'card', 'cheque'));

update public.enrollments e set reference = 'INS-' || to_char(e.enrolled_at, 'YYYY') || '-' || lpad(n.rn::text, 5, '0')
from (select id, nextval('public.enrollment_ref_seq') as rn from (select id from public.enrollments order by enrolled_at, id) o) n
where n.id = e.id;

alter table public.enrollments alter column reference set not null;
create unique index enrollments_reference_key on public.enrollments (reference);

create or replace function public._enrollment_set_reference()
returns trigger language plpgsql as $$
begin
  if new.reference is null then
    new.reference := 'INS-' || to_char(coalesce(new.enrolled_at, now()), 'YYYY') || '-' || lpad(nextval('public.enrollment_ref_seq')::text, 5, '0');
  end if;
  return new;
end $$;
create trigger enrollments_reference before insert on public.enrollments
  for each row execute function public._enrollment_set_reference();

create table public.enrollment_documents (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  storage_path text not null,
  file_name text not null check (char_length(file_name) <= 200),
  size_bytes integer not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);
create index on public.enrollment_documents (enrollment_id);
alter table public.enrollment_documents enable row level security;
create policy enrollment_documents_staff on public.enrollment_documents for all using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('enrollment-docs', 'enrollment-docs', false, 5242880, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy enrollment_docs_admin_write on storage.objects for insert
  with check (bucket_id = 'enrollment-docs' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('admin'));
create policy enrollment_docs_staff_read on storage.objects for select
  using (bucket_id = 'enrollment-docs' and public.is_staff());

-- p_status : pending (en attente de validation) | confirmed (validée, liste d'attente si la session est complète)
create or replace function public.admin_create_enrollment(
  p_learner uuid, p_course uuid, p_session uuid, p_status text, p_date date, p_source text, p_notes text,
  p_amount_due bigint, p_amount_paid bigint, p_payment_status text, p_payment_method text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.sessions%rowtype; new_status text; eid uuid; ref text; at timestamptz;
begin
  perform public._admin_only();
  if p_status not in ('pending', 'confirmed') then raise exception 'status_invalid'; end if;
  if not exists (select 1 from public.profiles where id = p_learner) then raise exception 'learner_not_found'; end if;
  if not exists (select 1 from public.courses where id = p_course and status = 'published') then raise exception 'course_not_available'; end if;

  select * into s from public.sessions where id = p_session for update;
  if not found or s.course_id <> p_course or s.status <> 'scheduled' or s.end_at <= now() then raise exception 'session_invalid'; end if;

  if p_status = 'pending' then new_status := 'pending_approval';
  elsif public.session_seats_taken(p_session) < s.capacity then new_status := 'confirmed';
  elsif s.waitlist_enabled then new_status := 'waitlisted';
  else raise exception 'session_full';
  end if;

  at := case when p_date is null or p_date = current_date then now() else p_date::timestamptz + interval '12 hours' end;
  begin
    insert into public.enrollments (learner_id, course_id, session_id, status, enrolled_at, created_by, source, notes,
      amount_due, amount_paid, payment_status, payment_method)
    values (p_learner, p_course, p_session, new_status, at, auth.uid(), coalesce(p_source, 'administration'), nullif(btrim(p_notes), ''),
      p_amount_due, p_amount_paid, p_payment_status, p_payment_method)
    returning id, reference into eid, ref;
  exception when unique_violation then
    raise exception 'already_enrolled';
  end;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'enrollment.admin_create', 'enrollment', eid::text,
          jsonb_build_object('session_id', p_session, 'learner_id', p_learner, 'status', new_status, 'reference', ref));
  return jsonb_build_object('enrollment_id', eid, 'status', new_status, 'reference', ref);
end $$;

revoke execute on function public.admin_create_enrollment(uuid, uuid, uuid, text, date, text, text, bigint, bigint, text, text) from public, anon;
grant execute on function public.admin_create_enrollment(uuid, uuid, uuid, text, date, text, text, bigint, bigint, text, text) to authenticated;

-- p_status : pending | validated | refused | waitlisted | suspended | expired ; p_sort : recent (défaut) | old
create or replace function public.admin_list_enrollments(
  p_q text default '', p_course uuid default null, p_session uuid default null, p_status text default '',
  p_from date default null, p_to date default null, p_sort text default 'recent', p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_');
  total integer;
  rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*) into total
  from public.enrollments e join public.profiles l on l.id = e.learner_id join public.courses c on c.id = e.course_id
  where (q = '' or l.full_name ilike '%' || q || '%' or l.email ilike '%' || q || '%' or coalesce(l.phone, '') ilike '%' || q || '%' or c.title ilike '%' || q || '%')
    and (p_course is null or e.course_id = p_course)
    and (p_session is null or e.session_id = p_session)
    and (coalesce(p_status, '') = '' or public._enrollment_group(e.status) = p_status)
    and (p_from is null or e.enrolled_at >= p_from::timestamptz)
    and (p_to is null or e.enrolled_at < (p_to + 1)::timestamptz);

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows
  from (
    select row_number() over (order by
        case when p_sort = 'old' then e.enrolled_at end asc,
        case when p_sort <> 'old' then e.enrolled_at end desc, e.id) as ord,
      e.id, e.reference, e.payment_status, e.status, e.enrolled_at,
      l.id as learner_id, l.full_name as learner_name, l.avatar_url as learner_avatar, l.phone as learner_phone, l.email as learner_email,
      c.id as course_id, c.title as course_title,
      s.id as session_id, s.title as session_title, s.timezone as session_timezone
    from public.enrollments e join public.profiles l on l.id = e.learner_id join public.courses c on c.id = e.course_id
    left join public.sessions s on s.id = e.session_id
    where (q = '' or l.full_name ilike '%' || q || '%' or l.email ilike '%' || q || '%' or coalesce(l.phone, '') ilike '%' || q || '%' or c.title ilike '%' || q || '%')
      and (p_course is null or e.course_id = p_course)
      and (p_session is null or e.session_id = p_session)
      and (coalesce(p_status, '') = '' or public._enrollment_group(e.status) = p_status)
      and (p_from is null or e.enrolled_at >= p_from::timestamptz)
      and (p_to is null or e.enrolled_at < (p_to + 1)::timestamptz)
    order by ord
    limit p_limit offset p_offset
  ) t;

  return jsonb_build_object('total', total, 'rows', rows);
end $$;
