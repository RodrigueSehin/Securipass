import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/feedback";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { profileCompletion } from "@/lib/profile/completion";
import { AVAILABILITY, EDUCATION, EXPERIENCE, GENDERS, LANGUAGES } from "@/lib/profile/schemas";
import { PasswordForm, PersonalForm, PhotoForm, PreferencesForm, ProfessionalForm } from "./profile-forms";

export const metadata = { title: "Mon profil" };

const TABS = [
  { key: "personnelles", label: "Informations personnelles" },
  { key: "professionnelles", label: "Informations professionnelles" },
  { key: "securite", label: "Sécurité" },
  { key: "preferences", label: "Préférences" },
  { key: "documents", label: "Documents" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type Row = {
  full_name: string; email: string; phone: string | null; timezone: string; created_at: string;
  gender: string | null; nationality: string | null; locality: string | null; address: string | null;
  profession: string | null; employer: string | null; experience_band: string | null; education_level: string | null;
  languages: string[]; availability: string | null; training_goal: string | null; photo_path: string | null;
  preferences: Record<string, unknown>; birth_date: string | null;
};

/** Ligne « libellé / valeur » de la fiche (lecture seule). */
function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold text-brand-dark">{value || <span className="font-normal text-muted">Non renseigné</span>}</dd>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?redirect=/app/profil");

  const { data: profile } = await supabase.from("profiles")
    .select("full_name, email, phone, timezone, created_at, gender, nationality, locality, address, profession, employer, experience_band, education_level, languages, availability, training_goal, photo_path, preferences, birth_date")
    .eq("id", user.id).single<Row>();
  if (!profile) return <EmptyState title="Profil introuvable">Reconnectez-vous pour afficher votre profil.</EmptyState>;

  const tab: TabKey = TABS.some((t) => t.key === sp.onglet) ? (sp.onglet as TabKey) : "personnelles";
  const completion = profileCompletion(profile);
  const emailConfirmed = Boolean(user.email_confirmed_at);
  const photoUrl = profile.photo_path
    ? (await supabase.storage.from("profile-photos").createSignedUrl(profile.photo_path, 300)).data?.signedUrl ?? null
    : null;
  const initials = profile.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <>
      <section className="mb-6 flex flex-col gap-5 rounded-2xl border border-line bg-white p-6 shadow-card md:flex-row md:items-center">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-brand-soft">
          {photoUrl
            // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage privé
            ? <img src={photoUrl} alt="Photo de profil" className="h-full w-full object-cover" />
            : <span className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-brand" aria-hidden>{initials}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold text-brand-dark">{profile.full_name || user.email}</h2>
          <p className="text-sm text-muted">Apprenant{profile.profession ? ` · ${profile.profession}` : ""}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {completion.complete && <StatusBadge tone="success">Profil complet</StatusBadge>}
            {emailConfirmed && <StatusBadge tone="success"><Mail className="mr-1 inline h-3 w-3" aria-hidden />E-mail vérifié</StatusBadge>}
            <span className="text-xs text-muted">Membre depuis le {formatDate(profile.created_at)}</span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <nav aria-label="Sections du profil" className="flex gap-1 overflow-x-auto border-b border-line">
            {TABS.map((t) => (
              <Link key={t.key} href={`/app/profil?onglet=${t.key}`} aria-current={t.key === tab ? "page" : undefined}
                className={cn("whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold",
                  t.key === tab ? "border-brand text-brand" : "border-transparent text-muted hover:text-brand-dark")}>
                {t.label}
              </Link>
            ))}
          </nav>


          {tab === "personnelles" && (
            <>
              <section aria-labelledby="modifier-perso" className="space-y-3">
                <h3 id="modifier-perso" className="font-bold text-brand-dark">Modifier mes informations</h3>
                <PersonalForm profile={{ ...profile, gender: profile.gender }} />
              </section>
              <section aria-labelledby="fiche-perso" className="rounded-2xl border border-line bg-white p-6">
                <h3 id="fiche-perso" className="mb-4 font-bold text-brand-dark">Fiche</h3>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Item label="Date de naissance" value={profile.birth_date ? formatDate(profile.birth_date) : null} />
                  <Item label="Genre" value={profile.gender ? GENDERS[profile.gender as keyof typeof GENDERS] : null} />
                  <Item label="Nationalité" value={profile.nationality} />
                  <Item label="Localisation" value={profile.locality} />
                  <Item label="Adresse" value={profile.address} />
                  <Item label="Téléphone" value={profile.phone} />
                </dl>
                <p className="mt-4 text-xs text-muted">La date de naissance est fixée à l’inscription et ne peut être modifiée ici.</p>
              </section>
            </>
          )}

          {tab === "professionnelles" && (
            <>
              <section aria-labelledby="modifier-pro" className="space-y-3">
                <h3 id="modifier-pro" className="font-bold text-brand-dark">Modifier mes informations professionnelles</h3>
                <ProfessionalForm profile={profile} />
              </section>
              <section aria-labelledby="fiche-pro" className="rounded-2xl border border-line bg-white p-6">
                <h3 id="fiche-pro" className="mb-4 font-bold text-brand-dark">Fiche</h3>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Item label="Profession" value={profile.profession} />
                  <Item label="Entreprise" value={profile.employer} />
                  <Item label="Expérience" value={profile.experience_band ? EXPERIENCE[profile.experience_band as keyof typeof EXPERIENCE] : null} />
                  <Item label="Niveau d’études" value={profile.education_level ? EDUCATION[profile.education_level as keyof typeof EDUCATION] : null} />
                  <Item label="Langues" value={profile.languages.map((l) => LANGUAGES[l as keyof typeof LANGUAGES] ?? l).join(", ")} />
                  <Item label="Disponibilité" value={profile.availability ? AVAILABILITY[profile.availability as keyof typeof AVAILABILITY] : null} />
                  <div className="sm:col-span-2"><Item label="Objectif de formation" value={profile.training_goal} /></div>
                </dl>
              </section>
            </>
          )}

          {tab === "securite" && (
            <>
              <section aria-labelledby="mdp" className="space-y-3">
                <h3 id="mdp" className="font-bold text-brand-dark">Changer le mot de passe</h3>
                <PasswordForm />
              </section>
              <section aria-labelledby="photo" className="space-y-3">
                <h3 id="photo" className="font-bold text-brand-dark">Photo de profil</h3>
                <PhotoForm hasPhoto={Boolean(profile.photo_path)} />
              </section>
            </>
          )}

          {tab === "preferences" && (
            <section aria-labelledby="com" className="space-y-3">
              <h3 id="com" className="font-bold text-brand-dark">Communication</h3>
              <PreferencesForm profile={profile} />
              <p className="text-sm text-muted">Fuseau horaire : {profile.timezone}. Modifiable dans « Informations personnelles ».</p>
            </section>
          )}

          {tab === "documents" && (
            <EmptyState title="Documents d’identité indisponibles pour le moment">
              La vérification des pièces d’identité n’est pas encore ouverte. Vous pourrez bientôt déposer vos documents ici.
            </EmptyState>
          )}
        </div>

        <aside className="space-y-6">
          <section aria-labelledby="completion" className="rounded-2xl border border-line bg-white p-5">
            <h2 id="completion" className="mb-3 font-bold text-brand-dark">Complétion du profil</h2>
            <p className="text-3xl font-extrabold text-brand-dark">{completion.percent} %</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion.percent} aria-label="Complétion du profil">
              <div className="h-full rounded-full bg-brand" style={{ width: `${completion.percent}%` }} />
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {completion.sections.map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-brand-dark">
                  {s.done ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> : <Circle className="h-4 w-4 text-muted" aria-hidden />}
                  {s.label}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="rapide" className="rounded-2xl border border-line bg-white p-5">
            <h2 id="rapide" className="mb-3 font-bold text-brand-dark">Actions rapides</h2>
            <div className="space-y-2 text-sm">
              <Link href="/app/profil?onglet=securite" className="block rounded-lg border border-line px-3 py-2 font-semibold text-brand-dark hover:border-brand">Modifier le mot de passe</Link>
              <Link href="/app/profil?onglet=preferences" className="block rounded-lg border border-line px-3 py-2 font-semibold text-brand-dark hover:border-brand">Préférences de communication</Link>
              <Link href="/app/security-pass" className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 font-semibold text-brand-dark hover:border-brand">
                <ShieldCheck className="h-4 w-4 text-brand" aria-hidden />Mon Security Pass
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export default function ProfilePage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  return (
    <>
      <PageHeader title="Mon profil" description="Gérez vos informations personnelles, professionnelles et vos préférences." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
