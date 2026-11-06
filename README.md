# SECURIPASS

Plateforme de formation, d'évaluation et de certification professionnelle en sécurité.
Avancement : voir [PLAN.md](PLAN.md). Spécification : `maquettes/# PROMPT MAÎTRE — SECURIPASS.txt`.

## Installation

Prérequis : Node.js ≥ 20, un projet Supabase.

```bash
npm run setup                # installe les dépendances de app/ (depuis la racine du dépôt)
cp app/.env.example app/.env # puis renseigner les valeurs (voir ci-dessous)
npm run dev                  # http://localhost:3000
```

Les commandes `dev`, `build`, `start`, `lint` et `test` fonctionnent depuis la racine (elles sont relayées vers `app/`) ou directement dans `app/`.

### Variables d'environnement (`app/.env`)

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique (soumise à la RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé privilégiée, **serveur uniquement**, jamais côté client |
| `NEXT_PUBLIC_SITE_URL` | URL du site (`http://localhost:3000` en local) |
| `NEXT_PUBLIC_CONTACT_EMAIL`, `_PHONE`, `_ADDRESS`, `_HOURS` | Coordonnées affichées dans la barre supérieure, le pied de page et la page Contact (facultatif ; rien n'est affiché si absent) |
| `NEXT_PUBLIC_SOCIAL_FACEBOOK`, `_LINKEDIN`, `_YOUTUBE`, `_INSTAGRAM` | URL https des réseaux sociaux (facultatif) |
| `NEXT_PUBLIC_PROMO_VIDEO_URL` | URL https de la vidéo de présentation : affiche le bouton « Voir la vidéo » de l'accueil |

### Base de données

Appliquer dans l'ordre les migrations de `app/supabase/migrations/` (CLI Supabase : `npx supabase link` puis `npx supabase db push`, ou copier chaque fichier dans *SQL Editor*) :

1. `20260101000001_foundations.sql` — identité, rôles, organisations, catalogue, audit, RLS
2. `20260101000002_public_requests.sql` — demandes des formulaires publics (contact, devis, candidature formateur)
3. `20260101000003_courses_sessions_enrollments.sql` — formations complètes, contenus, sessions, inscriptions, stockage
4. `20260101000004_profile_registration.sql` — inscription en 3 étapes : date de naissance, situation, préférences, consentement
5. `20260101000005_demo_flag.sql` — marqueur `is_demo` des formations de démonstration
6. `20260101000006_newsletter_requests.sql` — inscriptions à la lettre d'information
7. `20260101000007_trainer_profiles.sql` — profils publics des formateurs
8. `20260101000008_learner_space.sql` — espace apprenant : progression, notifications, présences, évaluations, accès aux fichiers des inscrits
9. `20260101000009_evaluation_schedule.sql` — date d'ouverture des évaluations
10. `20260101000010_certifications.sql` — modèles, certificats, éligibilité, vérification publique, révocation, copies PDF privées
11. `20260101000011_messaging.sql` — messagerie apprenant : conversations avec les formateurs et le support, lecture, pièces jointes privées
12. `20260101000012_profile_details.sql` — profil : informations personnelles et professionnelles facultatives, photo privée
13. `20260101000013_notification_categories.sql` — notifications de certificats (émission, révocation)
14. `20260101000014_course_wizard.sql` — assistant de création : sous-titre, code, modèle de certificat, publics, mots-clés
15. `20260101000015_course_capacity_language.sql` — places par session et niveau de langue requis
16. `20260101000016_course_reviews.sql` — avis des apprenants et note moyenne publique
17. `20260101000017_enrollment_modes.sql` — inscription libre, sur validation ou par code d’accès
18. `20260101000018_module_resources.sql` — ressources téléchargeables des modules
19. `20260101000019_evaluation_certification.sql` — réglages d’évaluation et de certification, activités notées par le formateur, éligibilité pondérée
20. `20260101000020_course_settings.sql` — publication planifiée, paiement, forum, options pédagogiques, certificat automatique
21. `20260101000021_publication_settings.sql` — mise en avant et ouverture des inscriptions
22. `20260101000022_content_wizard.sql` — contenus pédagogiques : types, prérequis, disponibilité, pièces jointes, publication contrôlée
23. `20260101000023_session_management.sql` — sessions : référence SEC-AAAA-NNN, statut brouillon
24. `20260101000024_session_wizard.sql` — assistant de création de session : informations pédagogiques, brouillon de l’assistant
25. `20260101000025_session_planning.sql` — planification de session : plateforme de visioconférence, message aux apprenants, options d’invitation et d’agenda
26. `20260101000026_learner_registrations.sql` — fiches apprenants de l’assistant « Ajouter un apprenant » : inscription immédiate ou en attente de la création du compte
27. `20260101000027_admin_dashboard.sql` — tableau de bord d’administration : totaux, séries mensuelles, répartition des comptes
28. `20260101000028_admin_users.sql` — gestion des utilisateurs : liste filtrable, indicateurs, rôles et suspension tracés
29. `20260101000029_profile_department.sql` — service ou département du profil (création d’un utilisateur)
30. `20260101000030_admin_trainers.sql` — gestion des formateurs : type de contrat, liste filtrable, indicateurs (note, apprenants, spécialités)
31. `20260101000031_trainer_creation.sql` — création d’un formateur : fiche (expérience, biographie, spécialités, compétences, diplômes) et formations à animer

32. `20260101000032_admin_companies.sql` — gestion des entreprises : statut « en attente », liste filtrable, indicateurs, changement de statut tracé
33. `20260101000033_admin_categories.sql` — gestion des catégories : statut, icône et couleur, visibilité publique limitée aux catégories actives, indicateurs
34. `20260101000034_category_creation.sql` — création d’une catégorie : code, ordre, description détaillée, image de couverture, visibilité plateforme et catalogue
35. `20260101000035_admin_sessions.sql` — gestion des sessions : liste de toutes les sessions, indicateurs, annulation et rétablissement tracés
36. `20260101000036_session_creation.sql` — création d’une session : effectif minimum, options d’inscription, formateurs supplémentaires, image
37. `20260101000037_admin_enrollments.sql` — gestion des inscriptions : liste, filtres, indicateurs
38. `20260101000038_company_creation.sql` — création d’une entreprise : identité légale, contacts, paramètres, logo
39. `20260101000039_enrollment_creation.sql` — création d’une inscription : référence, source, paiement saisi, notes, pièces jointes
40. `20260101000040_admin_learners.sql` — gestion des apprenants : matricule, liste, progression, indicateurs
41. `20260101000041_learner_creation.sql` — création d’un apprenant : informations réservées à l’administration (pièce d’identité, notes)
42. `20260101000042_admin_evaluations.sql` — gestion des évaluations : liste, résultats, indicateurs, publication et archivage
43. `20260101000043_evaluation_creation.sql` — création d’une évaluation et de ses questions : paramètres, pièces jointes, garde de publication
44. `20260101000044_admin_attendance.sql` — gestion des présences : heures d’arrivée et de départ, listes, synthèses, saisie groupée
45. `20260101000045_admin_certifications.sql` — catalogue des certifications : liste, statuts, indicateurs
46. `20260101000046_certification_creation.sql` — création d’une certification : paramètres, modèle, visuel (rattrapage idempotent de la 45)
47. `20260101000047_admin_blog.sql` — blog et contenus publics : table des contenus (reprise des articles actuels), liste, statuts, brouillons
48. `20260101000048_blog_creation.sql` — création d’un contenu du blog : visibilité, langue, mots-clés, SEO, médias joints
49. `20260101000049_admin_payments.sql` — paiements : table, reprise des montants des inscriptions, liste, indicateurs, évolution, confirmation
50. `20260101000050_payment_creation.sql` — création d’un paiement : session, remise, frais, référence de transaction, justificatif
51. `20260101000051_admin_billing.sql` — factures (une par paiement), remboursements, avoirs : listes, indicateurs, statuts
52. `20260101000052_invoice_creation.sql` — création d’une facture : lignes, échéance, conditions, brouillon, pièces jointes
53. `20260101000053_trainer_assessments.sql` — évaluation globale d'un apprenant par le formateur : note finale, résultat, commentaire

### Premier administrateur

Aucun rôle privilégié ne peut être obtenu par l'inscription. Après avoir créé un compte, l'attribuer dans *SQL Editor* :

```sql
insert into public.user_roles (user_id, role_id)
select p.id, r.id from public.profiles p, public.roles r
where p.email = 'vous@exemple.com' and r.code = 'admin';
```

## Données de démonstration

`npm run seed:demo -- --yes` crée 16 formations **fictives** inspirées des maquettes (modules, leçons, sessions à venir), toutes marquées `is_demo = true` ; le site affiche alors la mention « Formations de démonstration ». `npm run seed:demo:remove -- --yes` les supprime. Le script exige `--yes` et ne doit **jamais** être lancé sur une instance de production réelle. Les chiffres clés de l'accueil (apprenants, entreprises) ne sont pas simulés : ils restent masqués tant qu'il n'y a pas de vraies données.

## Images et contenus de l'accueil

Les images de référence sont dans `maquettes/images/` (bannières panoramiques dans `maquettes/images/bannières/`). `npm run images` les optimise (WebP, redimensionnement) vers `app/public/images/` et régénère le logo rogné et l'icône du site (`app/src/app/icon.png`). À relancer quand une image de référence change.

Les chiffres clés de l'accueil sont calculés sur les données réelles (jamais écrits en dur) et masqués s'ils sont trop faibles. Les **témoignages** et les **partenaires** ne s'affichent que s'ils sont renseignés dans `app/src/content/home.ts` (avis authentiques et accord des organisations requis).

## Tests

```bash
npm test          # tests unitaires + intégration RLS (contre le projet Supabase de .env)
npm run build     # build de production
```

Les tests d'intégration contre Supabase créent des comptes jetables `@example.test` et les suppriment à la fin (le nettoyage échoue bruyamment s'il est incomplet). Les règles métier SQL sont aussi testées localement, sans réseau ni Docker, avec une base PostgreSQL embarquée (PGlite, `app/src/test/`) qui rejoue toutes les migrations.

## Architecture (Lot 1)

- `src/app/(public)` site public · `src/app/app|formateur|entreprise|admin` espaces connectés
- `src/proxy.ts` rafraîchit la session et protège les espaces par rôle (la RLS reste la protection réelle)
- `src/lib/<domaine>` logique métier, schémas Zod et actions serveur par domaine
- `src/components/ui` design system · `src/components/app` coque des espaces connectés
- Next.js 16 avec `cacheComponents` : toute donnée dynamique doit être sous `<Suspense>`
