import { GraduationCap, Monitor, ShieldCheck, UsersRound } from "lucide-react";
import { HOME_BENEFITS } from "@/content/home";
import { SectionTitle } from "./section-title";

const ICONS = { cap: GraduationCap, monitor: Monitor, shield: ShieldCheck, users: UsersRound } as const;
const TONES = { orange: "bg-cta", blue: "bg-[#1479ff]", green: "bg-success", red: "bg-danger" } as const;

export function Benefits() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <SectionTitle eyebrow="Pourquoi choisir SECURIPASS ?">
        Une plateforme complète pour développer<br className="hidden md:block" /> vos <span className="text-cta">compétences en sécurité</span>
      </SectionTitle>
      <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {HOME_BENEFITS.map((b) => {
          const Icon = ICONS[b.icon];
          return (
            <li key={b.title} className="rounded-2xl border border-line bg-white p-6 text-center shadow-card">
              <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white ${TONES[b.tone]}`}><Icon className="h-7 w-7" aria-hidden /></span>
              <h3 className="mt-4 font-bold text-brand-dark">{b.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{b.text}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
