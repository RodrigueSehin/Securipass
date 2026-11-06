import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, BarChart3, CalendarClock, Check, Clock, FileText, GraduationCap, Languages, Laptop, Layers, MapPin, ShieldCheck, Target, UsersRound } from "lucide-react";
import { CatalogueCard } from "@/components/catalogue/catalogue-card";
import { SessionList } from "@/components/courses/session-list";
import { DetailHero } from "@/components/course-detail/detail-hero";
import { Programme } from "@/components/course-detail/programme";
import { SectionTabs, type TabId } from "@/components/course-detail/section-tabs";
import { MobileCta } from "@/components/course-detail/mobile-cta";
import { DetailSidebar } from "@/components/course-detail/sidebar";
import { categoryUi } from "@/content/categories";
import { MODE_DETAIL, formatValidity } from "@/lib/courses/detail";
import { LEVELS, MODES, type Mode } from "@/lib/courses/labels";
import { DemoNotice } from "@/components/ui/demo-notice";
import { getIsDemo, getPublicCourse, getSimilarCourses } from "@/lib/courses/queries";
import { publicImage } from "@/lib/images";
import { RichText } from "@/components/ui/rich-text";
import { stripRichText } from "@/lib/rich-text";
import { formatDuration } from "@/lib/utils";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getPublicCourse(slug);
  return c ? { title: c.title, description: stripRichText(c.description).slice(0, 160) } : { title: "Formation introuvable" };
}

const TILE_ICONS = [ShieldCheck, UsersRound, Target, FileText];
const TILE_TONES = ["text-brand", "text-cta", "text-success", "text-danger"];
const MODE_ICONS: Record<Mode, typeof Laptop> = { online: Laptop, onsite: MapPin, hybrid: Layers };

function Heading({ icon: Icon, children }: { icon?: typeof Target; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-2xl font-extrabold text-brand-dark">
      {Icon && <Icon className="h-6 w-6 text-cta" aria-hidden />}{children}
    </h2>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted">{children}</div>;
}

async function CourseDetail({ params }: { params: Params }) {
  const { slug } = await params;
  const c = await getPublicCourse(slug);
  if (!c) notFound();

  const ui = categoryUi(c.category?.slug, c.category?.name);
  const image = c.cover_url ?? (ui.image ? publicImage(`home/${ui.image}`) : null);
  const hasCertificate = Boolean(c.certificate_conditions || c.certificate_validity_months);
  const hasPrereq = Boolean(c.prerequisites || c.prerequisite_course);
  const [similar, isDemo] = await Promise.all([getSimilarCourses(c.category?.slug, c.id), getIsDemo(c.slug)]);
  const ModeIcon = MODE_ICONS[c.delivery_mode];

  const tabs: { id: TabId; label: string }[] = [
    { id: "presentation", label: "Présentation" },
    ...(c.modules.length ? [{ id: "programme" as const, label: "Programme" }] : []),
    ...(c.objectives.length ? [{ id: "objectifs" as const, label: "Objectifs" }] : []),
    ...(c.sessions.length ? [{ id: "sessions" as const, label: "Sessions" }] : []),
    ...(hasPrereq ? [{ id: "prerequis" as const, label: "Prérequis" }] : []),
    ...(hasCertificate || c.evaluation_modalities ? [{ id: "certification" as const, label: "Certification" }] : []),
  ];

  const infoCards = [
    { Icon: Clock, tone: "bg-cta", label: "Durée", value: formatDuration(c.duration_minutes), sub: "Durée totale" },
    { Icon: BarChart3, tone: "bg-[#1479ff]", label: "Niveau", value: LEVELS[c.level], sub: c.prerequisites ? "Voir les prérequis" : "Aucun prérequis particulier" },
    { Icon: ModeIcon, tone: "bg-[#7c4dff]", label: "Mode", value: MODES[c.delivery_mode], sub: MODE_DETAIL[c.delivery_mode] },
    { Icon: Languages, tone: "bg-danger", label: "Langue", value: c.language === "fr" ? "Français" : c.language, sub: "" },
  ];

  return (
    <div className="pb-20 lg:pb-0">
      <DetailHero course={c} image={image} hasCertificate={hasCertificate} />

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[1fr_22rem]">
        <article className="min-w-0 space-y-10">
          {isDemo && <DemoNotice>Formation de démonstration : contenu, prix et sessions fictifs, présentés à titre d’exemple.</DemoNotice>}
          <SectionTabs items={tabs} />

          <section id="presentation" className="scroll-mt-36">
            <Heading>Description de la formation</Heading>
            {c.description && <RichText text={c.description} className="mt-3" />}
            {c.competencies.length > 0 && (
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Compétences visées">
                {c.competencies.slice(0, 8).map((t, i) => {
                  const Icon = TILE_ICONS[i % TILE_ICONS.length];
                  return (
                    <li key={t} className="flex flex-col items-center rounded-xl border border-line bg-white p-4 text-center shadow-card">
                      <Icon className={`h-7 w-7 ${TILE_TONES[i % TILE_TONES.length]}`} aria-hidden />
                      <span className="mt-2 text-sm font-semibold leading-snug text-brand-dark">{t}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {c.target_audience && (
              <div className="mt-5 rounded-xl bg-surface p-4 text-sm">
                <p className="font-bold text-brand-dark">Public cible</p>
                <p className="mt-1 whitespace-pre-line text-muted">{c.target_audience}</p>
              </div>
            )}
          </section>

          {c.objectives.length > 0 && (
            <section id="objectifs" className="scroll-mt-36">
              <Heading>Ce que vous allez apprendre</Heading>
              <ul className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
                {c.objectives.map((o) => (
                  <li key={o} className="flex items-start gap-3 text-[15px] text-muted">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-dark text-white"><Check className="h-3 w-3" strokeWidth={3} aria-hidden /></span>{o}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="En bref">
            {infoCards.map(({ Icon, tone, label, value, sub }) => (
              <li key={label} className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 shadow-card">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white ${tone}`}><Icon className="h-5 w-5" aria-hidden /></span>
                <span className="leading-tight">
                  <span className="block text-xs text-muted">{label}</span>
                  <span className="block font-bold text-brand-dark">{value}</span>
                  {sub && <span className="block text-xs text-muted">{sub}</span>}
                </span>
              </li>
            ))}
          </ul>

          <Programme modules={c.modules} />

          {c.sessions.length > 0 && (
            <section id="sessions" className="scroll-mt-36">
              <Heading icon={CalendarClock}>Sessions disponibles</Heading>
              <div className="mt-4"><SessionList sessions={c.sessions} /></div>
            </section>
          )}

          {hasPrereq && (
            <section id="prerequis" className="scroll-mt-36">
              <Heading>Prérequis</Heading>
              {c.prerequisites && <Prose>{c.prerequisites}</Prose>}
              {c.prerequisite_course && (
                <p className="mt-3 text-sm text-muted">Formation à avoir terminée : <Link href={`/formations/${c.prerequisite_course.slug}`} className="font-semibold text-brand hover:underline">{c.prerequisite_course.title}</Link></p>
              )}
            </section>
          )}

          {(hasCertificate || c.evaluation_modalities) && (
            <section id="certification" className="scroll-mt-36">
              <Heading>Évaluation et certification</Heading>
              {c.evaluation_modalities && (<><h3 className="mt-4 font-bold text-brand-dark">Modalités d’évaluation</h3><Prose>{c.evaluation_modalities}</Prose></>)}
              {c.certificate_conditions && (<><h3 className="mt-4 font-bold text-brand-dark">Conditions d’obtention du certificat</h3><Prose>{c.certificate_conditions}</Prose></>)}
              {c.certificate_validity_months && <p className="mt-3 text-sm text-muted">Durée de validité : {formatValidity(c.certificate_validity_months)}.</p>}
            </section>
          )}

          {(c.cancellation_policy || c.accessibility) && (
            <section className="grid gap-6 md:grid-cols-2">
              {c.cancellation_policy && <div><h2 className="text-lg font-extrabold text-brand-dark">Conditions d’annulation</h2><Prose>{c.cancellation_policy}</Prose></div>}
              {c.accessibility && <div><h2 className="text-lg font-extrabold text-brand-dark">Accessibilité</h2><Prose>{c.accessibility}</Prose></div>}
            </section>
          )}
        </article>

        <DetailSidebar course={c} image={image} hasCertificate={hasCertificate} />
      </div>

      {similar.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-14" aria-labelledby="similar-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="similar-title" className="flex items-center gap-2.5 text-2xl font-extrabold text-brand-dark"><GraduationCap className="h-6 w-6 text-brand" aria-hidden />Formations similaires</h2>
            <Link href="/formations" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Voir tout le catalogue <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {similar.map((s) => <CatalogueCard key={s.id} course={s} />)}
          </ul>
        </section>
      )}
      <MobileCta course={c} />
    </div>
  );
}

export default function CoursePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-7xl animate-pulse px-4 py-10" aria-hidden />}>
      <CourseDetail params={params} />
    </Suspense>
  );
}
