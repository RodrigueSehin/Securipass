-- Lot 4 : assistant « Ajouter un apprenant » (4 étapes).
-- Le formateur saisit la fiche d'un apprenant et choisit ses sessions. Si l'apprenant a déjà un compte, l'inscription est
-- immédiate ; sinon la fiche reste « en attente » et l'inscription se fait toute seule quand un compte est créé avec
-- la même adresse e-mail (aucun compte n'est créé à la place de la personne : pas de mot de passe à transmettre).

create table public.learner_registrations (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 80),
  email text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text not null check (char_length(phone) between 6 and 25),
  birth_date date check (birth_date is null or (birth_date >= date '1900-01-01' and birth_date <= current_date)),
  gender text check (gender is null or gender in ('female','male','other','prefer_not_say')),
  company text check (company is null or char_length(company) <= 120),
  job_title text check (job_title is null or char_length(job_title) <= 120),
  address text check (address is null or char_length(address) <= 200),
  notes text check (notes is null or char_length(notes) <= 500),
  photo_path text,
  session_ids uuid[] not null default '{}' check (cardinality(session_ids) <= 20),
  notify boolean not null default true,
  status text not null default 'draft' check (status in ('draft','pending','enrolled')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.learner_registrations (instructor_id, status, updated_at desc);
create index on public.learner_registrations (lower(email)) where status = 'pending';
create trigger learner_registrations_touch before update on public.learner_registrations
  for each row execute function public.touch_updated_at();

alter table public.learner_registrations enable row level security;
create policy learner_registrations_own on public.learner_registrations for all
  using (instructor_id = auth.uid() and public.has_role('instructor'))
  with check (instructor_id = auth.uid() and public.has_role('instructor'));

-- Inscrit l'apprenant à chaque session de la fiche ; une session refusée (complète, fermée, déjà inscrit…) n'empêche pas les autres.
create or replace function public._enroll_registration(_reg uuid, _learner uuid, _fill_profile boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.learner_registrations%rowtype; s public.sessions%rowtype; sid uuid; ok integer := 0; failed jsonb := '[]'::jsonb;
begin
  select * into r from public.learner_registrations where id = _reg;
  foreach sid in array r.session_ids loop
    select * into s from public.sessions where id = sid;
    begin
      if not found then raise exception 'session_invalid'; end if;
      perform public._do_enroll(_learner, s.course_id, sid, r.instructor_id, true);
      ok := ok + 1;
    exception when others then
      failed := failed || jsonb_build_object('session_id', sid, 'error', sqlerrm);
    end;
  end loop;

  -- Compte tout juste créé : on le complète avec la fiche, sans écraser ce que la personne a saisie elle-même
  if _fill_profile then
    update public.profiles set
      phone = coalesce(phone, r.phone), birth_date = coalesce(birth_date, r.birth_date), gender = coalesce(gender, r.gender),
      employer = coalesce(employer, r.company), profession = coalesce(profession, r.job_title), address = coalesce(address, r.address),
      full_name = case when full_name = '' then btrim(r.first_name || ' ' || r.last_name) else full_name end
    where id = _learner;
  end if;

  update public.learner_registrations
    set status = 'enrolled', result = jsonb_build_object('enrolled', ok, 'failed', failed, 'learner_id', _learner)
    where id = _reg;
  return jsonb_build_object('status', 'enrolled', 'enrolled', ok, 'failed', failed);
end $$;

create or replace function public.confirm_learner_registration(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.learner_registrations%rowtype; l uuid; owned integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into r from public.learner_registrations where id = p_id and instructor_id = auth.uid() and status = 'draft' for update;
  if not found then raise exception 'registration_not_found'; end if;
  if cardinality(r.session_ids) = 0 then raise exception 'sessions_required'; end if;
  select count(*) into owned from public.sessions where id = any(r.session_ids) and instructor_id = auth.uid();
  if owned <> (select count(distinct x) from unnest(r.session_ids) x) then raise exception 'forbidden'; end if;

  select id into l from public.profiles where lower(email) = lower(btrim(r.email));
  if l is null then
    update public.learner_registrations set status = 'pending' where id = p_id;
    return jsonb_build_object('status', 'pending');
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'enrollment.manual', 'learner_registration', p_id::text, jsonb_build_object('learner_id', l, 'sessions', r.session_ids));
  return public._enroll_registration(p_id, l, false);
end $$;

-- À la création d'un compte : les fiches en attente à cette adresse déclenchent les inscriptions
create or replace function public._claim_learner_registrations(_user uuid, _email text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.learner_registrations where status = 'pending' and lower(email) = lower(btrim(_email)) loop
    perform public._enroll_registration(r.id, _user, true);
  end loop;
end $$;

revoke execute on function public._enroll_registration(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public._claim_learner_registrations(uuid, text) from public, anon, authenticated;
revoke execute on function public.confirm_learner_registration(uuid) from public, anon;
grant execute on function public.confirm_learner_registration(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  bd date;
  sit text;
  interests jsonb := '[]'::jsonb;
  accepted boolean := coalesce((meta->>'terms_accepted') = 'true', false);
begin
  begin bd := (meta->>'birth_date')::date; exception when others then bd := null; end;
  if bd is not null and (bd < date '1900-01-01' or bd > current_date) then bd := null; end if;

  sit := meta->>'situation';
  if sit is null or sit not in ('individual','employee','jobseeker','security_pro','student','other') then sit := null; end if;

  if jsonb_typeof(meta->'interests') = 'array' then
    select coalesce(jsonb_agg(v), '[]'::jsonb) into interests
    from (select v from jsonb_array_elements_text(meta->'interests') as t(v) where v ~ '^[a-z0-9-]{1,80}$' limit 10) s;
  end if;

  insert into public.profiles (id, full_name, email, phone, birth_date, situation, preferences, terms_accepted_at, terms_version)
  values (
    new.id,
    left(coalesce(meta->>'full_name', ''), 120),
    new.email,
    nullif(left(coalesce(meta->>'phone', ''), 20), ''),
    bd,
    sit,
    jsonb_build_object(
      'interests', interests,
      'notify_email', (meta->>'notify_email') is distinct from 'false',
      'notify_sms', coalesce((meta->>'notify_sms') = 'true', false)
    ),
    case when accepted then now() end,
    case when accepted then nullif(left(coalesce(meta->>'terms_version', ''), 20), '') end
  );
  insert into public.user_roles (user_id, role_id) select new.id, id from public.roles where code = 'learner';

  -- Une fiche en attente ne doit jamais empêcher l'inscription du compte
  begin
    perform public._claim_learner_registrations(new.id, new.email);
  exception when others then
    null;
  end;
  return new;
end $$;
