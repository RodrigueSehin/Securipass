-- Lot 5 — certifications : modèles, émission sous conditions, numéros uniques, vérification publique, révocation.
-- Toute écriture passe par les fonctions ci-dessous (autorisation, éligibilité, traçabilité). La RLS protège la lecture.

-- ---------- Modèles ----------
create table public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  layout text not null check (layout in ('classic','modern','minimal','professional')),
  title text not null check (char_length(title) between 2 and 200),
  -- Variables autorisées : {{apprenant}} {{formation}} {{session}} {{date}} {{numero}} {{validite}}
  body text not null check (char_length(body) between 2 and 2000),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  version integer not null default 1 check (version >= 1),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger certificate_templates_touch before update on public.certificate_templates
  for each row execute function public.touch_updated_at();
alter table public.certificate_templates enable row level security;
create policy templates_read on public.certificate_templates for select
  using (public.is_pedagogy_staff() or (status = 'published' and public.has_role('instructor')));
create policy templates_write on public.certificate_templates for all
  using (public.is_pedagogy_staff()) with check (public.is_pedagogy_staff());

insert into public.certificate_templates (name, layout, title, body, status) values
  ('Classique', 'classic', 'Certificat de fin de formation',
   'Le présent certificat atteste que {{apprenant}} a suivi avec succès la formation « {{formation}} » et satisfait aux évaluations requises.', 'published'),
  ('Moderne', 'modern', 'Attestation de compétences',
   '{{apprenant}} a validé la formation « {{formation}} » ({{session}}) selon les modalités de SECURIPASS.', 'published'),
  ('Minimaliste', 'minimal', 'Certificat',
   '{{apprenant}} — « {{formation}} ». Délivré le {{date}}.', 'published'),
  ('Professionnel', 'professional', 'Certificat de formation professionnelle',
   'Il est certifié que {{apprenant}} a accompli le programme de la formation « {{formation}} » ({{session}}), validé par les évaluations de référence.', 'published');

-- ---------- Certificats émis ----------
create sequence public.certificate_number_seq;

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text not null unique,
  verification_token text not null unique,
  enrollment_id uuid not null references public.enrollments(id),
  learner_id uuid not null references public.profiles(id),
  course_id uuid not null references public.courses(id),
  session_id uuid references public.sessions(id),
  template_id uuid references public.certificate_templates(id),
  -- Copie figée au moment de l'émission (nom, formation, texte rendu, signataires, dates)
  content jsonb not null,
  issued_by uuid not null references public.profiles(id),
  issued_at timestamptz not null default now(),
  valid_until timestamptz,
  status text not null default 'valid' check (status in ('valid','suspended','revoked')),
  pdf_path text,
  revoked_at timestamptz,
  revocation_reason text check (revocation_reason is null or char_length(revocation_reason) between 3 and 500),
  replaces_id uuid references public.certificates(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until > issued_at)
);
-- Un seul certificat actif (valide ou suspendu) par inscription : pas de doublon
create unique index certificates_one_active on public.certificates (enrollment_id) where status in ('valid','suspended');
create index on public.certificates (learner_id);
create index on public.certificates (course_id);
create trigger certificates_touch before update on public.certificates
  for each row execute function public.touch_updated_at();
alter table public.certificates enable row level security;
create policy certificates_read on public.certificates for select
  using (learner_id = auth.uid() or public.owns_course(course_id) or public.is_pedagogy_staff() or public.is_staff());

create table public.certificate_events (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  event_type text not null check (event_type in ('issued','suspended','reinstated','revoked','reissued','pdf_generated')),
  actor_id uuid references public.profiles(id),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.certificate_events (certificate_id, created_at);
alter table public.certificate_events enable row level security;
create policy certificate_events_read on public.certificate_events for select
  using (exists (select 1 from public.certificates c where c.id = certificate_id
    and (c.learner_id = auth.uid() or public.owns_course(c.course_id) or public.is_pedagogy_staff() or public.is_staff())));

-- Vérifications publiques : trace anonyme (sans adresse IP ni identité du visiteur)
create table public.certificate_verifications (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  verified_at timestamptz not null default now(),
  result text not null check (result in ('valid','suspended','revoked','expired'))
);
create index on public.certificate_verifications (certificate_id, verified_at desc);
alter table public.certificate_verifications enable row level security;
create policy verifications_read on public.certificate_verifications for select
  using (exists (select 1 from public.certificates c where c.id = certificate_id
    and (c.learner_id = auth.uid() or public.owns_course(c.course_id) or public.is_pedagogy_staff() or public.is_staff())));

-- ---------- Fonctions ----------
-- Autorisation : formateur de la formation ou personnel pédagogique
create or replace function public._can_manage_course(_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.owns_course(_course) or public.is_pedagogy_staff();
$$;

-- Rend les variables du modèle. Seules les clés connues sont substituées.
create or replace function public._render_text(_body text, _vars jsonb)
returns text language plpgsql immutable set search_path = public as $$
declare out text := _body; k text;
begin
  for k in select jsonb_object_keys(_vars) loop
    out := replace(out, '{{' || k || '}}', coalesce(_vars ->> k, ''));
  end loop;
  return out;
end $$;

-- Règles d'éligibilité. Seuil de présence : 80 % des séances où la présence a été saisie.
create or replace function public.certificate_eligibility(p_enrollment uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.enrollments%rowtype; s public.sessions%rowtype;
  missing_contents integer; failed_evaluations integer; present_count integer; recorded_count integer;
  reasons text[] := '{}';
  min_presence constant numeric := 0.8;
begin
  select * into e from public.enrollments where id = p_enrollment;
  if not found then raise exception 'enrollment_not_found'; end if;
  if not public._can_manage_course(e.course_id) and e.learner_id <> auth.uid() then raise exception 'forbidden'; end if;

  if e.status not in ('confirmed','completed') then reasons := array_append(reasons, 'enrollment_not_active'); end if;

  select count(*) into missing_contents from public.learning_contents c
    join public.course_modules m on m.id = c.module_id
    where m.course_id = e.course_id and c.status = 'published'
      and not exists (select 1 from public.content_completions cc where cc.content_id = c.id and cc.learner_id = e.learner_id);
  if missing_contents > 0 then reasons := array_append(reasons, 'contents_incomplete'); end if;

  select count(*) into failed_evaluations from public.evaluations ev
    where ev.course_id = e.course_id and ev.status = 'published'
      and (ev.session_id is null or ev.session_id = e.session_id)
      and not exists (select 1 from public.evaluation_attempts a
        where a.evaluation_id = ev.id and a.learner_id = e.learner_id and a.passed);
  if failed_evaluations > 0 then reasons := array_append(reasons, 'evaluations_not_passed'); end if;

  if e.session_id is not null then
    select * into s from public.sessions where id = e.session_id;
    select count(*) filter (where status in ('present','late','excused')), count(*)
      into present_count, recorded_count
      from public.attendance_records where session_id = e.session_id and learner_id = e.learner_id;
    if recorded_count = 0 then
      if s.end_at < now() then reasons := array_append(reasons, 'attendance_not_recorded'); end if;
    elsif present_count::numeric / recorded_count < min_presence then
      reasons := array_append(reasons, 'attendance_insufficient');
    end if;
  end if;

  return jsonb_build_object('eligible', cardinality(reasons) = 0, 'reasons', to_jsonb(reasons));
end $$;

-- Émission (cœur, sans contrôle d'autorisation : appelé par les fonctions publiques)
create or replace function public._issue_certificate(_id uuid, _enrollment uuid, _template uuid, _params jsonb, _actor uuid, _replaces uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e public.enrollments%rowtype; c public.courses%rowtype; s public.sessions%rowtype; t public.certificate_templates%rowtype;
  p public.profiles%rowtype; num text; tok text; vars jsonb; valid_until timestamptz; body text; title text;
  rendered_title text;
begin
  select * into e from public.enrollments where id = _enrollment;
  select * into c from public.courses where id = e.course_id;
  select * into p from public.profiles where id = e.learner_id;
  if _template is null then raise exception 'template_required'; end if;
  select * into t from public.certificate_templates where id = _template;
  if not found or t.status <> 'published' then raise exception 'template_not_available'; end if;

  if not (public.certificate_eligibility(_enrollment) ->> 'eligible')::boolean then
    raise exception 'not_eligible';
  end if;

  if _params ->> 'validity_months' is not null then
    valid_until := now() + make_interval(months => least(greatest((_params ->> 'validity_months')::int, 1), 120));
  end if;

  num := 'SP-' || to_char(now() at time zone 'Africa/Abidjan', 'YYYY') || '-' || lpad(nextval('public.certificate_number_seq')::text, 6, '0');
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  if e.session_id is not null then select * into s from public.sessions where id = e.session_id; end if;
  vars := jsonb_build_object(
    'apprenant', coalesce(nullif(p.full_name, ''), 'l’apprenant'),
    'formation', c.title,
    'session', case when s.id is null then 'accès libre' else 'session du ' || to_char(s.start_at at time zone 'Africa/Abidjan', 'DD/MM/YYYY') end,
    'date', to_char(now() at time zone 'Africa/Abidjan', 'DD/MM/YYYY'),
    'numero', num,
    'validite', case when valid_until is null then 'sans limite de validité' else 'valable jusqu’au ' || to_char(valid_until at time zone 'Africa/Abidjan', 'DD/MM/YYYY') end
  );
  title := left(coalesce(nullif(_params ->> 'title', ''), t.title), 200);
  rendered_title := public._render_text(title, vars);
  body := public._render_text(left(coalesce(nullif(_params ->> 'body', ''), t.body), 2000), vars);

  insert into public.certificates (id, certificate_number, verification_token, enrollment_id, learner_id, course_id, session_id,
    template_id, content, issued_by, issued_at, valid_until, pdf_path, replaces_id)
  values (coalesce(_id, gen_random_uuid()), num, tok, e.id, e.learner_id, e.course_id, e.session_id, t.id,
    jsonb_build_object(
      'holder_name', coalesce(nullif(p.full_name, ''), ''),
      'course_title', c.title,
      'session_title', coalesce(s.title, ''),
      'session_start', s.start_at,
      'layout', t.layout,
      'title', rendered_title,
      'body', body,
      'signatory_name', left(coalesce(_params ->> 'signatory_name', ''), 120),
      'signatory_role', left(coalesce(_params ->> 'signatory_role', ''), 120),
      'issuer', 'SECURIPASS',
      'issued_on', vars ->> 'date',
      'validity', vars ->> 'validite'),
    _actor, now(), valid_until, null, _replaces)
  returning id into _id;

  update public.certificates set pdf_path = id::text || '.pdf' where id = _id;
  insert into public.certificate_events (certificate_id, event_type, actor_id, metadata)
    values (_id, 'issued', _actor, jsonb_build_object('template', t.id, 'number', num));
  return jsonb_build_object('id', _id, 'certificate_number', num, 'verification_token', tok);
end $$;

create or replace function public.issue_certificate(p_enrollment uuid, p_template uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare course uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select course_id into course from public.enrollments where id = p_enrollment;
  if course is null then raise exception 'enrollment_not_found'; end if;
  if not public._can_manage_course(course) then raise exception 'forbidden'; end if;
  return public._issue_certificate(null, p_enrollment, p_template, coalesce(p_params, '{}'::jsonb), auth.uid(), null);
end $$;

-- Réémission : révoque le certificat actif (motif obligatoire) puis en émet un nouveau, lié au précédent
create or replace function public.reissue_certificate(p_old uuid, p_template uuid, p_params jsonb, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare old public.certificates%rowtype; result jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into old from public.certificates where id = p_old for update;
  if not found then raise exception 'certificate_not_found'; end if;
  if not public._can_manage_course(old.course_id) then raise exception 'forbidden'; end if;
  if old.status = 'revoked' then raise exception 'certificate_revoked'; end if;
  if char_length(coalesce(p_reason, '')) < 3 then raise exception 'reason_required'; end if;

  update public.certificates set status = 'revoked', revoked_at = now(), revocation_reason = p_reason where id = old.id;
  insert into public.certificate_events (certificate_id, event_type, actor_id, reason) values (old.id, 'revoked', auth.uid(), p_reason);

  result := public._issue_certificate(null, old.enrollment_id, p_template, coalesce(p_params, '{}'::jsonb), auth.uid(), old.id);
  insert into public.certificate_events (certificate_id, event_type, actor_id, reason, metadata)
    values (old.id, 'reissued', auth.uid(), p_reason, jsonb_build_object('new_id', result ->> 'id'));
  return result;
end $$;

-- Suspension, levée de suspension, révocation (avec motif)
create or replace function public.change_certificate_status(p_id uuid, p_action text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.certificates%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into c from public.certificates where id = p_id for update;
  if not found then raise exception 'certificate_not_found'; end if;
  if not public._can_manage_course(c.course_id) then raise exception 'forbidden'; end if;

  if p_action = 'suspend' and c.status = 'valid' then
    update public.certificates set status = 'suspended' where id = c.id;
  elsif p_action = 'reinstate' and c.status = 'suspended' then
    update public.certificates set status = 'valid' where id = c.id;
  elsif p_action = 'revoke' and c.status in ('valid','suspended') then
    if char_length(coalesce(p_reason, '')) < 3 then raise exception 'reason_required'; end if;
    update public.certificates set status = 'revoked', revoked_at = now(), revocation_reason = p_reason where id = c.id;
  else
    raise exception 'invalid_transition';
  end if;

  if p_action in ('suspend','revoke') and char_length(coalesce(p_reason, '')) < 3 then raise exception 'reason_required'; end if;
  insert into public.certificate_events (certificate_id, event_type, actor_id, reason)
    values (c.id, case p_action when 'suspend' then 'suspended' when 'reinstate' then 'reinstated' else 'revoked' end, auth.uid(), p_reason);
end $$;

-- Vérification publique : numéro ou jeton. Ne renvoie que les informations autorisées.
create or replace function public.verify_certificate(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.certificates%rowtype; result text; name_parts text[]; public_name text;
begin
  if p_code is null or char_length(p_code) < 6 or char_length(p_code) > 80 then return jsonb_build_object('found', false); end if;
  select * into c from public.certificates where certificate_number = p_code or verification_token = p_code;
  if not found then return jsonb_build_object('found', false); end if;

  result := case
    when c.status = 'revoked' then 'revoked'
    when c.status = 'suspended' then 'suspended'
    when c.valid_until is not null and c.valid_until <= now() then 'expired'
    else 'valid' end;
  insert into public.certificate_verifications (certificate_id, result) values (c.id, result);

  -- Prénom et initiale du nom uniquement
  name_parts := regexp_split_to_array(trim(coalesce(c.content ->> 'holder_name', '')), '\s+');
  public_name := case when cardinality(name_parts) >= 2
    then name_parts[1] || ' ' || upper(left(name_parts[cardinality(name_parts)], 1)) || '.'
    else coalesce(name_parts[1], '') end;

  return jsonb_build_object(
    'found', true,
    'certificate_number', c.certificate_number,
    'holder_name', public_name,
    'course_title', c.content ->> 'course_title',
    'issued_at', c.issued_at,
    'valid_until', c.valid_until,
    'issuer', 'SECURIPASS',
    'status', result,
    'revoked_at', case when c.status = 'revoked' then c.revoked_at end);
end $$;

-- ---------- Droits ----------
-- Appelée aussi par les politiques de stockage, donc exécutable par les utilisateurs connectés (sans effet hors RLS)
revoke execute on function public._can_manage_course(uuid) from public, anon;
grant execute on function public._can_manage_course(uuid) to authenticated;
revoke execute on function public._issue_certificate(uuid, uuid, uuid, jsonb, uuid, uuid) from public, anon, authenticated;
revoke execute on function public._render_text(text, jsonb) from public, anon;
revoke execute on function public.certificate_eligibility(uuid) from public, anon;
revoke execute on function public.issue_certificate(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.reissue_certificate(uuid, uuid, jsonb, text) from public, anon;
revoke execute on function public.change_certificate_status(uuid, text, text) from public, anon;
revoke execute on function public.verify_certificate(text) from public;
grant execute on function public.certificate_eligibility(uuid) to authenticated;
grant execute on function public.issue_certificate(uuid, uuid, jsonb) to authenticated;
grant execute on function public.reissue_certificate(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.change_certificate_status(uuid, text, text) to authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ---------- Stockage : copie PDF (bucket privé) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificates', 'certificates', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Le formateur ou le personnel peut déposer la copie d'un certificat dont il gère la formation ; l'apprenant la lit
create policy certificates_pdf_write on storage.objects for insert
  with check (bucket_id = 'certificates' and exists (select 1 from public.certificates c
    where c.pdf_path = storage.objects.name and public._can_manage_course(c.course_id)));
create policy certificates_pdf_update on storage.objects for update
  using (bucket_id = 'certificates' and exists (select 1 from public.certificates c
    where c.pdf_path = storage.objects.name and public._can_manage_course(c.course_id)));
create policy certificates_pdf_read on storage.objects for select
  using (bucket_id = 'certificates' and exists (select 1 from public.certificates c
    where c.pdf_path = storage.objects.name and (c.learner_id = auth.uid() or public._can_manage_course(c.course_id))));
