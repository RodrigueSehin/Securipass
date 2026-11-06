-- Lot 4 : tableau de bord « Mes sessions ».
--  - référence lisible SEC-AAAA-NNN attribuée à la création ;
--  - statut « brouillon » : la session n'est pas encore ouverte aux inscriptions (le catalogue ne retient que 'scheduled').

alter table public.sessions add column reference text;

create sequence public.session_reference_seq;

create or replace function public.set_session_reference()
returns trigger language plpgsql as $$
begin
  if new.reference is null then
    new.reference := 'SEC-' || to_char(new.start_at at time zone 'UTC', 'YYYY') || '-' || lpad(nextval('public.session_reference_seq')::text, 3, '0');
  end if;
  return new;
end $$;

create trigger sessions_reference before insert on public.sessions
  for each row execute function public.set_session_reference();

-- Sessions existantes : numérotées dans l'ordre de création
update public.sessions s set reference = 'SEC-' || to_char(s.start_at at time zone 'UTC', 'YYYY') || '-' || lpad(n.rn::text, 3, '0')
from (select id, nextval('public.session_reference_seq') as rn from (select id from public.sessions order by created_at, id) o) n
where s.id = n.id;

alter table public.sessions alter column reference set not null;
create unique index sessions_reference_key on public.sessions (reference);

do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.sessions'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%scheduled%cancelled%completed%'
  loop
    execute format('alter table public.sessions drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.sessions add constraint sessions_status_check check (status in ('draft','scheduled','cancelled','completed'));
