import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, BadgeCheck, Briefcase, Check, ChevronRight, ClipboardCheck, FileBadge, FilePenLine, Flame, Info, Lock, PlusCircle, QrCode, ScanSearch, Search, ShieldCheck, UsersRound, BookOpenCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CERT_ENTERPRISE_POINTS, CERT_EXAMPLES, CERT_HERO_POINTS, CERT_STEPS } from "@/content/certification";
import { HOME_CATEGORIES } from "@/content/home";
import { publicImage } from "@/lib/images";
import { cn } from "@/lib/utils";
import { CertificateCard } from "./specimen";

const HERO_ICONS = { shield: ShieldCheck, users: UsersRound, badge: BadgeCheck, lock: Lock } as const;

export function CertificationHero() {
  const photo = publicImage("home/agent-securite");
  return (
    <section className="relative overflow-hidden bg-brand-dark text-white">
      {photo && (
        <>
          <Image src={photo} alt="" width={900} height={600} priority sizes="760px" aria-hidden
            className="absolute right-[6%] top-0 hidden h-full w-[760px] max-w-none object-cover object-[50%_20%] lg:block [mask-image:linear-gradient(90deg,transparent_0,#000_30%,#000_85%,transparent_100%)]" />
          <div className="absolute inset-x-0 bottom-0 hidden h-28 bg-gradient-to-t from-brand-dark via-brand-dark/70 to-transparent lg:block" aria-hidden />
        </>
      )}
      <div className="relative mx-auto flex min-h-[285px] max-w-[1384px] flex-col justify-between gap-6 px-4 py-8 lg:py-6 lg:pl-[5.8vw]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-sm text-white/85">
              <Link href="/" className="hover:text-white">Accueil</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <span aria-current="page" className="text-white">Certifications</span>
            </nav>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight lg:text-5xl">Nos <span className="text-cta">certifications</span></h1>
            <p className="mt-3 max-w-[660px] text-lg leading-snug text-white/90 lg:text-xl">Des certifications traçables et vérifiables pour valoriser vos compétences en sécurité, secourisme et sécurité incendie.</p>
          </div>
          <div className="flex max-w-[300px] items-center gap-3 rounded-xl bg-white p-4 text-brand-dark shadow-2xl lg:mt-3">
            <Award className="h-10 w-10 shrink-0 text-cta" strokeWidth={1.5} aria-hidden />
            <p className="text-sm leading-snug">Valorisez vos compétences avec un certificat SECURIPASS traçable et vérifiable.</p>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-8">
          {CERT_HERO_POINTS.map((p) => {
            const Icon = HERO_ICONS[p.icon];
            return (
              <li key={p.label} className="flex items-center gap-3">
                <Icon className="h-9 w-9 shrink-0" strokeWidth={1.5} aria-hidden />
                <span className="text-sm leading-tight text-white/90"><strong className="block font-semibold text-white">{p.label}</strong>{p.sub}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** Formulaire de vérification publique, qui interroge le service réel (page /verifier). */
export function VerifyIntro() {
  return (
    <section aria-labelledby="verify-title" className="grid items-center gap-8 lg:grid-cols-[1fr_1.05fr]">
      <div>
        <h2 id="verify-title" className="text-3xl font-extrabold text-brand-dark">Vérifiez un certificat</h2>
        <p className="mt-1 text-lg leading-snug text-muted">Authentifiez un certificat SECURIPASS en quelques secondes grâce à son numéro ou en scannant le QR Code.</p>
        <div className="mt-5 rounded-xl bg-surface">
          <div className="grid grid-cols-2 text-sm font-semibold" aria-hidden>
            <span className="flex items-center justify-center gap-2 rounded-tl-xl bg-brand-dark py-3.5 text-white"><FilePenLine className="h-4 w-4" />Par numéro de certificat</span>
            <span className="flex items-center justify-center gap-2 py-3.5 text-brand-dark"><QrCode className="h-4 w-4" />Par QR Code</span>
          </div>
          <form action="/verifier" method="get" className="flex flex-col gap-3 p-4 sm:flex-row">
            <label htmlFor="cert-number" className="sr-only">Numéro du certificat ou code de vérification</label>
            <input id="cert-number" name="code" required minLength={6} maxLength={80} placeholder="Ex : SP-2026-000184" className="min-w-0 flex-1 rounded-lg border border-line bg-white px-4 py-3.5 text-sm" />
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-cta px-8 py-3.5 font-semibold text-white hover:bg-cta-dark"><Search className="h-5 w-5" aria-hidden />Vérifier</button>
          </form>
          <p id="verify-status" className="flex items-start gap-2 px-4 pb-4 text-sm text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            Le résultat indique le statut réel du certificat : valide, expiré, suspendu ou révoqué.
          </p>
        </div>
      </div>
      <CertificateCard tone="blue" course="Intitulé de la formation" />
    </section>
  );
}

const TYPE_TONES = {
  blue: { badge: "bg-brand-dark", check: "text-brand", btn: "bg-brand-dark hover:bg-brand" },
  green: { badge: "bg-success", check: "text-success", btn: "bg-success hover:opacity-90" },
  red: { badge: "bg-danger", check: "text-danger", btn: "bg-danger hover:opacity-90" },
} as const;
const TYPE_ICONS = { shield: ShieldCheck, cross: PlusCircle, flame: Flame } as const;

export function CertificationTypes() {
  return (
    <section aria-labelledby="types-title">
      <h2 id="types-title" className="text-3xl font-extrabold text-brand-dark">Nos domaines de certification</h2>
      <p className="mt-1 text-lg text-muted">Des formations adaptées aux besoins des particuliers, des entreprises et des professionnels.</p>
      <ul className="mt-5 grid gap-5 lg:grid-cols-3">
        {HOME_CATEGORIES.map((c) => {
          const t = TYPE_TONES[c.tone];
          const Icon = TYPE_ICONS[c.icon];
          const photo = publicImage(`home/${c.image}`);
          return (
            <li key={c.slug} className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
              <div className="relative h-[130px] bg-brand-soft">
                {photo && <Image src={photo} alt="" fill sizes="(min-width: 1024px) 420px, 100vw" className="object-cover" aria-hidden />}
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/70 to-transparent" aria-hidden />
                <span className={cn("absolute left-6 top-4 flex h-[72px] w-[72px] items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white", t.badge)}><Icon className="h-9 w-9" aria-hidden /></span>
              </div>
              <div className="p-5">
                <h3 className="text-xl font-extrabold text-brand-dark">{c.title}</h3>
                <ul className="mt-3 space-y-1.5 text-sm text-brand-dark">
                  {c.items.map((i) => <li key={i} className="flex items-center gap-2"><Check className={cn("h-4 w-4 shrink-0", t.check)} strokeWidth={3} aria-hidden />{i}</li>)}
                </ul>
                <Link href={`/formations?categorie=${c.slug}`} className={cn("mt-5 flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-white transition-colors", t.btn)}>
                  Voir les formations <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const STEP_ICONS = { book: BookOpenCheck, quiz: ClipboardCheck, check: FileBadge, cert: Award, verify: ScanSearch } as const;

export function CertificationProcess() {
  return (
    <section aria-labelledby="process-title">
      <h2 id="process-title" className="text-3xl font-extrabold text-brand-dark">Le processus de certification</h2>
      <p className="mt-1 text-lg text-muted">Un processus rigoureux pour garantir la qualité et la crédibilité de nos certificats.</p>
      <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
        {CERT_STEPS.map((s, i) => {
          const Icon = STEP_ICONS[s.icon];
          return (
            <li key={s.title}>
              <div className="flex items-center gap-3">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-white", s.tone)}>{i + 1}</span>
                <Icon className="h-9 w-9 text-brand" strokeWidth={1.5} aria-hidden />
                {i < CERT_STEPS.length - 1 && <span className="hidden h-px flex-1 bg-line lg:block" aria-hidden />}
              </div>
              <h3 className="mt-3 font-bold text-brand-dark">{s.title}</h3>
              <p className="text-sm text-muted">{s.text}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function CertificateExamples() {
  return (
    <section aria-labelledby="examples-title" className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <h2 id="examples-title" className="text-3xl font-extrabold text-brand-dark">Exemples de certificats</h2>
        <p className="mt-1 text-lg text-muted">Découvrez à quoi ressemblent les certificats délivrés par SECURIPASS (spécimens).</p>
        <ul className="mt-5 grid gap-5 sm:grid-cols-3">
          {CERT_EXAMPLES.map((e) => (
            <li key={e.label}>
              <CertificateCard tone={e.tone} course={e.course} size="sm" />
              <p className="mt-2 text-center text-sm font-bold text-brand-dark">{e.label}</p>
            </li>
          ))}
        </ul>
      </div>
      <aside className="self-start rounded-xl bg-brand-soft p-5" aria-labelledby="ent-title">
        <h3 id="ent-title" className="flex items-center gap-3 font-extrabold text-brand-dark"><Briefcase className="h-8 w-8 text-brand-dark" strokeWidth={1.75} aria-hidden />Pour les entreprises</h3>
        <p className="mt-1 text-sm text-muted">Formez et certifiez vos équipes avec un suivi centralisé.</p>
        <ul className="mt-3 space-y-2 text-sm text-brand-dark">
          {CERT_ENTERPRISE_POINTS.map((p) => <li key={p} className="flex items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-dark text-white"><Check className="h-3 w-3" strokeWidth={3} aria-hidden /></span>{p}</li>)}
        </ul>
        <ButtonLink href="/entreprises" variant="cta" className="mt-4 w-full py-3">Demander une offre entreprise <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>
      </aside>
    </section>
  );
}

