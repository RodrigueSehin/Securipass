-- SECURIPASS — Lot 2 : formations complètes, contenus, sessions, inscriptions, stockage
create extension if not exists btree_gist;

-- ---------- Catégories de référence (domaines du produit) ----------
insert into public.categories (name, slug, description) values
  ('Sécurité privée et gardiennage', 'securite-privee', 'Prévention, surveillance, contrôle d''accès, gestion des conflits'),
  ('Secourisme au travail', 'secourisme', 'Premiers secours, SST, gestes d''urgence'),
  ('Sécurité incendie', 'securite-incendie', 'Prévention incendie, extincteurs, évacuation'),
  ('Prévention des risques professionnels', 'prevention-risques', 'Santé, sécurité au travail, évaluation des risques'),
  ('Situations d''urgence et conformité', 'situations-urgence', 'Gestion des urgences, réglementation et conformité')
on conflict (slug) do nothing;

-- ---------- Formations : champs complémentaires ----------
alter table public.courses
  add column language text not null default 'fr',
  add column competencies text[] not null default '{}',
  add column evaluation_modalities text,
  add column certificate_conditions text,
  add column certificate_validity_months integer check (certificate_validity_months is null or certificate_validity_months > 0),
  add column cancellation_policy text,
  add column accessibility text,
  add column prerequisite_course_id uuid references public.courses(id) on delete set null,
  add column rejection_reason text,
  add column reviewed_by uuid references public.profiles(id),
  add column reviewed_at timestamptz;

-- ---------- Fonctions d'aide (security definer : évitent la récursion de RLS) ----------
create or replace function public.is_pedagogy_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('admin') or public.has_role('pedagogy_manager');
$$;
create or replace function public.owns_course(_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses where id = _course and instructor_id = auth.uid());
$$;
create or replace function public.course_is_published(_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses where id = _course and status = 'published');
$$;

-- ---------- Modules et contenus ----------
create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.course_modules (course_id, position);

create table public.learning_contents (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  content_type text not null check (content_type in ('video','pdf','presentation','link','text','practice')),
  description text,
  body text,
  file_path text,
  external_url text check (external_url is null or external_url ~ '^https://'),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (content_type in ('text','practice') or file_path is not null or external_url is not null),
  check (content_type <> 'text' or body is not null)
);
create index on public.learning_contents (module_id, position);
create trigger learning_contents_touch before update on public.learning_contents
  for each row execute function public.touch_updated_at();

-- ---------- Sessions ----------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  instructor_id uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 2 and 200),
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'Africa/Abidjan',
  delivery_mode text not null check (delivery_mode in ('onsite','online','hybrid')),
  location text,
  capacity integer not null check (capacity > 0),
  registration_deadline timestamptz,
  waitlist_enabled boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  check (registration_deadline is null or registration_deadline <= start_at),
  check (delivery_mode = 'online' or location is not null),
  -- Un formateur ne peut pas animer deux sessions simultanées
  exclude using gist (instructor_id with =, tstzrange(start_at, end_at) with &&) where (status <> 'cancelled')
);
create index on public.sessions (course_id, start_at);
create trigger sessions_touch before update on public.sessions
  for each row execute function public.touch_updated_at();

-- Lien de visioconférence : table séparée, visible seulement des inscrits, du formateur et du personnel
create table public.session_meeting_links (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  url text not null check (url ~ '^https://')
);

-- ---------- Inscriptions ----------
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id),
  course_id uuid not null references public.courses(id),
  session_id uuid references public.sessions(id),
  organization_id uuid references public.organizations(id),
  status text not null default 'confirmed'
    check (status in ('pending_payment','confirmed','waitlisted','cancelled','completed','suspended','expired')),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references public.profiles(id)
);
-- Une seule inscription active par apprenant et par formation
create unique index enrollments_one_active on public.enrollments (learner_id, course_id)
  where status in ('pending_payment','confirmed','waitlisted','suspended');
create index on public.enrollments (course_id, status);
create index on public.enrollments (session_id, status);
create index on public.enrollments (learner_id);

create or replace function public.session_seats_taken(_session uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.enrollments
  where session_id = _session and status in ('pending_payment','confirmed','completed','suspended');
$$;

create or replace function public.has_course_access(_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments
    where learner_id = auth.uid() and course_id = _course and status in ('confirmed','completed'));
$$;
create or replace function public.can_read_module(_module uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.course_modules m
    where m.id = _module and (public.owns_course(m.course_id) or public.has_course_access(m.course_id)));
$$;
create or replace function public.owns_module(_module uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.course_modules m where m.id = _module and public.owns_course(m.course_id));
$$;
create or replace function public.is_enrolled_in_session(_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments e where e.session_id = _session and e.learner_id = auth.uid());
$$;
create or replace function public.can_see_session_link(_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or exists (
    select 1 from public.sessions s where s.id = _session and s.instructor_id = auth.uid()
  ) or exists (
    select 1 from public.enrollments e where e.session_id = _session and e.learner_id = auth.uid()
      and e.status in ('confirmed','completed')
  );
$$;
create or replace function public.instructor_sees_learner(_learner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments e
    where e.learner_id = _learner and public.owns_course(e.course_id));
$$;

-- ---------- Garde-fous sur les formations (cycle de vie et validation pédagogique) ----------
create or replace function public.courses_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare staff boolean;
begin
  -- Service role / SQL direct : pas de restriction
  if auth.uid() is null then return new; end if;
  staff := public.is_pedagogy_staff();

  if tg_op = 'INSERT' then
    if not staff and new.status <> 'draft' then
      raise exception 'Une formation doit être créée en brouillon' using errcode = '42501';
    end if;
    return new;
  end if;

  if not staff then
    if new.status is distinct from old.status then
      if (old.status, new.status) not in (
        ('draft','in_review'), ('in_review','draft'), ('rejected','draft'), ('rejected','in_review'),
        ('draft','archived'), ('in_review','archived'), ('rejected','archived'), ('published','archived'),
        ('archived','draft'), ('published','in_review')
      ) then
        raise exception 'Transition de statut non autorisée : % -> %', old.status, new.status using errcode = '42501';
      end if;
    elsif old.status = 'published' and (
      new.title is distinct from old.title or new.description is distinct from old.description
      or new.objectives is distinct from old.objectives or new.prerequisites is distinct from old.prerequisites
      or new.target_audience is distinct from old.target_audience or new.level is distinct from old.level
      or new.duration_minutes is distinct from old.duration_minutes or new.delivery_mode is distinct from old.delivery_mode
      or new.price_amount is distinct from old.price_amount or new.competencies is distinct from old.competencies
      or new.evaluation_modalities is distinct from old.evaluation_modalities
      or new.certificate_conditions is distinct from old.certificate_conditions
      or new.certificate_validity_months is distinct from old.certificate_validity_months
    ) then
      -- Toute modification substantielle d'une formation publiée la renvoie en validation
      new.status := 'in_review';
    end if;
    -- Champs réservés à la validation pédagogique
    new.instructor_id := old.instructor_id;
    new.published_at := old.published_at;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.rejection_reason := old.rejection_reason;
  elsif new.status is distinct from old.status then
    if new.status = 'published' then
      new.published_at := coalesce(old.published_at, now());
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
      new.rejection_reason := null;
    elsif new.status = 'rejected' then
      if nullif(btrim(coalesce(new.rejection_reason, '')), '') is null then
        raise exception 'Un refus doit être motivé' using errcode = '23514';
      end if;
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger courses_guard_trg before insert or update on public.courses
  for each row execute function public.courses_guard();

create or replace function public.audit_course_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'course.status_changed', 'course', new.id::text,
            jsonb_build_object('from', old.status, 'to', new.status, 'reason', new.rejection_reason));
  end if;
  return new;
end $$;
create trigger courses_audit_trg after update on public.courses
  for each row execute function public.audit_course_status();

-- Modifier le programme d'une formation publiée la renvoie en validation
create or replace function public.course_content_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare _course uuid;
begin
  if tg_table_name = 'course_modules' then
    _course := coalesce(new.course_id, old.course_id);
  else
    select m.course_id into _course from public.course_modules m where m.id = coalesce(new.module_id, old.module_id);
  end if;
  -- Seules les modifications faites par un utilisateur non-validateur déclenchent une nouvelle validation
  if _course is not null and auth.uid() is not null and not public.is_pedagogy_staff() then
    update public.courses set status = 'in_review' where id = _course and status = 'published';
  end if;
  return coalesce(new, old);
end $$;
create trigger modules_changed_trg after insert or update or delete on public.course_modules
  for each row execute function public.course_content_changed();
create trigger contents_changed_trg after insert or update or delete on public.learning_contents
  for each row execute function public.course_content_changed();

-- Capacité : jamais inférieure aux places déjà prises ; annulation d'une session = annulation des inscriptions
create or replace function public.sessions_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.capacity < public.session_seats_taken(new.id) then
    raise exception 'capacity_below_enrolled' using errcode = '23514';
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.enrollments set status = 'cancelled', cancelled_at = now()
    where session_id = new.id and status in ('pending_payment','confirmed','waitlisted','suspended');
  end if;
  return new;
end $$;
create trigger sessions_guard_trg before update on public.sessions
  for each row execute function public.sessions_guard();

-- ---------- Inscription : règles métier atomiques ----------
create or replace function public._promote_waitlist(_session uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.sessions%rowtype; next_id uuid;
begin
  select * into s from public.sessions where id = _session;
  if not found or s.status <> 'scheduled' then return; end if;
  while public.session_seats_taken(_session) < s.capacity loop
    select id into next_id from public.enrollments
      where session_id = _session and status = 'waitlisted' order by enrolled_at limit 1 for update;
    exit when next_id is null;
    update public.enrollments set status = 'confirmed' where id = next_id;
  end loop;
end $$;

create or replace function public._do_enroll(_learner uuid, _course uuid, _session uuid, _actor uuid, _manual boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.courses%rowtype; s public.sessions%rowtype; new_status text; eid uuid; open_sessions integer;
begin
  select * into c from public.courses where id = _course;
  if not found or c.status <> 'published' then raise exception 'course_not_available'; end if;
  if c.price_amount > 0 and not _manual then raise exception 'payment_required'; end if;
  if c.prerequisite_course_id is not null and not exists (
    select 1 from public.enrollments where learner_id = _learner and course_id = c.prerequisite_course_id and status = 'completed'
  ) then raise exception 'prerequisite_missing'; end if;
  if exists (
    select 1 from public.enrollments where learner_id = _learner and course_id = _course
      and status in ('pending_payment','confirmed','waitlisted','suspended')
  ) then raise exception 'already_enrolled'; end if;

  if _session is null then
    select count(*) into open_sessions from public.sessions
      where course_id = _course and status = 'scheduled' and end_at > now();
    if open_sessions > 0 then raise exception 'session_required'; end if;
    new_status := 'confirmed';
  else
    select * into s from public.sessions where id = _session for update;
    if not found or s.course_id <> _course or s.status <> 'scheduled' or s.end_at <= now() then
      raise exception 'session_invalid';
    end if;
    if not _manual and coalesce(s.registration_deadline, s.start_at) < now() then
      raise exception 'registration_closed';
    end if;
    if public.session_seats_taken(_session) < s.capacity then new_status := 'confirmed';
    elsif s.waitlist_enabled then new_status := 'waitlisted';
    else raise exception 'session_full';
    end if;
  end if;

  begin
    insert into public.enrollments (learner_id, course_id, session_id, status, created_by)
    values (_learner, _course, _session, new_status, _actor) returning id into eid;
  exception when unique_violation then
    raise exception 'already_enrolled';
  end;
  return jsonb_build_object('enrollment_id', eid, 'status', new_status);
end $$;

create or replace function public.enroll_self(p_course uuid, p_session uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return public._do_enroll(auth.uid(), p_course, p_session, auth.uid(), false);
end $$;

create or replace function public.instructor_enroll_learner(p_session uuid, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.sessions%rowtype; l uuid; res jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into s from public.sessions where id = p_session;
  if not found then raise exception 'session_invalid'; end if;
  if not (public.owns_course(s.course_id) or public.is_pedagogy_staff()) then raise exception 'forbidden'; end if;
  select id into l from public.profiles where lower(email) = lower(btrim(p_email));
  if l is null then raise exception 'learner_not_found'; end if;
  res := public._do_enroll(l, s.course_id, p_session, auth.uid(), true);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'enrollment.manual', 'enrollment', res->>'enrollment_id',
          jsonb_build_object('session_id', p_session, 'learner_id', l, 'status', res->>'status'));
  return res;
end $$;

create or replace function public.cancel_enrollment(p_enrollment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e public.enrollments%rowtype; s public.sessions%rowtype; is_owner boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into e from public.enrollments where id = p_enrollment;
  if not found then raise exception 'enrollment_not_found'; end if;
  is_owner := public.owns_course(e.course_id) or public.is_pedagogy_staff();
  if e.learner_id <> auth.uid() and not is_owner then raise exception 'forbidden'; end if;

  -- Même ordre de verrouillage que l'inscription : session d'abord, puis inscription
  if e.session_id is not null then
    select * into s from public.sessions where id = e.session_id for update;
  end if;
  select * into e from public.enrollments where id = p_enrollment for update;
  if e.status not in ('pending_payment','confirmed','waitlisted','suspended') then raise exception 'not_cancellable'; end if;
  if not is_owner and e.session_id is not null and s.start_at <= now() then raise exception 'session_started'; end if;

  update public.enrollments set status = 'cancelled', cancelled_at = now() where id = p_enrollment;
  if e.session_id is not null then perform public._promote_waitlist(e.session_id); end if;
end $$;

-- ---------- Duplication d'une formation (en brouillon) ----------
create or replace function public.duplicate_course(p_course uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.courses%rowtype; new_id uuid; m record; new_m uuid;
begin
  if not (public.owns_course(p_course) or public.is_pedagogy_staff()) then raise exception 'forbidden'; end if;
  select * into c from public.courses where id = p_course;
  insert into public.courses (instructor_id, category_id, title, slug, description, objectives, prerequisites, target_audience,
      level, duration_minutes, delivery_mode, price_amount, currency, cover_url, status, language, competencies,
      evaluation_modalities, certificate_conditions, certificate_validity_months, cancellation_policy, accessibility,
      prerequisite_course_id)
  values (c.instructor_id, c.category_id, c.title || ' (copie)', c.slug || '-copie-' || substr(md5(random()::text), 1, 6),
      c.description, c.objectives, c.prerequisites, c.target_audience, c.level, c.duration_minutes, c.delivery_mode,
      c.price_amount, c.currency, c.cover_url, 'draft', c.language, c.competencies, c.evaluation_modalities,
      c.certificate_conditions, c.certificate_validity_months, c.cancellation_policy, c.accessibility,
      c.prerequisite_course_id)
  returning id into new_id;
  for m in select * from public.course_modules where course_id = p_course order by position loop
    insert into public.course_modules (course_id, title, description, position)
    values (new_id, m.title, m.description, m.position) returning id into new_m;
    insert into public.learning_contents (module_id, title, content_type, description, body, file_path, external_url,
        duration_minutes, position, status)
    select new_m, title, content_type, description, body, file_path, external_url, duration_minutes, position, 'draft'
    from public.learning_contents where module_id = m.id;
  end loop;
  return new_id;
end $$;

-- ---------- Lecture publique : détail d'une formation publiée, sans données sensibles ----------
create or replace function public.public_course_detail(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c record;
begin
  select co.id, co.slug, co.title, co.description, co.objectives, co.prerequisites, co.target_audience, co.level,
         co.duration_minutes, co.delivery_mode, co.price_amount, co.currency, co.cover_url, co.language, co.competencies,
         co.evaluation_modalities, co.certificate_conditions, co.certificate_validity_months, co.cancellation_policy,
         co.accessibility, co.prerequisite_course_id, cat.name as cat_name, cat.slug as cat_slug,
         p.full_name as instructor_name
    into c
    from public.courses co
    left join public.categories cat on cat.id = co.category_id
    left join public.profiles p on p.id = co.instructor_id
    where co.slug = p_slug and co.status = 'published';
  if not found then return null; end if;

  return jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'title', c.title, 'description', c.description, 'objectives', c.objectives,
    'prerequisites', c.prerequisites, 'target_audience', c.target_audience, 'level', c.level,
    'duration_minutes', c.duration_minutes, 'delivery_mode', c.delivery_mode, 'price_amount', c.price_amount,
    'currency', c.currency, 'cover_url', c.cover_url, 'language', c.language, 'competencies', c.competencies,
    'evaluation_modalities', c.evaluation_modalities, 'certificate_conditions', c.certificate_conditions,
    'certificate_validity_months', c.certificate_validity_months, 'cancellation_policy', c.cancellation_policy,
    'accessibility', c.accessibility,
    'category', case when c.cat_name is null then null else jsonb_build_object('name', c.cat_name, 'slug', c.cat_slug) end,
    'instructor_name', c.instructor_name,
    'prerequisite_course', (select jsonb_build_object('title', pc.title, 'slug', pc.slug)
                            from public.courses pc where pc.id = c.prerequisite_course_id and pc.status = 'published'),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', m.title, 'description', m.description,
        'contents', coalesce((
          select jsonb_agg(jsonb_build_object('title', lc.title, 'type', lc.content_type, 'duration_minutes', lc.duration_minutes)
                           order by lc.position)
          from public.learning_contents lc where lc.module_id = m.id and lc.status = 'published'), '[]'::jsonb)
      ) order by m.position)
      from public.course_modules m where m.course_id = c.id), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'title', s.title, 'start_at', s.start_at, 'end_at', s.end_at, 'timezone', s.timezone,
        'delivery_mode', s.delivery_mode, 'location', s.location, 'capacity', s.capacity,
        'seats_taken', public.session_seats_taken(s.id), 'registration_deadline', s.registration_deadline,
        'waitlist_enabled', s.waitlist_enabled) order by s.start_at)
      from public.sessions s where s.course_id = c.id and s.status = 'scheduled' and s.end_at > now()), '[]'::jsonb)
  );
end $$;

create or replace function public.courses_with_open_sessions()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct s.course_id from public.sessions s
  join public.courses c on c.id = s.course_id and c.status = 'published'
  where s.status = 'scheduled' and coalesce(s.registration_deadline, s.start_at) > now()
    and public.session_seats_taken(s.id) < s.capacity;
$$;

-- ---------- RLS ----------
alter table public.course_modules enable row level security;
alter table public.learning_contents enable row level security;
alter table public.sessions enable row level security;
alter table public.session_meeting_links enable row level security;
alter table public.enrollments enable row level security;

-- Formations : l'instructeur modifie ses formations ; le trigger courses_guard encadre les statuts
drop policy courses_instructor_update on public.courses;
create policy courses_instructor_update on public.courses for update
  using (instructor_id = auth.uid() and public.has_role('instructor'))
  with check (instructor_id = auth.uid());

create policy modules_read on public.course_modules for select
  using (public.course_is_published(course_id) or public.owns_course(course_id) or public.is_staff());
create policy modules_write on public.course_modules for all
  using (public.owns_course(course_id) or public.is_pedagogy_staff())
  with check (public.owns_course(course_id) or public.is_pedagogy_staff());

-- Les contenus (fichiers, liens) ne sont visibles que des inscrits, du formateur et du personnel
create policy contents_read on public.learning_contents for select
  using (public.owns_module(module_id) or public.is_staff()
         or (status = 'published' and public.can_read_module(module_id)));
create policy contents_write on public.learning_contents for all
  using (public.owns_module(module_id) or public.is_pedagogy_staff())
  with check (public.owns_module(module_id) or public.is_pedagogy_staff());

create policy sessions_read on public.sessions for select
  using (instructor_id = auth.uid() or public.is_staff()
         or (status = 'scheduled' and public.course_is_published(course_id))
         or public.is_enrolled_in_session(id));
create policy sessions_insert on public.sessions for insert
  with check (public.owns_course(course_id) and instructor_id = auth.uid());
create policy sessions_update on public.sessions for update
  using (instructor_id = auth.uid() and public.owns_course(course_id))
  with check (instructor_id = auth.uid() and public.owns_course(course_id));
create policy sessions_staff on public.sessions for all
  using (public.is_pedagogy_staff()) with check (public.is_pedagogy_staff());

create policy meeting_links_read on public.session_meeting_links for select
  using (public.can_see_session_link(session_id));
create policy meeting_links_write on public.session_meeting_links for all
  using (exists (select 1 from public.sessions s where s.id = session_id and s.instructor_id = auth.uid()) or public.is_pedagogy_staff())
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.instructor_id = auth.uid()) or public.is_pedagogy_staff());

-- Inscriptions : lecture seule ; toute modification passe par les fonctions ci-dessus
create policy enrollments_read on public.enrollments for select
  using (learner_id = auth.uid() or public.owns_course(course_id) or public.is_staff());

-- Le formateur voit les profils de ses apprenants
create policy profiles_instructor_read on public.profiles for select
  using (public.instructor_sees_learner(id));

-- ---------- Droits d'exécution des fonctions ----------
revoke execute on function public._do_enroll(uuid, uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public._promote_waitlist(uuid) from public, anon, authenticated;
revoke execute on function public.enroll_self(uuid, uuid) from public, anon;
revoke execute on function public.instructor_enroll_learner(uuid, text) from public, anon;
revoke execute on function public.cancel_enrollment(uuid) from public, anon;
revoke execute on function public.duplicate_course(uuid) from public, anon;
grant execute on function public.enroll_self(uuid, uuid) to authenticated;
grant execute on function public.instructor_enroll_learner(uuid, text) to authenticated;
grant execute on function public.cancel_enrollment(uuid) to authenticated;
grant execute on function public.duplicate_course(uuid) to authenticated;
grant execute on function public.public_course_detail(text) to anon, authenticated;
grant execute on function public.courses_with_open_sessions() to anon, authenticated;

-- ---------- Stockage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('course-covers', 'course-covers', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('course-files', 'course-files', false, 52428800, array[
     'application/pdf',
     'application/vnd.openxmlformats-officedocument.presentationml.presentation',
     'application/vnd.ms-powerpoint',
     'video/mp4','video/webm','image/jpeg','image/png'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Chaque formateur ne gère que son dossier <user_id>/...
create policy covers_instructor_write on storage.objects for all
  using (bucket_id = 'course-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('instructor'))
  with check (bucket_id = 'course-covers' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('instructor'));
create policy covers_public_read on storage.objects for select using (bucket_id = 'course-covers');
create policy course_files_instructor_all on storage.objects for all
  using (bucket_id = 'course-files' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('instructor'))
  with check (bucket_id = 'course-files' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role('instructor'));
create policy course_files_staff_read on storage.objects for select
  using (bucket_id = 'course-files' and public.is_staff());
