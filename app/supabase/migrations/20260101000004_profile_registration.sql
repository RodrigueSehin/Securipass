-- SECURIPASS — Inscription en 3 étapes : date de naissance, situation, préférences et consentement
alter table public.profiles
  add column birth_date date check (birth_date is null or (birth_date >= date '1900-01-01' and birth_date <= current_date)),
  add column situation text check (situation is null or situation in ('individual','employee','jobseeker','security_pro','student','other')),
  add column preferences jsonb not null default '{}'::jsonb,
  add column terms_accepted_at timestamptz,
  add column terms_version text;

-- Création du profil à l'inscription. Les métadonnées viennent du client (modifiables par un appel direct à l'API
-- d'authentification) : tout est validé et borné ici. Les rôles ne sont JAMAIS lus depuis les métadonnées.
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
  return new;
end $$;
