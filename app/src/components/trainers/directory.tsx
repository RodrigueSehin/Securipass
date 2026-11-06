import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { AutoSubmitForm } from "@/components/catalogue/auto-submit-form";
import { EmptyState } from "@/components/ui/feedback";
import { DemoNotice } from "@/components/ui/demo-notice";
import { TRAINER_DOMAINS, type Trainer } from "@/content/trainers";
import { publicImage } from "@/lib/images";
import { listPublishedTrainers } from "@/lib/trainers-queries";
import { domainCounts, initials, queryTrainers, trainersHref } from "@/lib/trainers";
import { cn } from "@/lib/utils";

function TrainerCard({ t }: { t: Trainer }) {
  const photo = publicImage(`trainers/${t.slug}`);
  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-card">
      <div className="relative h-[154px] bg-brand-soft">
        {photo ? (
          <Image src={photo} alt={`Portrait de ${t.name}`} fill sizes="(min-width: 1024px) 310px, 50vw" className="object-cover object-top" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#092a66,#1479ff)] text-5xl font-extrabold text-white/90" aria-hidden>{initials(t.name)}</div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-lg font-bold text-brand-dark">{t.name}</h3>
        <p className="text-sm font-semibold text-brand-dark">{t.role}</p>
        <p className="mt-1 text-sm leading-snug text-muted">{t.bio}</p>
        {t.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {t.tags.map((tag) => <li key={tag} className="rounded bg-brand-soft px-2 py-1 text-xs font-medium text-brand">{tag}</li>)}
          </ul>
        )}
      </div>
    </li>
  );
}

export async function TrainerDirectory({ domain, q }: { domain?: string; q?: string }) {
  const { trainers: TRAINERS, hasDemo, failed } = await listPublishedTrainers();
  const counts = domainCounts(TRAINERS);
  const items = queryTrainers(TRAINERS, { domain, q });
  const chips = [{ slug: undefined as string | undefined, label: `Tous (${TRAINERS.length})` }, ...TRAINER_DOMAINS.map((d) => ({ slug: d.slug as string | undefined, label: `${d.label} (${counts.get(d.slug) ?? 0})` }))];

  return (
    <section id="equipe" className="scroll-mt-28" aria-labelledby="team-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 id="team-title" className="text-3xl font-extrabold text-brand-dark">Notre équipe de formateurs</h2>
          <p className="mt-1 max-w-xl text-lg leading-snug text-muted">Des experts qualifiés, issus du terrain, pour vous transmettre les meilleures pratiques en sécurité, secourisme et prévention des risques.</p>
        </div>
        <AutoSubmitForm action="/formateurs#equipe" className="flex flex-col gap-3 sm:flex-row lg:w-[600px]">
          <div className="relative flex-1">
            <label htmlFor="trainer-search" className="sr-only">Rechercher un formateur</label>
            <input id="trainer-search" name="q" type="search" defaultValue={q} placeholder="Rechercher un formateur…"
              className="w-full rounded-lg border border-line bg-white py-3 pl-3 pr-10 text-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20" />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-dark" aria-hidden />
          </div>
          <div className="relative sm:w-[220px]">
            <label htmlFor="trainer-domain" className="sr-only">Domaine</label>
            <select id="trainer-domain" name="domaine" defaultValue={domain ?? ""} className="w-full appearance-none rounded-lg border border-line bg-white py-3 pl-3 pr-9 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
              <option value="">Tous les domaines</option>
              {TRAINER_DOMAINS.map((d) => <option key={d.slug} value={d.slug}>{d.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-dark" aria-hidden />
          </div>
          <noscript><button type="submit" className="rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white">Appliquer</button></noscript>
        </AutoSubmitForm>
      </div>

      <nav aria-label="Domaines" className="mt-4">
        <ul className="flex flex-wrap gap-3">
          {chips.map((c) => {
            const active = c.slug === (domain || undefined);
            return (
              <li key={c.label}>
                <Link href={trainersHref({ domaine: c.slug, q })} aria-current={active ? "page" : undefined}
                  className={cn("inline-flex h-11 items-center rounded-lg px-6 text-sm font-medium transition-colors", active ? "bg-brand-dark text-white" : "bg-brand-soft text-brand-dark hover:bg-brand/10")}>
                  {c.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {hasDemo && <div className="mt-4"><DemoNotice>Profils de démonstration : formateurs, noms et parcours fictifs, présentés à titre d’exemple.</DemoNotice></div>}

      {items.length > 0 ? (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{items.map((t) => <TrainerCard key={t.slug} t={t} />)}</ul>
      ) : (
        <EmptyState className="mt-6" title={failed ? "Les formateurs ne sont pas disponibles pour le moment" : TRAINERS.length === 0 ? "Les profils de nos formateurs seront présentés ici prochainement" : "Aucun formateur ne correspond à votre recherche"}>
          {failed ? "Réessayez dans quelques instants." : TRAINERS.length === 0
            ? <>Vous êtes formateur ? <a href="#candidature" className="font-semibold text-brand hover:underline">Déposez votre candidature</a>.</>
            : <Link href="/formateurs#equipe" className="font-semibold text-brand hover:underline">Voir tous les formateurs</Link>}
        </EmptyState>
      )}
    </section>
  );
}
