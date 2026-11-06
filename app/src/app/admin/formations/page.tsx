import { Suspense } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { CourseStatusBadge } from "@/components/courses/course-status";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_COURSE_LIST_SELECT } from "@/lib/selects";
import { COURSE_STATUS, type CourseStatus } from "@/lib/courses/labels";
import { formatDate } from "@/lib/format";
import { formatFcfa } from "@/lib/utils";

export const metadata = { title: "Formations — validation" };

type Row = {
  id: string; title: string; status: CourseStatus; price_amount: number; updated_at: string;
  category: { name: string } | null; instructor: { full_name: string } | null;
};

async function Queue({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { statut } = await searchParams;
  const status = statut && Object.hasOwn(COURSE_STATUS, statut) ? statut : "in_review";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(ADMIN_COURSE_LIST_SELECT)
    .eq("status", status)
    .order("updated_at", { ascending: true })
    .returns<Row[]>();

  return (
    <>
      <nav aria-label="Filtrer par statut" className="mb-4 flex flex-wrap gap-2">
        {Object.entries(COURSE_STATUS).map(([k, s]) => (
          <Link key={k} href={`/admin/formations?statut=${k}`} aria-current={k === status ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${k === status ? "border-brand bg-brand text-white" : "border-line bg-white text-brand-dark hover:bg-brand-soft"}`}>{s.label}</Link>
        ))}
      </nav>
      {error ? <Alert>Impossible de charger les formations.</Alert> : !data?.length ? (
        <EmptyState title="Aucune formation dans cet état" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr><th className="px-4 py-3">Formation</th><th className="px-4 py-3">Formateur</th><th className="px-4 py-3">Catégorie</th><th className="px-4 py-3">Prix</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Modifiée le</th></tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium"><Link href={`/admin/formations/${c.id}`} className="text-brand-dark hover:text-brand hover:underline">{c.title}</Link></td>
                  <td className="px-4 py-3 text-muted">{c.instructor?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{c.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{c.price_amount === 0 ? "Gratuit" : formatFcfa(c.price_amount)}</td>
                  <td className="px-4 py-3"><CourseStatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-muted">{formatDate(c.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function AdminCoursesPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  return (
    <>
      <AdminPageHeader crumbs={[{ label: "Formations" }]} icon="formation" className="mb-6" title="Formations" description="Validation pédagogique : les formations en révision sont affichées par défaut, les plus anciennes d’abord." />
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </>
  );
}
