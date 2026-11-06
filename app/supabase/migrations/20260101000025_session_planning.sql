-- Lot 4 : planification d'une session (assistant « Créer une session », étape 2).
--  - plateforme de visioconférence, message de bienvenue, invitation automatique et ajout à l'agenda des apprenants.

alter table public.sessions
  add column meeting_platform text check (meeting_platform is null or meeting_platform in ('teams','zoom','meet','other')),
  add column welcome_message text check (welcome_message is null or char_length(welcome_message) <= 500),
  add column send_invitation boolean not null default true,
  add column add_to_calendar boolean not null default false;
