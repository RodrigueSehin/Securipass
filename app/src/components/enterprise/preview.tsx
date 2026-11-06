import { Bell, Building2, CalendarDays, FileText, LayoutDashboard, Receipt, Search, Settings, UsersRound, GraduationCap, BadgeCheck } from "lucide-react";

const MENU = [
  { Icon: LayoutDashboard, label: "Tableau de bord", active: true },
  { Icon: UsersRound, label: "Employés" }, { Icon: GraduationCap, label: "Formations" }, { Icon: BadgeCheck, label: "Certifications" },
  { Icon: CalendarDays, label: "Planning" }, { Icon: FileText, label: "Rapports" }, { Icon: Receipt, label: "Factures" }, { Icon: Settings, label: "Paramètres" },
];

// Chiffres ILLUSTRATIFS (cohérents entre eux : 219 + 18 + 11 = 248). Ils ne représentent aucune entreprise réelle.
const KPIS = [
  { value: 248, label: "Employés", tone: "text-brand" },
  { value: 219, label: "Certifications valides", tone: "text-success" },
  { value: 18, label: "À renouveler", tone: "text-warning" },
  { value: 11, label: "Expirées", tone: "text-danger" },
];

const EXPIRING = [
  { initials: "CA", name: "Collaborateur A", note: "SST — expire dans 15 jours", tone: "text-cta" },
  { initials: "CB", name: "Collaborateur B", note: "Sécurité incendie — expire dans 22 jours", tone: "text-cta" },
  { initials: "CC", name: "Collaborateur C", note: "Agent de sécurité — expire dans 30 jours", tone: "text-cta" },
];

/** Aperçu illustratif de l'espace entreprise : image décorative, non interactive, données d'exemple signalées. */
export function EnterprisePreview() {
  return (
    <figure className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-brand-dark">Aperçu de votre espace entreprise</span>
        <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#8a5a00]">Exemple illustratif · données fictives</span>
      </figcaption>
      <div role="img" aria-label="Aperçu illustratif du tableau de bord entreprise : employés, certifications valides, à renouveler et expirées" className="flex overflow-hidden rounded-xl border border-line text-[11px]">
        <div className="hidden w-36 shrink-0 bg-brand-dark p-3 text-white sm:block" aria-hidden>
          <p className="font-extrabold tracking-tight">SECURI<span className="text-[#7aa5ff]">PASS</span></p>
          <p className="mb-3 text-[9px] text-white/60">Espace entreprise</p>
          <ul className="space-y-1">
            {MENU.map(({ Icon, label, active }) => (
              <li key={label} className={`flex items-center gap-2 rounded px-2 py-1.5 ${active ? "bg-brand" : "text-white/75"}`}><Icon className="h-3 w-3" />{label}</li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 flex-1 bg-surface p-3" aria-hidden>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex flex-1 items-center gap-1.5 rounded border border-line bg-white px-2 py-1.5 text-muted"><Search className="h-3 w-3" />Rechercher un employé…</span>
            <Bell className="h-3.5 w-3.5 text-muted" />
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-white">VE</span>
          </div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-brand-dark"><Building2 className="h-4 w-4 text-brand" />Votre entreprise</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {KPIS.map((k) => (
              <div key={k.label} className="rounded-lg bg-white p-2.5">
                <p className={`text-xl font-extrabold ${k.tone}`}>{k.value}</p>
                <p className="text-muted">{k.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-3">
              <p className="mb-2 font-bold text-brand-dark">Répartition des certifications</p>
              <div className="flex items-center gap-3">
                <div className="relative h-20 w-20 shrink-0 rounded-full" style={{ background: "conic-gradient(#10a875 0 88%, #f59e0b 88% 95%, #e53935 95% 100%)" }}>
                  <span className="absolute inset-[22%] rounded-full bg-white" />
                </div>
                <ul className="space-y-1 text-muted">
                  <li><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-success" />Valides 88 %</li>
                  <li><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-warning" />À renouveler 7 %</li>
                  <li><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-danger" />Expirées 5 %</li>
                </ul>
              </div>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="mb-2 font-bold text-brand-dark">Prochaines expirations</p>
              <ul className="space-y-2">
                {EXPIRING.map((e) => (
                  <li key={e.name} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[9px] font-bold text-brand">{e.initials}</span>
                    <span className="leading-tight"><span className="block font-semibold text-brand-dark">{e.name}</span><span className={e.tone}>{e.note}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
