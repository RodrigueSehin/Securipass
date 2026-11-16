-- Lot 8 : rapports d'administration.
--  - admin_reports_overview : indicateurs d'un mois (inscriptions, apprenants actifs, sessions, certifications, commissions),
--    évolution des inscriptions sur 6 mois, répartition et classement des formations, taux de complétion, de réussite et de présence ;
--  - admin_report_rows : lignes détaillées de 9 rapports (inscriptions, formations, sessions, apprenants, évaluations, certifications,
--    financier, présences, activité) pour un mois, 5 000 lignes au plus ; les colonnes sont décrites côté application ;
--  - report_runs : historique des rapports générés (nom, type, période, auteur, format), alimenté à chaque génération.
-- Un mois s'écrit AAAA-MM (vide = mois en cours). Les inscriptions annulées ne comptent pas. Format de sortie : CSV.

create table public.report_runs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('inscriptions', 'formations', 'sessions', 'apprenants', 'evaluations', 'certifications', 'financier', 'presences', 'activite')),
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  name text not null check (char_length(name) between 3 and 200),
  format text not null default 'csv' check (format in ('csv')),
  row_count integer not null default 0 check (row_count >= 0),
  generated_by uuid references public.profiles(id),
  generated_at timestamptz not null default now()
);
create index on public.report_runs (generated_at desc);
alter table public.report_runs enable row level security;
create policy report_runs_admin on public.report_runs for all using (public.has_role('admin')) with check (public.has_role('admin'));

create or replace function public._report_start(p_month text)
returns timestamptz language plpgsql stable as $$
begin
  if coalesce(p_month, '') = '' then return date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'; end if;
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'month_invalid'; end if;
  return (p_month || '-01')::date::timestamp at time zone 'UTC';
end $$;

create or replace function public._enrollment_status_label(p text)
returns text language sql immutable as $$
  select case p when 'confirmed' then 'Confirmée' when 'completed' then 'Terminée' when 'pending_payment' then 'Paiement en attente'
    when 'pending_approval' then 'En attente de validation' when 'waitlisted' then 'Liste d’attente' when 'cancelled' then 'Annulée'
    when 'suspended' then 'Suspendue' when 'expired' then 'Expirée' else p end;
$$;

create or replace function public.admin_reports_overview(p_month text default '')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s timestamptz; e timestamptz; ps timestamptz;
  res jsonb;
  enr bigint; enr_prev bigint; act bigint; act_prev bigint; ses bigint; ses_prev bigint; cert bigint; cert_prev bigint;
  com bigint; com_prev bigint; rev bigint; compl numeric; ev_ok bigint; ev_all bigint; att_ok bigint; att_all bigint;
begin
  perform public._admin_only();
  s := public._report_start(p_month);
  e := s + interval '1 month';
  ps := s - interval '1 month';

  select count(*) filter (where enrolled_at >= s and enrolled_at < e), count(*) filter (where enrolled_at >= ps and enrolled_at < s)
    into enr, enr_prev from public.enrollments where status <> 'cancelled';
  select count(distinct learner_id) filter (where enrolled_at < e and (completed_at is null or completed_at >= s)),
         count(distinct learner_id) filter (where enrolled_at < s and (completed_at is null or completed_at >= ps))
    into act, act_prev from public.enrollments where status in ('confirmed', 'completed', 'suspended');
  select count(*) filter (where start_at >= s and start_at < e), count(*) filter (where start_at >= ps and start_at < s)
    into ses, ses_prev from public.sessions where status not in ('draft', 'cancelled');
  select count(*) filter (where issued_at >= s and issued_at < e), count(*) filter (where issued_at >= ps and issued_at < s)
    into cert, cert_prev from public.certificates;
  select coalesce(sum(amount) filter (where earned_at >= s and earned_at < e), 0), coalesce(sum(amount) filter (where earned_at >= ps and earned_at < s), 0)
    into com, com_prev from public.commissions;
  select coalesce(sum(amount), 0) into rev from public.payments where status = 'confirmed' and paid_at >= s and paid_at < e;
  select case when count(*) = 0 then null else round(100.0 * count(*) filter (where status = 'completed') / count(*)) end into compl
    from public.enrollments where status in ('confirmed', 'completed') and enrolled_at < e;
  select count(*) filter (where o.passed), count(*) into ev_ok, ev_all
    from public._evaluation_outcomes() o join public.evaluations ev on ev.id = o.evaluation_id
    where coalesce(ev.available_at, ev.due_at, ev.created_at) >= s and coalesce(ev.available_at, ev.due_at, ev.created_at) < e;
  select count(*) filter (where a.status in ('present', 'late')), count(*) into att_ok, att_all
    from public.attendance_records a join public.sessions se on se.id = a.session_id where se.start_at >= s and se.start_at < e;

  res := jsonb_build_object(
    'month', to_char(s at time zone 'UTC', 'YYYY-MM'),
    'enrollments', jsonb_build_object('value', enr, 'prev', enr_prev),
    'active_learners', jsonb_build_object('value', act, 'prev', act_prev),
    'sessions', jsonb_build_object('value', ses, 'prev', ses_prev),
    'certifications', jsonb_build_object('value', cert, 'prev', cert_prev),
    'commissions', jsonb_build_object('value', com, 'prev', com_prev, 'rate', (select rate_percent from public.commission_settings)),
    'revenue', rev,
    'completion_rate', compl,
    'evaluation_success_rate', case when ev_all = 0 then null else round(100.0 * ev_ok / ev_all) end,
    'attendance_rate', case when att_all = 0 then null else round(100.0 * att_ok / att_all) end,
    'months', (select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
        'count', (select count(*) from public.enrollments x where x.status <> 'cancelled' and x.enrolled_at >= m at time zone 'UTC' and x.enrolled_at < (m + interval '1 month') at time zone 'UTC')) order by m), '[]'::jsonb)
      from generate_series((s at time zone 'UTC') - interval '5 months', s at time zone 'UTC', interval '1 month') m),
    'courses', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'count', t.n) order by t.n desc, t.title), '[]'::jsonb) from (
        select c.id, c.title, count(*) as n from public.enrollments x join public.courses c on c.id = x.course_id
        where x.status <> 'cancelled' and x.enrolled_at >= s and x.enrolled_at < e group by c.id, c.title order by n desc, c.title limit 5) t)
  );
  return res;
end $$;

-- Lignes d'un rapport ; l'ordre des colonnes correspond aux en-têtes définis dans src/lib/admin/reports.ts
create or replace function public.admin_report_rows(p_type text, p_month text default '')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s timestamptz; e timestamptz; res jsonb;
begin
  perform public._admin_only();
  s := public._report_start(p_month);
  e := s + interval '1 month';

  if p_type = 'inscriptions' then
    select coalesce(jsonb_agg(r.row order by r.at, r.ref), '[]'::jsonb) into res from (
      select x.enrolled_at as at, x.reference as ref, jsonb_build_array(x.reference, coalesce(nullif(l.full_name, ''), l.email), l.email, c.title, coalesce(se.title, ''),
        public._enrollment_status_label(x.status), to_char(x.enrolled_at at time zone 'UTC', 'DD/MM/YYYY')) as row
      from public.enrollments x join public.profiles l on l.id = x.learner_id join public.courses c on c.id = x.course_id left join public.sessions se on se.id = x.session_id
      where x.enrolled_at >= s and x.enrolled_at < e order by x.enrolled_at limit 5000) r;
  elsif p_type = 'formations' then
    select coalesce(jsonb_agg(r.row order by r.title), '[]'::jsonb) into res from (
      select c.title, jsonb_build_array(coalesce(c.course_code, ''), c.title, coalesce(cat.name, ''),
        case c.status when 'published' then 'Publiée' when 'draft' then 'Brouillon' when 'in_review' then 'En révision' when 'rejected' then 'Rejetée' else 'Archivée' end,
        (select count(*) from public.enrollments x where x.course_id = c.id and x.status <> 'cancelled' and x.enrolled_at >= s and x.enrolled_at < e),
        (select count(*) from public.enrollments x where x.course_id = c.id and x.status = 'completed' and x.completed_at >= s and x.completed_at < e),
        coalesce((select round(avg(rv.rating), 1)::text from public.course_reviews rv where rv.course_id = c.id), ''), c.price_amount) as row
      from public.courses c left join public.categories cat on cat.id = c.category_id
      where c.status = 'published' or exists (select 1 from public.enrollments x where x.course_id = c.id and x.enrolled_at >= s and x.enrolled_at < e)
      order by c.title limit 5000) r;
  elsif p_type = 'sessions' then
    select coalesce(jsonb_agg(r.row order by r.at, r.title), '[]'::jsonb) into res from (
      select se.start_at as at, se.title, jsonb_build_array(se.title, c.title, coalesce(nullif(i.full_name, ''), i.email),
        to_char(se.start_at at time zone 'UTC', 'DD/MM/YYYY'), to_char(se.end_at at time zone 'UTC', 'DD/MM/YYYY'), se.capacity, n.enrolled,
        round(100.0 * n.enrolled / nullif(se.capacity, 0)),
        case se.status when 'completed' then 'Terminée' when 'cancelled' then 'Annulée' else 'Planifiée' end) as row
      from public.sessions se join public.courses c on c.id = se.course_id join public.profiles i on i.id = se.instructor_id
      cross join lateral (select count(*) as enrolled from public.enrollments x where x.session_id = se.id and x.status in ('confirmed', 'completed', 'suspended')) n
      where se.status <> 'draft' and se.start_at >= s and se.start_at < e order by se.start_at limit 5000) r;
  elsif p_type = 'apprenants' then
    select coalesce(jsonb_agg(r.row order by r.name), '[]'::jsonb) into res from (
      select coalesce(nullif(l.full_name, ''), l.email) as name, jsonb_build_array(coalesce(l.learner_code, ''), coalesce(nullif(l.full_name, ''), l.email), l.email,
        count(*) filter (where x.status <> 'cancelled' and x.enrolled_at >= s and x.enrolled_at < e),
        count(*) filter (where x.status = 'completed'),
        (select count(*) from public.certificates ce where ce.learner_id = l.id and ce.status = 'valid')) as row
      from public.enrollments x join public.profiles l on l.id = x.learner_id
      where x.enrolled_at < e and (x.completed_at is null or x.completed_at >= s) and x.status in ('confirmed', 'completed', 'suspended')
      group by l.id, l.full_name, l.email, l.learner_code order by 1 limit 5000) r;
  elsif p_type = 'evaluations' then
    select coalesce(jsonb_agg(r.row order by r.at, r.title), '[]'::jsonb) into res from (
      select coalesce(ev.available_at, ev.due_at, ev.created_at) as at, ev.title, jsonb_build_array(ev.title, c.title,
        case ev.status when 'published' then 'Publiée' when 'archived' then 'Archivée' else 'Brouillon' end,
        o.n, o.ok, round(100.0 * o.ok / nullif(o.n, 0))) as row
      from public.evaluations ev join public.courses c on c.id = ev.course_id
      cross join lateral (select count(*) as n, count(*) filter (where q.passed) as ok from public._evaluation_outcomes() q where q.evaluation_id = ev.id) o
      where coalesce(ev.available_at, ev.due_at, ev.created_at) >= s and coalesce(ev.available_at, ev.due_at, ev.created_at) < e
      order by 1 limit 5000) r;
  elsif p_type = 'certifications' then
    select coalesce(jsonb_agg(r.row order by r.at, r.num), '[]'::jsonb) into res from (
      select ce.issued_at as at, ce.certificate_number as num, jsonb_build_array(ce.certificate_number, coalesce(nullif(l.full_name, ''), l.email), c.title,
        to_char(ce.issued_at at time zone 'UTC', 'DD/MM/YYYY'), coalesce(to_char(ce.valid_until at time zone 'UTC', 'DD/MM/YYYY'), ''),
        case ce.status when 'valid' then 'Valide' when 'suspended' then 'Suspendu' else 'Révoqué' end) as row
      from public.certificates ce join public.profiles l on l.id = ce.learner_id join public.courses c on c.id = ce.course_id
      where ce.issued_at >= s and ce.issued_at < e order by ce.issued_at limit 5000) r;
  elsif p_type = 'financier' then
    select coalesce(jsonb_agg(r.row order by r.at, r.ref), '[]'::jsonb) into res from (
      select p.paid_at as at, p.reference as ref, jsonb_build_array(p.reference, coalesce(nullif(l.full_name, ''), l.email, o.name, ''), coalesce(c.title, p.label, 'Paiement'), p.amount,
        case p.method when 'mobile_money' then 'Mobile Money' when 'card' then 'Carte bancaire' when 'bank_transfer' then 'Virement' when 'cash' then 'Espèces' else 'Chèque' end,
        case p.status when 'confirmed' then 'Confirmé' when 'pending' then 'En attente' when 'failed' then 'Échoué' else 'Annulé' end,
        to_char(p.paid_at at time zone 'UTC', 'DD/MM/YYYY')) as row
      from public.payments p left join public.profiles l on l.id = p.learner_id left join public.organizations o on o.id = p.organization_id left join public.courses c on c.id = p.course_id
      where p.paid_at >= s and p.paid_at < e order by p.paid_at limit 5000) r;
  elsif p_type = 'presences' then
    select coalesce(jsonb_agg(r.row order by r.at, r.title), '[]'::jsonb) into res from (
      select se.start_at as at, se.title, jsonb_build_array(se.title, c.title, to_char(se.start_at at time zone 'UTC', 'DD/MM/YYYY'), n.enrolled, a.present, a.absent,
        round(100.0 * a.present / nullif(a.present + a.absent, 0))) as row
      from public.sessions se join public.courses c on c.id = se.course_id
      cross join lateral (select count(*) as enrolled from public.enrollments x where x.session_id = se.id and x.status in ('confirmed', 'completed', 'suspended')) n
      cross join lateral (select count(*) filter (where r.status in ('present', 'late')) as present, count(*) filter (where r.status in ('absent', 'excused')) as absent
        from public.attendance_records r where r.session_id = se.id) a
      where se.status <> 'draft' and se.start_at >= s and se.start_at < e and a.present + a.absent > 0 order by se.start_at limit 5000) r;
  elsif p_type = 'activite' then
    select coalesce(jsonb_agg(r.row order by r.at, r.id), '[]'::jsonb) into res from (
      select l.occurred_at as at, l.id, jsonb_build_array(to_char(l.occurred_at at time zone 'UTC', 'DD/MM/YYYY HH24:MI'), coalesce(nullif(p.full_name, ''), p.email, 'Système'),
        l.action, l.entity_type, coalesce(l.entity_id, '')) as row
      from public.audit_logs l left join public.profiles p on p.id = l.actor_id
      where l.occurred_at >= s and l.occurred_at < e order by l.occurred_at limit 5000) r;
  else
    raise exception 'type_invalid';
  end if;
  return res;
end $$;

create or replace function public.admin_log_report(p_type text, p_month text, p_name text, p_rows integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid; period text;
begin
  perform public._admin_only();
  period := to_char(public._report_start(p_month) at time zone 'UTC', 'YYYY-MM');
  insert into public.report_runs (type, period, name, row_count, generated_by) values (p_type, period, left(btrim(p_name), 200), greatest(coalesce(p_rows, 0), 0), auth.uid())
  returning id into rid;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'report.generate', 'report', rid::text, jsonb_build_object('type', p_type, 'period', period, 'rows', p_rows));
  return rid;
end $$;

create or replace function public.admin_recent_reports(p_limit integer default 5)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._admin_only();
  return (select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.generated_at desc), '[]'::jsonb) from (
    select r.id, r.type, r.period, r.name, r.format, r.row_count, r.generated_at, coalesce(nullif(p.full_name, ''), p.email, 'Système') as generated_by
    from public.report_runs r left join public.profiles p on p.id = r.generated_by
    order by r.generated_at desc, r.id limit least(greatest(coalesce(p_limit, 5), 1), 50)) t);
end $$;

revoke execute on function public._report_start(text) from public, anon, authenticated;
revoke execute on function public._enrollment_status_label(text) from public, anon, authenticated;
revoke execute on function public.admin_reports_overview(text) from public, anon;
revoke execute on function public.admin_report_rows(text, text) from public, anon;
revoke execute on function public.admin_log_report(text, text, text, integer) from public, anon;
revoke execute on function public.admin_recent_reports(integer) from public, anon;
grant execute on function public.admin_reports_overview(text) to authenticated;
grant execute on function public.admin_report_rows(text, text) to authenticated;
grant execute on function public.admin_log_report(text, text, text, integer) to authenticated;
grant execute on function public.admin_recent_reports(integer) to authenticated;
