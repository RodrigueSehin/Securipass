-- Lot 8 : écran « Paramètres généraux » — slogan, description, contact, site, adresse, formats de date et d'heure, options générales.
-- Les valeurs sont enregistrées ; l'inscription en ligne, les notifications, les SMS et le mode maintenance ne sont pas encore appliqués au reste de la plateforme.

alter table public.platform_settings
  add column tagline text not null default 'Former · Certifier · Sécuriser' check (char_length(tagline) <= 120),
  add column description text not null default 'Plateforme de gestion de la formation, de la certification et du développement des compétences.' check (char_length(description) between 1 and 250),
  add column contact_phone text not null default '' check (char_length(contact_phone) <= 40),
  add column website text not null default '' check (char_length(website) <= 200 and (website = '' or website ~* '^https?://[^\s]+$')),
  add column address text not null default '' check (char_length(address) <= 200),
  add column date_format text not null default 'dd/mm/yyyy' check (date_format in ('dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd')),
  add column time_format text not null default '24h' check (time_format in ('24h', '12h')),
  add column allow_registrations boolean not null default true,
  add column email_notifications boolean not null default true,
  add column sms_notifications boolean not null default false,
  add column maintenance_mode boolean not null default false;

create or replace function public.admin_update_platform_settings(p_values jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare k text;
  allowed text[] := array['name', 'default_language', 'currency', 'timezone', 'sender_email', 'color_primary', 'color_secondary', 'color_accent',
    'tagline', 'description', 'contact_phone', 'website', 'address', 'date_format', 'time_format', 'allow_registrations', 'email_notifications', 'sms_notifications', 'maintenance_mode'];
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
    tagline = coalesce(btrim(p_values->>'tagline'), tagline),
    description = coalesce(btrim(p_values->>'description'), description),
    contact_phone = coalesce(btrim(p_values->>'contact_phone'), contact_phone),
    website = coalesce(btrim(p_values->>'website'), website),
    address = coalesce(btrim(p_values->>'address'), address),
    date_format = coalesce(p_values->>'date_format', date_format),
    time_format = coalesce(p_values->>'time_format', time_format),
    allow_registrations = coalesce((p_values->>'allow_registrations')::boolean, allow_registrations),
    email_notifications = coalesce((p_values->>'email_notifications')::boolean, email_notifications),
    sms_notifications = coalesce((p_values->>'sms_notifications')::boolean, sms_notifications),
    maintenance_mode = coalesce((p_values->>'maintenance_mode')::boolean, maintenance_mode),
    updated_at = now(), updated_by = auth.uid();
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'settings.update', 'platform_settings', 'platform', jsonb_build_object('fields', (select jsonb_agg(x) from jsonb_object_keys(p_values) x)));
end $$;
