-- SECURIPASS — Blog : inscriptions à la newsletter, enregistrées avec les autres demandes publiques (même anti-spam).
alter table public.public_requests drop constraint public_requests_kind_check;
alter table public.public_requests add constraint public_requests_kind_check
  check (kind in ('contact','quote','trainer_application','newsletter'));
