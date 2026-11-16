-- Lot 8 : paramètres de la plateforme (écran « Paramètres »).
--  - platform_settings : une seule ligne (identité, langue, devise, fuseau, e-mail d'expédition, couleurs) ; lecture et écriture réservées aux administrateurs ;
--  - admin_update_platform_settings : met à jour les champs fournis et trace la modification dans le journal d'audit.
-- Les valeurs sont enregistrées ; leur application au reste de la plateforme (couleurs, devise, expéditeur des e-mails) reste à brancher.

create table public.platform_settings (
  id boolean primary key default true check (id),
  name text not null default 'SECURIPASS' check (char_length(name) between 2 and 80),
  default_language text not null default 'fr' check (default_language in ('fr', 'en')),
  currency text not null default 'XOF' check (currency in ('XOF', 'EUR', 'USD')),
  timezone text not null default 'Africa/Abidjan' check (timezone in ('Africa/Abidjan', 'Africa/Dakar', 'Africa/Lagos', 'Europe/Paris', 'UTC')),
  sender_email text not null default 'no-reply@securipass.ci' check (sender_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(sender_email) <= 200),
  color_primary text not null default '#1F3F6D' check (color_primary ~ '^#[0-9A-Fa-f]{6}$'),
  color_secondary text not null default '#EED58E' check (color_secondary ~ '^#[0-9A-Fa-f]{6}$'),
  color_accent text not null default '#FF7A00' check (color_accent ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.platform_settings default values;
alter table public.platform_settings enable row level security;
create policy platform_settings_admin on public.platform_settings for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- p_values : objet JSON ne contenant que les champs à modifier ; un champ inconnu est refusé
create or replace function public.admin_update_platform_settings(p_values jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare k text; allowed text[] := array['name', 'default_language', 'currency', 'timezone', 'sender_email', 'color_primary', 'color_secondary', 'color_accent'];
begin
  perform public._admin_only();
  if p_values is null or jsonb_typeof(p_values) <> 'object' or p_values = '{}'::jsonb then raise exception 'values_invalid'; end if;
  for k in select jsonb_object_keys(p_values) loop
    if not (k = any(allowed)) then raise exception 'field_unknown'; end if;
  end loop;
  update public.platform_settings set
    name = coalesce(btrim(p_values->>'name'), name),
    default_language = coalesce(p_values->>'default_language', default_language),
    currency = coalesce(p_values->>'currency', currency),
    timezone = coalesce(p_values->>'timezone', timezone),
    sender_email = coalesce(lower(btrim(p_values->>'sender_email')), sender_email),
    color_primary = coalesce(upper(p_values->>'color_primary'), color_primary),
    color_secondary = coalesce(upper(p_values->>'color_secondary'), color_secondary),
    color_accent = coalesce(upper(p_values->>'color_accent'), color_accent),
    updated_at = now(), updated_by = auth.uid();
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'settings.update', 'platform_settings', 'platform', jsonb_build_object('fields', (select jsonb_agg(x) from jsonb_object_keys(p_values) x)));
end $$;

revoke execute on function public.admin_update_platform_settings(jsonb) from public, anon;
grant execute on function public.admin_update_platform_settings(jsonb) to authenticated;
