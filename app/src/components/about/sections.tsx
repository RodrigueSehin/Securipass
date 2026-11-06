import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, BarChart3, Building2, Check, Eye, Flame, Gem, GraduationCap, HeartPulse, Medal, Monitor, QrCode, Settings,
  Shield, ShieldCheck, Target, UsersRound,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ABOUT_COMMITMENTS, ABOUT_MISSION, ABOUT_STORY, ABOUT_VALUES, ABOUT_VISION, ABOUT_WHY, MILESTONES, TEAM } from "@/content/about";
import { HOME_CATEGORIES } from "@/content/home";
import { buildStatItems } from "@/lib/stats-items";
import type { PublicStats } from "@/lib/stats-types";
import { publicImage } from "@/lib/images";
import { cn } from "@/lib/utils";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

function Heading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{children}</h2>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </div>
  );
}

const STAT_UI = {
  learners: { Icon: UsersRound, tone: "bg-[#1479ff]" },
  courses: { Icon: GraduationCap, tone: "bg-success" },
  companies: { Icon: Building2, tone: "bg-cta" },
} as const;

/** Notre histoire : récit à gauche, chiffres réels à droite (colonne masquée s'il y a trop peu de données). */
export function Story({ stats }: { stats: PublicStats }) {
  const photo = publicImage("about/histoire");
  const items = buildStatItems(stats);
  return (
    <section className={cn("grid gap-6 lg:items-start", items.length ? "lg:grid-cols-[1fr_1.25fr_15rem]" : "lg:grid-cols-[1fr_1.5fr]")} aria-labelledby="story-title">
      {photo && (
        <div className="relative h-64 overflow-hidden rounded-2xl shadow-card lg:h-full lg:min-h-[14rem]">
          <Image src={photo} alt="Un conseiller SECURIPASS reçoit une visiteuse pour présenter les formations" fill sizes="(min-width: 1024px) 28vw, 100vw" className="object-cover" />
        </div>
      )}
      <div>
        <h2 id="story-title" className="text-2xl font-extrabold text-brand-dark md:text-3xl">Notre histoire</h2>
        <p className="mt-1 text-lg text-muted">Une réponse concrète aux enjeux de sécurité</p>
        <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-muted">
          {ABOUT_STORY.map((p) => <p key={p}>{p}</p>)}
        </div>
      </div>
      {items.length > 0 && (
        <ul className="rounded-2xl border border-line bg-white p-4 shadow-card">
          {items.map(({ key, value, label }, i) => {
            const { Icon, tone } = STAT_UI[key];
            return (
              <li key={key} className={cn("flex items-center gap-3 py-3", i > 0 && "border-t border-line")}>
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white", tone)}><Icon className="h-5 w-5" aria-hidden /></span>
                <span><span className="block text-2xl font-extrabold leading-none text-brand-dark">{fmt(value)}</span><span className="text-sm text-muted">{label}</span></span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function Pillars() {
  return (
    <section className="grid gap-5 lg:grid-cols-3" aria-label="Mission, vision et valeurs">
      <article className="flex gap-4 rounded-2xl border border-line bg-white p-6 shadow-card">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cta text-white"><Target className="h-7 w-7" aria-hidden /></span>
        <div><h2 className="text-lg font-extrabold text-brand-dark">Notre mission</h2><p className="mt-2 text-sm leading-relaxed text-muted">{ABOUT_MISSION}</p></div>
      </article>
      <article className="flex gap-4 rounded-2xl border border-line bg-white p-6 shadow-card">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1479ff] text-white"><Eye className="h-7 w-7" aria-hidden /></span>
        <div><h2 className="text-lg font-extrabold text-brand-dark">Notre vision</h2><p className="mt-2 text-sm leading-relaxed text-muted">{ABOUT_VISION}</p></div>
      </article>
      <article className="flex gap-4 rounded-2xl border border-line bg-white p-6 shadow-card">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-success text-white"><Gem className="h-7 w-7" aria-hidden /></span>
        <div>
          <h2 className="text-lg font-extrabold text-brand-dark">Nos valeurs</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted">
            {ABOUT_VALUES.map((v) => (
              <li key={v} className="flex items-center gap-2"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-white"><Check className="h-3 w-3" strokeWidth={3} aria-hidden /></span>{v}</li>
            ))}
          </ul>
        </div>
      </article>
    </section>
  );
}

const DOMAIN_UI = {
  blue: { head: "from-brand-dark/95 via-brand-dark/70", Icon: Shield, check: "bg-brand-dark", circle: "text-brand-dark" },
  green: { head: "from-[#0b7a57]/95 via-[#0b7a57]/70", Icon: HeartPulse, check: "bg-success", circle: "text-success" },
  red: { head: "from-[#a3201f]/95 via-[#a3201f]/70", Icon: Flame, check: "bg-danger", circle: "text-danger" },
} as const;

export function Domains() {
  return (
    <section aria-labelledby="domains-title">
      <div id="domains-title"><Heading sub="Une offre complète pour répondre aux besoins des particuliers et des entreprises.">Nos domaines d’expertise</Heading></div>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {HOME_CATEGORIES.map((c) => {
          const ui = DOMAIN_UI[c.tone];
          const photo = publicImage(`home/${c.image}`);
          return (
            <article key={c.slug} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              <div className="relative flex h-36 items-end bg-brand-dark p-4">
                {photo && <Image src={photo} alt="" fill sizes="(min-width: 768px) 30vw, 100vw" className="object-cover object-[60%_25%]" aria-hidden />}
                <div className={cn("absolute inset-0 bg-gradient-to-r to-transparent", ui.head)} aria-hidden />
                <div className="relative flex items-center gap-3">
                  <span className={cn("flex h-12 w-12 items-center justify-center rounded-full bg-white", ui.circle)}><ui.Icon className="h-6 w-6" aria-hidden /></span>
                  <h3 className="text-xl font-extrabold text-white">{c.title}</h3>
                </div>
              </div>
              <ul className="space-y-2 p-5 text-sm text-muted">
                {c.items.map((i) => (
                  <li key={i} className="flex items-center gap-2.5"><span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white", ui.check)}><Check className="h-3 w-3" strokeWidth={3} aria-hidden /></span>{i}</li>
                ))}
              </ul>
              <div className="px-5 pb-5"><Link href={`/formations?categorie=${c.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Voir les formations <ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const WHY_ICONS = { medal: Medal, monitor: Monitor, users: UsersRound, qr: QrCode, chart: BarChart3, building: Building2 } as const;
const COMMIT_ICONS = { shield: ShieldCheck, users: UsersRound, cog: Settings, chart: BarChart3 } as const;

/** « Pourquoi choisir SECURIPASS ? » et « Notre engagement » côte à côte, comme sur la maquette. */
export function WhyAndCommitment() {
  const photo = publicImage("about/engagement");
  return (
    <section className="grid gap-8 lg:grid-cols-2" aria-label="Pourquoi nous choisir et notre engagement">
      <div>
        <Heading>Pourquoi choisir SECURIPASS ?</Heading>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {ABOUT_WHY.map((w) => {
            const Icon = WHY_ICONS[w.icon];
            return (
              <li key={w.title} className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 shadow-card">
                <Icon className={cn("h-9 w-9 shrink-0", w.tone)} strokeWidth={1.5} aria-hidden />
                <span><span className="block font-bold text-brand-dark">{w.title}</span><span className="text-sm text-muted">{w.text}</span></span>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <Heading>Notre engagement</Heading>
        <div className="mt-5 grid overflow-hidden rounded-2xl bg-brand-dark shadow-card sm:grid-cols-[1fr_1.1fr]">
          {photo && (
            <div className="relative hidden min-h-[16rem] sm:block">
              <Image src={photo} alt="Une équipe en formation aux gestes de premiers secours" fill sizes="20vw" className="object-cover object-[35%_50%]" />
            </div>
          )}
          <ul className={cn("space-y-4 p-5 text-sm text-white", !photo && "sm:col-span-2")}>
            {ABOUT_COMMITMENTS.map((c) => {
              const Icon = COMMIT_ICONS[c.icon];
              return <li key={c.text} className="flex items-start gap-3"><Icon className="h-6 w-6 shrink-0" aria-hidden />{c.text}</li>;
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Parcours : uniquement des faits réels et datés renseignés dans content/about.ts. Masqué tant que la liste est vide. */
export function Milestones() {
  if (MILESTONES.length === 0) return null;
  return (
    <section aria-labelledby="milestones-title">
      <div id="milestones-title"><Heading sub="Les étapes clés de notre développement.">Notre parcours</Heading></div>
      <ol className="mt-6 grid gap-5 md:grid-cols-5">
        {MILESTONES.map((m) => (
          <li key={m.year} className="rounded-xl border border-line bg-white p-4 shadow-card">
            <p className="text-lg font-extrabold text-cta">{m.year}</p>
            <p className="mt-1 font-bold text-brand-dark">{m.title}</p>
            <p className="mt-1 text-sm text-muted">{m.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Équipe : renseignée dans content/about.ts avec l'accord des personnes. Masquée tant que la liste est vide. */
export function Team() {
  if (TEAM.length === 0) return null;
  return (
    <section aria-labelledby="team-title">
      <div id="team-title"><Heading>Notre équipe</Heading></div>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TEAM.map((m) => (
          <li key={m.name} className="rounded-xl border border-line bg-white p-4 text-center shadow-card">
            {m.photo && <Image src={m.photo} alt="" width={96} height={96} className="mx-auto h-24 w-24 rounded-full object-cover" />}
            <p className="mt-3 font-bold text-brand-dark">{m.name}</p>
            <p className="text-sm text-muted">{m.role}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AboutCta() {
  return (
    <section className="rounded-2xl bg-brand-soft p-8 text-center" aria-label="Passer à l’action">
      <h2 className="text-2xl font-extrabold text-brand-dark">Rejoignez SECURIPASS</h2>
      <p className="mx-auto mt-2 max-w-xl text-muted">Découvrez nos formations ou parlons de vos besoins de formation et de certification.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/formations" variant="cta">Découvrir les formations <ArrowRight className="h-4 w-4" aria-hidden /></ButtonLink>
        <ButtonLink href="/contact" variant="outline">Nous contacter</ButtonLink>
      </div>
    </section>
  );
}
