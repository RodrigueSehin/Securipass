-- Lot 4 : champs de l'assistant de création de formation (maquettes « Créer une formation », étapes 1 à 5).

alter table public.courses
  add column subtitle text check (subtitle is null or char_length(subtitle) between 1 and 150),
  add column course_code text check (course_code is null or char_length(course_code) between 1 and 40),
  add column external_reference text check (external_reference is null or char_length(external_reference) between 1 and 120),
  add column certificate_template_id uuid references public.certificate_templates(id) on delete set null,
  add column audience_types text[] not null default '{}'
    check (audience_types <@ array['individuals','companies','administrations','partners']::text[]),
  add column keywords text[] not null default '{}' check (cardinality(keywords) <= 20);

-- La copie d'une formation reprend aussi les nouveaux champs.
create or replace function public.duplicate_course(p_course uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.courses%rowtype; new_id uuid; m record; new_m uuid;
begin
  if not (public.owns_course(p_course) or public.is_pedagogy_staff()) then raise exception 'forbidden'; end if;
  select * into c from public.courses where id = p_course;
  insert into public.courses (instructor_id, category_id, title, slug, description, objectives, prerequisites, target_audience,
      level, duration_minutes, delivery_mode, price_amount, currency, cover_url, status, language, competencies,
      evaluation_modalities, certificate_conditions, certificate_validity_months, cancellation_policy, accessibility,
      prerequisite_course_id, subtitle, course_code, external_reference, certificate_template_id, audience_types, keywords)
  values (c.instructor_id, c.category_id, c.title || ' (copie)', c.slug || '-copie-' || substr(md5(random()::text), 1, 6),
      c.description, c.objectives, c.prerequisites, c.target_audience, c.level, c.duration_minutes, c.delivery_mode,
      c.price_amount, c.currency, c.cover_url, 'draft', c.language, c.competencies, c.evaluation_modalities,
      c.certificate_conditions, c.certificate_validity_months, c.cancellation_policy, c.accessibility,
      c.prerequisite_course_id, c.subtitle, c.course_code, c.external_reference, c.certificate_template_id,
      c.audience_types, c.keywords)
  returning id into new_id;
  for m in select * from public.course_modules where course_id = p_course order by position loop
    insert into public.course_modules (course_id, title, description, position)
    values (new_id, m.title, m.description, m.position) returning id into new_m;
    insert into public.learning_contents (module_id, title, content_type, description, body, file_path, external_url,
        duration_minutes, position, status)
    select new_m, title, content_type, description, body, file_path, external_url, duration_minutes, position, 'draft'
    from public.learning_contents where module_id = m.id;
  end loop;
  return new_id;
end $$;
