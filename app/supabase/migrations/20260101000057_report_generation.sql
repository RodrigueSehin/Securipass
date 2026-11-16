-- Lot 8 : génération paramétrée d'un rapport (formation, session, formateur, statut d'inscription, indicateurs, format).
--  - admin_reports_overview et admin_report_rows (migration 56) reçoivent des filtres facultatifs :
--      p_course, p_session, p_instructor (formateur de la formation ; de la session pour « sessions » et « présences »),
--      p_status (statut d'inscription : seulement pour les inscriptions et les apprenants) ;
--  - la synthèse ajoute les résultats d'évaluations et le détail par formation (sessions, inscriptions, taux de complétion et de réussite) ;
--  - report_runs garde le format (pdf | xlsx | csv), la description et les paramètres : un rapport récent se régénère à l'identique.
-- Les anciennes signatures de la migration 56 sont remplacées.

drop function if exists public.admin_reports_overview(text);
drop function if exists public.admin_report_rows(text, text);
drop function if exists public.admin_log_report(text, text, text, integer);

alter table public.report_runs
  drop constraint if exists report_runs_format_check,
  add constraint report_runs_format_check check (format in ('pdf', 'xlsx', 'csv')),
  add column if not exists description text check (description is null or char_length(description) <= 250),
  add column if not exists params jsonb not null default '{}'::jsonb;

create or replace function public._report_enrollments(p_course uuid, p_session uuid, p_instructor uuid)
returns setof public.enrollments language sql stable security definer set search_path = public as $$
  select x.* from public.enrollments x join public.courses c on c.id = x.course_id
  where (p_course is null or x.course_id = p_course) and (p_session is null or x.session_id = p_session) and (p_instructor is null or c.instructor_id = p_instructor);
$$;

create or replace function public._report_sessions(p_course uuid, p_session uuid, p_instructor uuid)
returns setof public.sessions language sql stable security definer set search_path = public as $$
  select se.* from public.sessions se
  where (p_course is null or se.course_id = p_course) and (p_session is null or se.id = p_session) and (p_instructor is null or se.instructor_id = p_instructor);
$$;
revoke execute on function public._report_enrollments(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public._report_sessions(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.admin_reports_overview(
  p_month text default '', p_course uuid default null, p_session uuid default null, p_instructor uuid default null, p_status text default '')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s timestamptz; e timestamptz; ps timestamptz; st text := coalesce(p_status, '');
  enr bigint; enr_prev bigint; act bigint; act_prev bigint; ses bigint; ses_prev bigint; cert bigint; cert_prev bigint;
  com bigint; com_prev bigint; rev bigint; compl numeric; ev_ok bigint; ev_all bigint; att_ok bigint; att_all bigint; bc jsonb;
begin
  perform public._admin_only();
  if st <> '' and st not in ('pending_payment', 'pending_approval', 'confirmed', 'waitlisted', 'cancelled', 'completed', 'suspended', 'expired') then raise exception 'status_invalid'; end if;
  s := public._report_start(p_month);
  e := s + interval '1 month';
  ps := s - interval '1 month';

  select count(*) filter (where x.enrolled_at >= s and x.enrolled_at < e), count(*) filter (where x.enrolled_at >= ps and x.enrolled_at < s)
    into enr, enr_prev from public._report_enrollments(p_course, p_session, p_instructor) x
    where case when st = '' then x.status <> 'cancelled' else x.status = st end;
  select count(distinct x.learner_id) filter (where x.enrolled_at < e and (x.completed_at is null or x.completed_at >= s)),
         count(distinct x.learner_id) filter (where x.enrolled_at < s and (x.completed_at is null or x.completed_at >= ps))
    into act, act_prev from public._report_enrollments(p_course, p_session, p_instructor) x where x.status in ('confirmed', 'completed', 'suspended');
  select count(*) filter (where se.start_at >= s and se.start_at < e), count(*) filter (where se.start_at >= ps and se.start_at < s)
    into ses, ses_prev from public._report_sessions(p_course, p_session, p_instructor) se where se.status not in ('draft', 'cancelled');
  select count(*) filter (where ce.issued_at >= s and ce.issued_at < e), count(*) filter (where ce.issued_at >= ps and ce.issued_at < s)
    into cert, cert_prev from public.certificates ce join public.courses c on c.id = ce.course_id
    where (p_course is null or ce.course_id = p_course) and (p_session is null or ce.session_id = p_session) and (p_instructor is null or c.instructor_id = p_instructor);
  select coalesce(sum(cm.amount) filter (where cm.earned_at >= s and cm.earned_at < e), 0), coalesce(sum(cm.amount) filter (where cm.earned_at >= ps and cm.earned_at < s), 0)
    into com, com_prev from public.commissions cm
    where (p_course is null or cm.course_id = p_course) and (p_session is null or cm.session_id = p_session) and (p_instructor is null or cm.instructor_id = p_instructor);
  select coalesce(sum(p.amount), 0) into rev from public.payments p left join public.courses c on c.id = p.course_id
    where p.status = 'confirmed' and p.paid_at >= s and p.paid_at < e
      and (p_course is null or p.course_id = p_course) and (p_session is null or p.session_id = p_session) and (p_instructor is null or c.instructor_id = p_instructor);
  select case when count(*) = 0 then null else round(100.0 * count(*) filter (where x.status = 'completed') / count(*)) end into compl
    from public._report_enrollments(p_course, p_session, p_instructor) x where x.status in ('confirmed', 'completed') and x.enrolled_at < e;
  select count(*) filter (where o.passed), count(*) into ev_ok, ev_all
    from public._evaluation_outcomes() o join public.evaluations ev on ev.id = o.evaluation_id join public.courses c on c.id = ev.course_id
    where coalesce(ev.available_at, ev.due_at, ev.created_at) >= s and coalesce(ev.available_at, ev.due_at, ev.created_at) < e
      and (p_course is null or ev.course_id = p_course) and (p_session is null or ev.session_id = p_session) and (p_instructor is null or c.instructor_id = p_instructor);
  select count(*) filter (where a.status in ('present', 'late')), count(*) into att_ok, att_all
    from public.attendance_records a join public._report_sessions(p_course, p_session, p_instructor) se on se.id = a.session_id where se.start_at >= s and se.start_at < e;


  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'count', t.n, 'sessions', t.ses, 'completion', t.completion, 'success', t.success)
      order by t.n desc, t.title), '[]'::jsonb) into bc from (
    select c.id, c.title, g.n,
      (select count(*) from public._report_sessions(p_course, p_session, p_instructor) se
        where se.course_id = c.id and se.status not in ('draft', 'cancelled') and se.start_at >= s and se.start_at < e) as ses,
      (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where x.status = 'completed') / count(*)) end
        from public._report_enrollments(p_course, p_session, p_instructor) x
        where x.course_id = c.id and x.status in ('confirmed', 'completed') and x.enrolled_at < e) as completion,
      (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where o.passed) / count(*)) end
        from public._evaluation_outcomes() o join public.evaluations ev on ev.id = o.evaluation_id
        where ev.course_id = c.id and coalesce(ev.available_at, ev.due_at, ev.created_at) >= s and coalesce(ev.available_at, ev.due_at, ev.created_at) < e) as success
    from (select x.course_id, count(*) as n from public._report_enrollments(p_course, p_session, p_instructor) x
          where case when st = '' then x.status <> 'cancelled' else x.status = st end and x.enrolled_at >= s and x.enrolled_at < e group by x.course_id) g
    join public.courses c on c.id = g.course_id order by g.n desc, c.title limit 20) t;

  return jsonb_build_object(
    'month', to_char(s at time zone 'UTC', 'YYYY-MM'),
    'enrollments', jsonb_build_object('value', enr, 'prev', enr_prev),
    'active_learners', jsonb_build_object('value', act, 'prev', act_prev),
    'sessions', jsonb_build_object('value', ses, 'prev', ses_prev),
    'certifications', jsonb_build_object('value', cert, 'prev', cert_prev),
    'commissions', jsonb_build_object('value', com, 'prev', com_prev, 'rate', (select rate_percent from public.commission_settings)),
    'revenue', rev,
    'evaluations', jsonb_build_object('results', ev_all, 'passed', ev_ok),
    'completion_rate', compl,
    'evaluation_success_rate', case when ev_all = 0 then null else round(100.0 * ev_ok / ev_all) end,
    'attendance_rate', case when att_all = 0 then null else round(100.0 * att_ok / att_all) end,
    'months', (select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
        'count', (select count(*) from public._report_enrollments(p_course, p_session, p_instructor) x
                  where case when st = '' then x.status <> 'cancelled' else x.status = st end
                    and x.enrolled_at >= m at time zone 'UTC' and x.enrolled_at < (m + interval '1 month') at time zone 'UTC')) order by m), '[]'::jsonb)
      from generate_series((s at time zone 'UTC') - interval '5 months', s at time zone 'UTC', interval '1 month') m),
    'by_course', bc,
    'courses', (select coalesce(jsonb_agg(jsonb_build_object('id', q.b->>'id', 'title', q.b->>'title', 'count', q.b->'count') order by q.n), '[]'::jsonb)
      from (select b, n from jsonb_array_elements(bc) with ordinality as x(b, n) order by n limit 5) q));
end $$;

-- Lignes d'un rapport ; l'ordre des colonnes correspond aux en-têtes définis dans src/lib/admin/reports.ts
create or replace function public.admin_report_rows(
  p_type text, p_month text default '', p_course uuid default null, p_session uuid default null, p_instructor uuid default null, p_status text default '')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s timestamptz; e timestamptz; res jsonb; st text := coalesce(p_status, '');
begin
  perform public._admin_only();
  if st <> '' and st not in ('pending_payment', 'pending_approval', 'confirmed', 'waitlisted', 'cancelled', 'completed', 'suspended', 'expired') then raise exception 'status_invalid'; end if;
  s := public._report_start(p_month);
  e := s + interval '1 month';

  if p_type = 'inscriptions' then
    select coalesce(jsonb_agg(r.row order by r.at, r.ref), '[]'::jsonb) into res from (
      select x.enrolled_at as at, x.reference as ref, jsonb_build_array(x.reference, coalesce(nullif(l.full_name, ''), l.email), l.email, c.title, coalesce(se.title, ''),
        public._enrollment_status_label(x.status), to_char(x.enrolled_at at time zone 'UTC', 'DD/MM/YYYY')) as row
      from public._report_enrollments(p_course, p_session, p_instructor) x join public.profiles l on l.id = x.learner_id join public.courses c on c.id = x.course_id left join public.sessions se on se.id = x.session_id
      where x.enrolled_at >= s and x.enrolled_at < e and (st = '' or x.status = st) order by x.enrolled_at limit 5000) r;
  elsif p_type = 'formations' then
    select coalesce(jsonb_agg(r.row order by r.title), '[]'::jsonb) into res from (
      select c.title, jsonb_build_array(coalesce(c.course_code, ''), c.title, coalesce(cat.name, ''),
        case c.status when 'published' then 'Publiée' when 'draft' then 'Brouillon' when 'in_review' then 'En révision' when 'rejected' then 'Rejetée' else 'Archivée' end,
        (select count(*) from public._report_enrollments(p_course, p_session, p_instructor) x where x.course_id = c.id and x.status <> 'cancelled' and x.enrolled_at >= s and x.enrolled_at < e),
        (select count(*) from public._report_enrollments(p_course, p_session, p_instructor) x where x.course_id = c.id and x.status = 'completed' and x.completed_at >= s and x.completed_at < e),
        coalesce((select round(avg(rv.rating), 1)::text from public.course_reviews rv where rv.course_id = c.id), ''), c.price_amount) as row
      from public.courses c left join public.categories cat on cat.id = c.category_id
      where (p_course is null or c.id = p_course) and (p_instructor is null or c.instructor_id = p_instructor)
        and (c.status = 'published' or exists (select 1 from public.enrollments x where x.course_id = c.id and x.enrolled_at >= s and x.enrolled_at < e))
      order by c.title limit 5000) r;
  elsif p_type = 'sessions' then
    select coalesce(jsonb_agg(r.row order by r.at, r.title), '[]'::jsonb) into res from (
      select se.start_at as at, se.title, jsonb_build_array(se.title, c.title, coalesce(nullif(i.full_name, ''), i.email),
        to_char(se.start_at at time zone 'UTC', 'DD/MM/YYYY'), to_char(se.end_at at time zone 'UTC', 'DD/MM/YYYY'), se.capacity, n.enrolled,
        round(100.0 * n.enrolled / nullif(se.capacity, 0)),
        case se.status when 'completed' then 'Terminée' when 'cancelled' then 'Annulée' else 'Planifiée' end) as row
      from public._report_sessions(p_course, p_session, p_instructor) se join public.courses c on c.id = se.course_id join public.profiles i on i.id = se.instructor_id
      cross join lateral (select count(*) as enrolled from public.enrollments x where x.session_id = se.id and x.status in ('confirmed', 'completed', 'suspended')) n
      where se.status <> 'draft' and se.start_at >= s and se.start_at < e order by se.start_at limit 5000) r;
  elsif p_type = 'apprenants' then
    select coalesce(jsonb_agg(r.row order by r.name), '[]'::jsonb) into res from (
      select coalesce(nullif(l.full_name, ''), l.email) as name, jsonb_build_array(coalesce(l.learner_code, ''), coalesce(nullif(l.full_name, ''), l.email), l.email,
        count(*) filter (where x.status <> 'cancelled' and x.enrolled_at >= s and x.enrolled_at < e),
        count(*) filter (where x.status = 'completed'),
        (select count(*) from public.certificates ce where ce.learner_id = l.id and ce.status = 'valid')) as row
      from public._report_enrollments(p_course, p_session, p_instructor) x join public.profiles l on l.id = x.learner_id
      where x.enrolled_at < e and (x.completed_at is null or x.completed_at >= s) and x.status in ('confirmed', 'completed', 'suspended') and (st = '' or x.status = st)
      group by l.id, l.full_name, l.email, l.learner_code order by 1 limit 5000) r;
  elsif p_type = 'evaluations' then
    select coalesce(jsonb_agg(r.row order by r.at, r.title), '[]'::jsonb) into res from (
      select coalesce(ev.available_at, ev.due_at, ev.created_at) as at, ev.title, jsonb_build_array(ev.title, c.title,
        case ev.status when 'published' then 'Publiée' when 'archived' then 'Archivée' else 'Brouillon' end,
        o.n, o.ok, round(100.0 * o.ok / nullif(o.n, 0))) as row
      from public.evaluations ev join public.courses c on c.id = ev.course_id
      cross join lateral (select count(*) as n, count(*) filter (where q.passed) as ok from public._evaluation_outcomes() q where q.evaluation_id = ev.id) o
      where coalesce(ev.available_at, ev.due_at, ev.created_at) >= s and coalesce(ev.available_at, ev.due_at, ev.created_at) < e
        and (p_course is null or ev.course_id = p_course) and (p_session is null or ev.session_id = p_session) and (p_instructor is null or c.instructor_id = p_instructor)
      order by 1 limit 5000) r;
  elsif p_type = 'certifications' then
    select coalesce(jsonb_agg(r.row order by r.at, r.num), '[]'::jsonb) into res from (
      select ce.issued_at as at, ce.certificate_number as num, jsonb_build_array(ce.certificate_number, coalesce(nullif(l.full_name, ''), l.email), c.title,
        to_char(ce.issued_at at time zone 'UTC', 'DD/MM/YYYY'), coalesce(to_char(ce.valid_until at time zone 'UTC', 'DD/MM/YYYY'), ''),
        case ce.status when 'valid' then 'Valide' when 'suspended' then 'Suspendu' else 'Révoqué' end) as row
      from public.certificates ce join public.profiles l on l.id = ce.learner_id join public.courses c on c.id = ce.course_id
      where ce.issued_at >= s and ce.issued_at < e
        and (p_course is null or ce.course_id = p_course) and (p_session is null or ce.session_id = p_session) and (p_instructor is null or c.instructor_id = p_instructor)
      order by ce.issued_at limit 5000) r;
  elsif p_type = 'financier' then
    select coalesce(jsonb_agg(r.row order by r.at, r.ref), '[]'::jsonb) into res from (
      select p.paid_at as at, p.reference as ref, jsonb_build_array(p.reference, coalesce(nullif(l.full_name, ''), l.email, o.name, ''), coalesce(c.title, p.label, 'Paiement'), p.amount,
        case p.method when 'mobile_money' then 'Mobile Money' when 'card' then 'Carte bancaire' when 'bank_transfer' then 'Virement' when 'cash' then 'Espèces' else 'Chèque' end,
        case p.status when 'confirmed' then 'Confirmé' when 'pending' then 'En attente' when 'failed' then 'Échoué' else 'Annulé' end,
        to_char(p.paid_at at time zone 'UTC', 'DD/MM/YYYY')) as row
      from public.payments p left join public.profiles l on l.id = p.learner_id left join public.organizations o on o.id = p.organization_id left join public.courses c on c.id = p.course_id
      where p.paid_at >= s and p.paid_at < e
        and (p_course is null or p.course_id = p_course) and (p_session is null or p.session_id = p_session) and (p_instructor is null or c.instructor_id = p_instructor)
      order by p.paid_at limit 5000) r;
  elsif p_type = 'presences' then
    select coalesce(jsonb_agg(r.row order by r.at, r.title), '[]'::jsonb) into res from (
      select se.start_at as at, se.title, jsonb_build_array(se.title, c.title, to_char(se.start_at at time zone 'UTC', 'DD/MM/YYYY'), n.enrolled, a.present, a.absent,
        round(100.0 * a.present / nullif(a.present + a.absent, 0))) as row
      from public._report_sessions(p_course, p_session, p_instructor) se join public.courses c on c.id = se.course_id
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

create or replace function public.admin_log_report(
  p_type text, p_month text, p_name text, p_rows integer, p_format text default 'csv', p_params jsonb default '{}'::jsonb, p_description text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid; period text;
begin
  perform public._admin_only();
  period := to_char(public._report_start(p_month) at time zone 'UTC', 'YYYY-MM');
  insert into public.report_runs (type, period, name, row_count, format, params, description, generated_by)
  values (p_type, period, left(btrim(p_name), 200), greatest(coalesce(p_rows, 0), 0), p_format, coalesce(p_params, '{}'::jsonb), nullif(left(btrim(coalesce(p_description, '')), 250), ''), auth.uid())
  returning id into rid;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'report.generate', 'report', rid::text, jsonb_build_object('type', p_type, 'period', period, 'rows', p_rows, 'format', p_format));
  return rid;
end $$;

revoke execute on function public.admin_reports_overview(text, uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.admin_report_rows(text, text, uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.admin_log_report(text, text, text, integer, text, jsonb, text) from public, anon;
grant execute on function public.admin_reports_overview(text, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.admin_report_rows(text, text, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.admin_log_report(text, text, text, integer, text, jsonb, text) to authenticated;
