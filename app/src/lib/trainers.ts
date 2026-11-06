import { TRAINER_DOMAINS, type Trainer, type TrainerDomain } from "@/content/trainers";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function isDomain(v: string | undefined): v is TrainerDomain {
  return TRAINER_DOMAINS.some((d) => d.slug === v);
}

/** Filtre par domaine et recherche (nom, intitulé, présentation, tags) sans tenir compte des accents ni de la casse. */
export function queryTrainers(trainers: readonly Trainer[], { domain, q }: { domain?: string; q?: string }) {
  const needle = q ? norm(q.trim()) : "";
  return trainers
    .filter((t) => !isDomain(domain) || t.domain === domain)
    .filter((t) => !needle || norm([t.name, t.role, t.bio, ...t.tags].join(" ")).includes(needle));
}

export function domainCounts(trainers: readonly Trainer[]) {
  const counts = new Map<string, number>();
  for (const t of trainers) counts.set(t.domain, (counts.get(t.domain) ?? 0) + 1);
  return counts;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export function trainersHref(p: { domaine?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (p.domaine) sp.set("domaine", p.domaine);
  if (p.q) sp.set("q", p.q);
  const s = sp.toString();
  return s ? `/formateurs?${s}#equipe` : "/formateurs#equipe";
}
