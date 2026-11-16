-- Lot 8 : commissions et versements aux formateurs, gérés par l'administration.
--  - commission_settings : taux de commission de la plateforme (15 % par défaut), appliqué aux paiements confirmés à venir ;
--  - commissions : une ligne par paiement confirmé d'une formation (chiffre d'affaires, taux figé, montant) ; créée, mise à jour ou
--    supprimée avec le paiement tant qu'elle n'est pas versée ;
--  - payouts : versements au formateur (référence VER-AAAA-NNNN) qui soldent des commissions ;
--  - liste regroupée par formateur / formation / session, indicateurs, évolution sur 6 mois, versement d'un groupe, taux.
-- Aucun virement réel n'est déclenché : l'administration enregistre les versements qu'elle a effectués.

create table public.commission_settings (
  id boolean primary key default true check (id),
  rate_percent numeric(5,2) not null default 15 check (rate_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.commission_settings default values;

create sequence public.payout_ref_seq;

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('VER-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.payout_ref_seq')::text, 4, '0')),
  instructor_id uuid not null references public.profiles(id),
  amount bigint not null check (amount > 0),
  method text check (method is null or method in ('mobile_money', 'bank_transfer', 'cash', 'cheque')),
  note text check (note is null or char_length(note) <= 500),
  paid_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.payouts (instructor_id, paid_at desc);
create index on public.payouts (paid_at desc);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  instructor_id uuid not null references public.profiles(id),
  course_id uuid not null references public.courses(id),
  session_id uuid references public.sessions(id) on delete set null,
  revenue bigint not null check (revenue > 0),
  rate_percent numeric(5,2) not null check (rate_percent between 0 and 100),
  amount bigint not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  payout_id uuid references public.payouts(id),
  earned_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((status = 'paid') = (payout_id is not null))
);
create index on public.commissions (instructor_id, status);
create index on public.commissions (course_id, session_id);
create index on public.commissions (earned_at desc);

alter table public.commission_settings enable row level security;
alter table public.payouts enable row level security;
alter table public.commissions enable row level security;
create policy commission_settings_admin on public.commission_settings for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy payouts_admin on public.payouts for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy payouts_own on public.payouts for select using (instructor_id = auth.uid());
create policy commissions_admin on public.commissions for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy commissions_own on public.commissions for select using (instructor_id = auth.uid());

-- Une commission suit son paiement : créée à la confirmation, retirée si le paiement ne l'est plus (sauf si déjà versée)
create or replace function public._sync_commission()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_instructor uuid; v_session uuid; v_rate numeric;
begin
  if new.status = 'confirmed' and new.course_id is not null then
    select instructor_id into v_instructor from public.courses where id = new.course_id;
    select session_id into v_session from public.enrollments where id = new.enrollment_id;
    select rate_percent into v_rate from public.commission_settings;
    insert into public.commissions (payment_id, instructor_id, course_id, session_id, revenue, rate_percent, amount, earned_at)
    values (new.id, v_instructor, new.course_id, v_session, new.amount, v_rate, round(new.amount * v_rate / 100), new.paid_at)
    on conflict (payment_id) do update
      set revenue = excluded.revenue, amount = round(excluded.revenue * public.commissions.rate_percent / 100),
          earned_at = excluded.earned_at, session_id = excluded.session_id
      where public.commissions.status = 'pending';
  else
    delete from public.commissions where payment_id = new.id and status = 'pending';
  end if;
  return new;
end $$;
revoke execute on function public._sync_commission() from public, anon, authenticated;

create trigger payments_commission after insert or update of status, amount, paid_at on public.payments
  for each row execute function public._sync_commission();

-- Reprise des paiements déjà confirmés
insert into public.commissions (payment_id, instructor_id, course_id, session_id, revenue, rate_percent, amount, earned_at)
select p.id, c.instructor_id, p.course_id, e.session_id, p.amount, s.rate_percent, round(p.amount * s.rate_percent / 100), p.paid_at
from public.payments p
join public.courses c on c.id = p.course_id
left join public.enrollments e on e.id = p.enrollment_id
cross join public.commission_settings s
where p.status = 'confirmed' and p.course_id is not null;

create or replace function public.admin_commissions_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
  res jsonb;
begin
  perform public._admin_only();
  select jsonb_build_object(
    'rate', (select rate_percent from public.commission_settings),
    'revenue', coalesce(sum(revenue), 0),
    'revenue_month', coalesce(sum(revenue) filter (where earned_at >= cur), 0),
    'revenue_prev', coalesce(sum(revenue) filter (where earned_at >= prev and earned_at < cur), 0),
    'commission', coalesce(sum(amount), 0),
    'commission_month', coalesce(sum(amount) filter (where earned_at >= cur), 0),
    'commission_prev', coalesce(sum(amount) filter (where earned_at >= prev and earned_at < cur), 0),
    'pending', coalesce(sum(amount) filter (where status = 'pending'), 0),
    'paid', (select coalesce(sum(amount), 0) from public.payouts),
    'paid_month', (select coalesce(sum(amount), 0) from public.payouts where paid_at >= cur),
    'paid_prev', (select coalesce(sum(amount), 0) from public.payouts where paid_at >= prev and paid_at < cur),
    'months', (select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
        'amount', coalesce((select sum(c.amount) from public.commissions c where date_trunc('month', c.earned_at at time zone 'UTC') = m), 0)) order by m), '[]'::jsonb)
      from generate_series(date_trunc('month', now() at time zone 'UTC') - interval '5 months', date_trunc('month', now() at time zone 'UTC'), interval '1 month') m)
  ) into res from public.commissions;
  return res;
end $$;

create or replace function public.admin_commissions_options()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return jsonb_build_object(
    'instructors', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', coalesce(nullif(p.full_name, ''), p.email)) order by p.full_name), '[]'::jsonb)
      from public.profiles p where p.id in (select instructor_id from public.commissions)),
    'months', (select coalesce(jsonb_agg(x.m order by x.m desc), '[]'::jsonb)
      from (select distinct to_char(earned_at at time zone 'UTC', 'YYYY-MM') as m from public.commissions) x));
end $$;

-- p_month : AAAA-MM ; p_status : paid | pending (une ligne est versée quand toutes ses commissions le sont)
create or replace function public.admin_list_commissions(
  p_q text default '', p_month text default '', p_status text default '', p_instructor uuid default null,
  p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q text := replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_'); total integer; rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  with g as (
    select c.instructor_id, c.course_id, c.session_id, sum(c.revenue)::bigint as revenue, sum(c.amount)::bigint as amount,
      coalesce(sum(c.amount) filter (where c.status = 'pending'), 0)::bigint as pending_amount,
      bool_and(c.status = 'paid') as all_paid, max(c.earned_at) as last_at
    from public.commissions c
    join public.profiles i on i.id = c.instructor_id
    join public.courses co on co.id = c.course_id
    left join public.sessions s on s.id = c.session_id
    where (q = '' or coalesce(i.full_name, '') ilike '%' || q || '%' or co.title ilike '%' || q || '%' or coalesce(s.title, '') ilike '%' || q || '%')
      and (p_instructor is null or c.instructor_id = p_instructor)
      and (coalesce(p_month, '') = '' or to_char(c.earned_at at time zone 'UTC', 'YYYY-MM') = p_month)
    group by c.instructor_id, c.course_id, c.session_id
    having coalesce(p_status, '') = '' or (p_status = 'paid' and bool_and(c.status = 'paid')) or (p_status = 'pending' and not bool_and(c.status = 'paid'))
  )
  select (select count(*) from g),
    (select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) from (
      select row_number() over (order by g.last_at desc, g.instructor_id, g.course_id, g.session_id) as ord,
        g.instructor_id, coalesce(nullif(i.full_name, ''), i.email) as instructor_name, i.avatar_url as instructor_avatar,
        g.course_id, co.title as course_title, g.session_id, s.title as session_title, s.start_at as session_start,
        g.revenue, g.amount, case when g.revenue > 0 then round(g.amount * 100.0 / g.revenue, 2) else 0 end as rate,
        g.pending_amount, case when g.all_paid then 'paid' else 'pending' end as status, g.last_at
      from g
      join public.profiles i on i.id = g.instructor_id
      join public.courses co on co.id = g.course_id
      left join public.sessions s on s.id = g.session_id
      order by ord limit p_limit offset p_offset) t)
  into total, rows;
  return jsonb_build_object('total', total, 'rows', rows);
end $$;

-- Verse toutes les commissions en attente d'un formateur pour une formation et une session (null = sans session)
create or replace function public.admin_pay_commissions(p_instructor uuid, p_course uuid, p_session uuid, p_method text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare total bigint; n integer; pid uuid;
begin
  perform public._admin_only();
  if p_method is not null and p_method not in ('mobile_money', 'bank_transfer', 'cash', 'cheque') then raise exception 'method_invalid'; end if;
  perform 1 from public.commissions
    where instructor_id = p_instructor and course_id = p_course and session_id is not distinct from p_session and status = 'pending' for update;
  select coalesce(sum(amount), 0), count(*) into total, n from public.commissions
    where instructor_id = p_instructor and course_id = p_course and session_id is not distinct from p_session and status = 'pending';
  if n = 0 or total <= 0 then raise exception 'nothing_to_pay'; end if;
  insert into public.payouts (instructor_id, amount, method, created_by) values (p_instructor, total, p_method, auth.uid()) returning id into pid;
  update public.commissions set status = 'paid', payout_id = pid
    where instructor_id = p_instructor and course_id = p_course and session_id is not distinct from p_session and status = 'pending';
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'payout.create', 'payout', pid::text, jsonb_build_object('instructor', p_instructor, 'amount', total, 'commissions', n));
  return pid;
end $$;

create or replace function public.admin_recent_payouts(p_limit integer default 3)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return (select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.paid_at desc), '[]'::jsonb) from (
    select p.id, coalesce(nullif(i.full_name, ''), i.email) as instructor_name, i.avatar_url as instructor_avatar, p.amount, p.paid_at
    from public.payouts p join public.profiles i on i.id = p.instructor_id
    order by p.paid_at desc, p.id limit least(greatest(coalesce(p_limit, 3), 1), 20)) t);
end $$;

create or replace function public.admin_list_payouts(p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare total integer; rows jsonb;
begin
  perform public._admin_only();
  p_limit := least(greatest(coalesce(p_limit, 10), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  select count(*) into total from public.payouts;
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.ord), '[]'::jsonb) into rows from (
    select row_number() over (order by p.paid_at desc, p.id) as ord, p.id, p.reference, p.amount, p.method, p.paid_at, p.note,
      coalesce(nullif(i.full_name, ''), i.email) as instructor_name, i.avatar_url as instructor_avatar,
      (select count(*) from public.commissions c where c.payout_id = p.id)::int as commissions
    from public.payouts p join public.profiles i on i.id = p.instructor_id
    order by ord limit p_limit offset p_offset) t;
  return jsonb_build_object('total', total, 'rows', rows);
end $$;

-- Le nouveau taux s'applique aux paiements confirmés à partir de maintenant ; les commissions existantes gardent le leur
create or replace function public.admin_set_commission_rate(p_rate numeric)
returns void language plpgsql security definer set search_path = public as $$
declare old numeric;
begin
  perform public._admin_only();
  if p_rate is null or p_rate < 0 or p_rate > 100 then raise exception 'rate_invalid'; end if;
  select rate_percent into old from public.commission_settings;
  update public.commission_settings set rate_percent = p_rate, updated_at = now(), updated_by = auth.uid();
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'commission.rate', 'commission_settings', 'default', jsonb_build_object('from', old, 'to', p_rate));
end $$;

revoke execute on function public.admin_commissions_stats() from public, anon;
revoke execute on function public.admin_commissions_options() from public, anon;
revoke execute on function public.admin_list_commissions(text, text, text, uuid, integer, integer) from public, anon;
revoke execute on function public.admin_pay_commissions(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.admin_recent_payouts(integer) from public, anon;
revoke execute on function public.admin_list_payouts(integer, integer) from public, anon;
revoke execute on function public.admin_set_commission_rate(numeric) from public, anon;
grant execute on function public.admin_commissions_stats() to authenticated;
grant execute on function public.admin_commissions_options() to authenticated;
grant execute on function public.admin_list_commissions(text, text, text, uuid, integer, integer) to authenticated;
grant execute on function public.admin_pay_commissions(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.admin_recent_payouts(integer) to authenticated;
grant execute on function public.admin_list_payouts(integer, integer) to authenticated;
grant execute on function public.admin_set_commission_rate(numeric) to authenticated;
