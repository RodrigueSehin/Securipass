-- Profil apprenant : informations personnelles et professionnelles, photo privée.
-- Tous les champs sont facultatifs ; la complétion est calculée sur ce qui est réellement renseigné.

alter table public.profiles
  add column gender text check (gender is null or gender in ('female','male','other','prefer_not_say')),
  add column nationality text check (nationality is null or char_length(nationality) between 2 and 60),
  add column locality text check (locality is null or char_length(locality) between 2 and 120),
  add column address text check (address is null or char_length(address) between 2 and 200),
  add column profession text check (profession is null or char_length(profession) between 2 and 120),
  add column employer text check (employer is null or char_length(employer) between 2 and 120),
  add column experience_band text check (experience_band is null or experience_band in ('under_2','2_to_5','5_to_10','over_10')),
  add column education_level text check (education_level is null or education_level in ('primary','secondary','baccalaureate','bachelor','master','other')),
  add column languages text[] not null default '{}' check (cardinality(languages) <= 10),
  add column availability text check (availability is null or availability in ('full_time','part_time','evenings','weekends')),
  add column training_goal text check (training_goal is null or char_length(training_goal) between 2 and 300),
  add column photo_path text;

-- Photo : bucket privé, un seul fichier par utilisateur, dans son propre dossier
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 2097152, array['image/jpeg','image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy profile_photos_own_write on storage.objects for all
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
