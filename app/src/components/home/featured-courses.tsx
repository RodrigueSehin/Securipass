import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Flame, GraduationCap, HeartPulse, Shield } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { DemoNotice } from "@/components/ui/demo-notice";
import { categoryUi } from "@/content/categories";
import { summarize } from "@/lib/courses/detail";
import { publicImage } from "@/lib/images";
import { getFeaturedCourses, type CourseCard } from "@/lib/courses/queries";
import { MODES } from "@/lib/courses/labels";
import { formatDuration, formatFcfa } from "@/lib/utils";
import { SectionTitle } from "./section-title";

const CATEGORY_ICON: Record<string, typeof Shield> = {
  "securite-privee": Shield, secourisme: HeartPulse, "securite-incendie": Flame,
};

function Cover({ c }: { c: CourseCard }) {
  // Couverture propre, sinon photo de la catégorie, sinon illustration.
  const ui = categoryUi(c.category?.slug, c.category?.name);
  const cover = c.cover_url ?? (ui.image ? publicImage(`home/${ui.image}`) : null);
  if (cover) {
    return <Image src={cover} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" unoptimized={cover.startsWith("http")} />;
  }
  const Icon = (c.category && CATEGORY_ICON[c.category.slug]) || GraduationCap;
  return (
    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#092a66,#0639d9)]" aria-hidden>
      <Icon className="h-14 w-14 text-white/80" strokeWidth={1.4} />
    </div>
  );
}

function CourseTile({ c }: { c: CourseCard }) {
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="relative h-40"><Cover c={c} /></div>
      <div className="flex flex-1 flex-col p-5">
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Clock className="h-3.5 w-3.5" aria-hidden />{formatDuration(c.duration_minutes)} · {MODES[c.delivery_mode]}
        </p>
        <h3 className="mt-2 text-lg font-extrabold leading-snug text-brand-dark">{c.title}</h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted">{summarize(c.description, 95)}</p>
        <p className="mt-4 text-xl font-extrabold text-brand-dark">{c.price_amount === 0 ? "Gratuit" : formatFcfa(c.price_amount)}</p>
        <ButtonLink href={`/formations/${c.slug}`} variant="cta" className="mt-3 w-full">
          Voir la formation <ArrowRight className="h-4 w-4" aria-hidden />
        </ButtonLink>
      </div>
    </li>
  );
}

export async function FeaturedCourses() {
  const courses = await getFeaturedCourses(4);
  return (
    <section className="mx-auto max-w-7xl px-4 pb-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle eyebrow="Nos formations à la une" align="left">Les formations à ne pas manquer</SectionTitle>
        <Link href="/formations" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
          Voir tout le catalogue <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      {courses.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-dashed border-line bg-white p-10 text-center">
          <p className="font-semibold text-brand-dark">Les premières formations seront publiées prochainement.</p>
          <p className="mt-1 text-sm text-muted">Vous êtes formateur ? Proposez votre première formation.</p>
          <ButtonLink href="/formateurs" variant="outline" className="mt-4">Devenir formateur</ButtonLink>
        </div>
      ) : (
        <>
        {courses.some((c) => c.is_demo) && <div className="mt-5"><DemoNotice /></div>}
        <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((c) => <CourseTile key={c.id} c={c} />)}
        </ul>
        </>
      )}
    </section>
  );
}

export function FeaturedCoursesFallback() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-14" aria-hidden>
      <div className="h-16 w-80 animate-pulse rounded bg-surface" />
      <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-80 animate-pulse rounded-2xl bg-surface" />)}
      </div>
    </section>
  );
}
