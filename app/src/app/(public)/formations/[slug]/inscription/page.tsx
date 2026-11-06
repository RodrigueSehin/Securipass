import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHero, Section } from "@/components/public/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { createClient } from "@/lib/supabase/server";
import { getPublicCourse } from "@/lib/courses/queries";
import { formatDuration } from "@/lib/utils";
import { EnrollForm } from "./enroll-form";

export const metadata: Metadata = { title: "Inscription à une formation" };

type Params = Promise<{ slug: string }>;

async function EnrollContent({ params }: { params: Params }) {
  const { slug } = await params;
  const course = await getPublicCourse(slug);
  if (!course) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const here = `/formations/${slug}/inscription`;

  if (course.price_amount > 0) {
    return (
      <div className="max-w-xl space-y-4">
        <Alert tone="info">L’inscription en ligne aux formations payantes ouvrira avec le paiement sécurisé.</Alert>
        <ButtonLink href="/contact" variant="outline">Nous contacter pour réserver</ButtonLink>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-xl space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
        <h2 className="text-lg font-bold text-brand-dark">Connectez-vous pour vous inscrire</h2>
        <p className="text-sm text-muted">Un compte vous permet de suivre vos formations, vos évaluations et vos certificats.</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/connexion?redirect=${encodeURIComponent(here)}`}>Se connecter</ButtonLink>
          <ButtonLink href={`/inscription?redirect=${encodeURIComponent(here)}`} variant="outline">Créer un compte</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
        <EnrollForm courseId={course.id} sessions={course.sessions} cancellationPolicy={course.cancellation_policy} mode={course.enrollment_mode ?? "free"} />
      </div>
      <aside className="rounded-2xl border border-line bg-surface p-5 text-sm lg:self-start">
        <p className="text-xs font-semibold uppercase text-muted">Récapitulatif</p>
        <p className="mt-1 font-bold text-brand-dark">{course.title}</p>
        <p className="mt-1 text-muted">{formatDuration(course.duration_minutes)}</p>
        <p className="mt-3 font-bold text-brand-dark">Gratuit</p>
        <Link href={`/formations/${slug}`} className="mt-3 inline-block text-xs text-brand underline">Revoir la fiche</Link>
      </aside>
    </div>
  );
}

export default function EnrollPage({ params }: { params: Params }) {
  return (
    <>
      <PageHero eyebrow="Inscription" title="Finalisez votre inscription" />
      <Section>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-surface" aria-hidden />}>
          <EnrollContent params={params} />
        </Suspense>
      </Section>
    </>
  );
}
