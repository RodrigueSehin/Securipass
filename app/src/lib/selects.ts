/**
 * Requêtes PostgREST avec jointures. Elles sont centralisées ici pour être exécutées telles quelles par les tests
 * d'intégration : une jointure ambiguë (plusieurs clés étrangères vers la même table) échoue et ne doit jamais
 * passer inaperçue. Règle : toute jointure vers `profiles` ou `courses` précise sa clé étrangère.
 */
export const PARTICIPANT_SELECT =
  "id, status, enrolled_at, learner:profiles!enrollments_learner_id_fkey(full_name, email, phone)";

export const MY_ENROLLMENTS_SELECT =
  "id, status, enrolled_at, course:courses(title, slug), session:sessions(title, start_at, end_at, timezone, location)";

export const ADMIN_COURSE_LIST_SELECT =
  "id, title, status, price_amount, updated_at, category:categories(name), instructor:profiles!courses_instructor_id_fkey(full_name)";

export const ADMIN_COURSE_DETAIL_SELECT =
  "*, instructor:profiles!courses_instructor_id_fkey(full_name, email), category:categories(name)";

export const OWN_COURSE_LIST_SELECT = "id, title, slug, status, price_amount, updated_at, category:categories(name)";

export const COURSE_CARD_SELECT =
  "id, slug, title, description, duration_minutes, price_amount, currency, cover_url, delivery_mode, level, published_at, is_demo, featured, category:categories(name, slug)";
