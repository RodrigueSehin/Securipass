-- Lot 4 : places par session (valeur proposée à la création d'une session) et niveau de langue requis.

alter table public.courses
  add column default_capacity integer check (default_capacity is null or default_capacity between 1 and 10000),
  add column language_requirement text check (language_requirement is null or language_requirement in ('basic','intermediate','fluent'));

-- La copie d'une formation reprend aussi ces champs.
create or replace function public.duplicate_course(p_course uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.courses%rowtype; new_id uuid; m record; new_m uuid;
begin
  if not (public.owns_course(p_course) or public.is_pedagogy_staff()) then raise exception 'forbidden'; end if;
  select * into c from public.courses where id = p_course;
  insert into public.courses (instructor_id, category_id, title, slug, description, objectives, prerequisites, target_audience,
      level, duration_minutes, delivery_mode, price_amount, currency, cover_url, status, language, competencies,
      evaluation_modalities, certificate_conditions, certificate_validity_months, cancellation_policy, accessibility,
      prerequisite_course_id, subtitle, course_code, external_reference, certificate_template_id, audience_types, keywords,
      default_capacity, language_requirement)
  values (c.instructor_id, c.category_id, c.title || ' (copie)', c.slug || '-copie-' || substr(md5(random()::text), 1, 6),
      c.description, c.objectives, c.prerequisites, c.target_audience, c.level, c.duration_minutes, c.delivery_mode,
      c.price_amount, c.currency, c.cover_url, 'draft', c.language, c.competencies, c.evaluation_modalities,
      c.certificate_conditions, c.certificate_validity_months, c.cancellation_policy, c.accessibility,
      c.prerequisite_course_id, c.subtitle, c.course_code, c.external_reference, c.certificate_template_id,
      c.audience_types, c.keywords, c.default_capacity, c.language_requirement)
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
