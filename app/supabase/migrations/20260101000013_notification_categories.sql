-- Notifications de certificats (émission, révocation) et catégories d'affichage.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'enrollment_confirmed','enrollment_waitlisted','waitlist_promoted',
  'session_changed','session_cancelled','evaluation_available','evaluation_result',
  'message_received','certificate_issued','certificate_revoked'));

create or replace function public.notify_certificate()
returns trigger language plpgsql security definer set search_path = public as $$
declare ctitle text;
begin
  select title into ctitle from public.courses where id = new.course_id;
  if tg_op = 'INSERT' then
    perform public._notify(new.learner_id, 'certificate_issued', 'Certificat disponible',
      coalesce(ctitle, '') || ' — ' || new.certificate_number, '/app/certificats');
  elsif tg_op = 'UPDATE' and new.status = 'revoked' and old.status <> 'revoked' then
    perform public._notify(new.learner_id, 'certificate_revoked', 'Certificat révoqué',
      coalesce(ctitle, '') || ' — ' || new.certificate_number, '/app/certificats');
  end if;
  return new;
end $$;

create trigger certificates_notify after insert or update of status on public.certificates
  for each row execute function public.notify_certificate();
