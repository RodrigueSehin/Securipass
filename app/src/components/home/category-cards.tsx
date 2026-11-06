import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Flame, Plus, Shield } from "lucide-react";
import { HOME_CATEGORIES, type HomeCategory } from "@/content/home";
import { publicImage } from "@/lib/images";
import { cn } from "@/lib/utils";

const TONES = {
  blue: { circle: "bg-brand-dark text-white", check: "bg-brand text-white", wash: "text-brand-soft", big: "text-brand/10" },
  green: { circle: "bg-success text-white", check: "bg-success text-white", wash: "text-success/10", big: "text-success/10" },
  red: { circle: "bg-danger text-white", check: "bg-danger text-white", wash: "text-danger/10", big: "text-danger/10" },
} as const;

const ICONS = { shield: Shield, cross: Plus, flame: Flame } as const;

function Card({ c }: { c: HomeCategory }) {
  const t = TONES[c.tone];
  const Icon = ICONS[c.icon];
  const photo = publicImage(`home/${c.image}`);
  return (
    <article className="relative overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-card">
      {/* Visuel : photo si disponible, sinon grand pictogramme discret */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2" aria-hidden>
        {photo ? (
          <Image src={photo} alt="" fill sizes="(min-width: 1024px) 18vw, 50vw" className="object-cover [mask-image:linear-gradient(to_right,transparent,black_55%)]" />
        ) : (
          <Icon className={cn("absolute -right-6 bottom-6 h-44 w-44", t.big)} strokeWidth={1.2} />
        )}
      </div>

      <div className="relative">
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-full", t.circle)}><Icon className="h-6 w-6" aria-hidden /></span>
        <h2 className="mt-4 text-xl font-extrabold text-brand-dark">{c.title}</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-muted">
          {c.items.map((i) => (
            <li key={i} className="flex items-center gap-2">
              <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full", t.check)}><Check className="h-3 w-3" strokeWidth={3} aria-hidden /></span>
              {i}
            </li>
          ))}
        </ul>
        <Link href={`/formations?categorie=${c.slug}`} className="mt-5 inline-flex items-center gap-2 rounded-md bg-brand-dark px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand">
          Voir les formations <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export function CategoryCards() {
  return (
    <section aria-label="Domaines de formation" className="mx-auto -mt-0 grid max-w-7xl gap-5 px-4 py-8 md:grid-cols-3">
      {HOME_CATEGORIES.map((c) => <Card key={c.slug} c={c} />)}
    </section>
  );
}
