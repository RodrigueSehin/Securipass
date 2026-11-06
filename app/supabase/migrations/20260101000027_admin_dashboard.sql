-- Lot 4 : tableau de bord d'administration.
-- Une seule fonction réservée au personnel renvoie les totaux, l'évolution mensuelle (12 mois, heure d'Abidjan = UTC),
-- la répartition des comptes par profil et les points d'attention. Aucune donnée de paiement : le module n'existe pas encore.

create or replace function public.admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cur timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  prev timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '1 month') at time zone 'UTC';
  first_month timestamptz := (date_trunc('month', now() at time zone 'UTC') - interval '11 months') at time zone 'UTC';
  res jsonb;
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'forbidden'; end if;

  select jsonb_build_object(
    'users', jsonb_build_object(
      'active', (select count(*) from public.profiles where status = 'active'),
      'month', (select count(*) from public.profiles where created_at >= cur),
      'prev', (select count(*) from public.profiles where created_at >= prev and created_at < cur),
      'latest_at', (select max(created_at) from public.profiles where created_at >= now() - interval '7 days'),
      'week', (select count(*) from public.profiles where created_at >= now() - interval '7 days')),
    'enrollments', jsonb_build_object(
      'total', (select count(*) from public.enrollments where status not in ('cancelled','expired')),
      'month', (select count(*) from public.enrollments where enrolled_at >= cur),
      'prev', (select count(*) from public.enrollments where enrolled_at >= prev and enrolled_at < cur),
      'pending_payment', (select count(*) from public.enrollments where status = 'pending_payment'),
      'pending_payment_at', (select max(enrolled_at) from public.enrollments where status = 'pending_payment')),
    'courses', jsonb_build_object(
      'published', (select count(*) from public.courses where status = 'published'),
      'month', (select count(*) from public.courses where published_at >= cur),
      'prev', (select count(*) from public.courses where published_at >= prev and published_at < cur),
      'in_review', (select count(*) from public.courses where status = 'in_review'),
      'in_review_at', (select max(updated_at) from public.courses where status = 'in_review')),
    'sessions', jsonb_build_object(
      'upcoming', (select count(*) from public.sessions where status = 'scheduled' and end_at > now()),
      'week', (select count(*) from public.sessions where status = 'scheduled' and start_at >= now() and start_at < now() + interval '7 days'),
      'month', (select count(*) from public.sessions where status <> 'draft' and start_at >= cur and start_at < cur + interval '1 month'),
      'prev', (select count(*) from public.sessions where status <> 'draft' and start_at >= prev and start_at < cur)),
    'certificates', jsonb_build_object(
      'total', (select count(*) from public.certificates where status <> 'revoked'),
      'month', (select count(*) from public.certificates where status <> 'revoked' and issued_at >= cur),
      'prev', (select count(*) from public.certificates where status <> 'revoked' and issued_at >= prev and issued_at < cur),
      'expiring', (select count(*) from public.certificates where status = 'valid' and valid_until between now() and now() + interval '30 days'),
      'expiring_at', (select min(valid_until) from public.certificates where status = 'valid' and valid_until between now() and now() + interval '30 days')),
    'support', jsonb_build_object(
      'open', (select count(*) from public.public_requests where status in ('new','in_progress')),
      'in_progress', (select count(*) from public.public_requests where status = 'in_progress'),
      'new', (select count(*) from public.public_requests where status = 'new'),
      'new_at', (select max(created_at) from public.public_requests where status = 'new'),
      'month', (select count(*) from public.public_requests where created_at >= cur),
      'prev', (select count(*) from public.public_requests where created_at >= prev and created_at < cur)),
    'series', jsonb_build_object(
      'users', (select jsonb_agg((select count(*) from public.profiles p where p.created_at >= m.d and p.created_at < m.d + interval '1 month') order by m.d)
                from generate_series(first_month, cur, interval '1 month') as m(d)),
      'enrollments', (select jsonb_agg((select count(*) from public.enrollments e where e.enrolled_at >= m.d and e.enrolled_at < m.d + interval '1 month') order by m.d)
                from generate_series(first_month, cur, interval '1 month') as m(d)),
      'courses', (select jsonb_agg((select count(*) from public.courses c where c.published_at >= m.d and c.published_at < m.d + interval '1 month') order by m.d)
                from generate_series(first_month, cur, interval '1 month') as m(d)),
      'sessions', (select jsonb_agg((select count(*) from public.sessions s where s.status <> 'draft' and s.start_at >= m.d and s.start_at < m.d + interval '1 month') order by m.d)
                from generate_series(first_month, cur, interval '1 month') as m(d)),
      'certificates', (select jsonb_agg((select count(*) from public.certificates c where c.status <> 'revoked' and c.issued_at >= m.d and c.issued_at < m.d + interval '1 month') order by m.d)
                from generate_series(first_month, cur, interval '1 month') as m(d)),
      'support', (select jsonb_agg((select count(*) from public.public_requests r where r.created_at >= m.d and r.created_at < m.d + interval '1 month') order by m.d)
                from generate_series(first_month, cur, interval '1 month') as m(d))),
    'roles', (
      -- Un compte compte une seule fois, selon son profil le plus élevé
      select jsonb_build_object(
        'admin', count(*) filter (where k = 'admin'), 'instructor', count(*) filter (where k = 'instructor'),
        'company', count(*) filter (where k = 'company'), 'other', count(*) filter (where k = 'other'),
        'learner', count(*) filter (where k = 'learner'))
      from (
        select case
          when bool_or(r.code = 'admin') then 'admin'
          when bool_or(r.code = 'instructor') then 'instructor'
          when bool_or(r.code = 'company') then 'company'
          when bool_or(r.code in ('pedagogy_manager','certification_manager','support')) then 'other'
          else 'learner' end as k
        from public.profiles p
        left join public.user_roles ur on ur.user_id = p.id
        left join public.roles r on r.id = ur.role_id
        where p.status = 'active'
        group by p.id) t)
  ) into res;
  return res;
end $$;

revoke execute on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;
