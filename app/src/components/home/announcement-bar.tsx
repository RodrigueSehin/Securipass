import Link from "next/link";
import { Megaphone } from "lucide-react";
import { getPublicAnnouncements } from "@/lib/admin/announcements-queries";

type Item = { id: string; message: string; link_url: string | null };

function Entry({ item }: { item: Item }) {
  const external = item.link_url?.startsWith("http");
  const text = <span className="whitespace-nowrap">{item.message}</span>;
  return (
    <li className="flex items-center gap-8 pr-8">
      {item.link_url
        ? external
          ? <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{text}</a>
          : <Link href={item.link_url} className="underline-offset-2 hover:underline">{text}</Link>
        : text}
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white/60" />
    </li>
  );
}

const MIN_CHARS = 260; // largeur minimale d'une moitié de piste, pour éviter un vide quand les messages sont courts
const SECONDS_PER_CHAR = 0.15; // ≈ 60 px/s

/** Bande d'information défilante en haut de l'accueil ; absente s'il n'y a aucun message actif. Le défilement s'arrête au survol et au focus. */
export async function AnnouncementBar() {
  const items = await getPublicAnnouncements();
  if (items.length === 0) return null;
  const chars = items.reduce((n, i) => n + i.message.length + 6, 0);
  const repeat = Math.max(1, Math.ceil(MIN_CHARS / chars));
  const duration = Math.max(20, Math.round(chars * repeat * SECONDS_PER_CHAR));
  // Deux moitiés identiques (la piste glisse de 50 %) ; seule la première copie est lue par les lecteurs d'écran
  const copies = Array.from({ length: repeat * 2 }, (_, k) => k);
  return (
    <section aria-label="Informations" className="marquee flex items-center bg-brand-dark text-sm font-semibold text-white">
      <span className="z-10 flex shrink-0 items-center gap-2 bg-cta px-4 py-2.5" aria-hidden><Megaphone className="h-4 w-4" />Infos</span>
      <div className="marquee-viewport min-w-0 flex-1 overflow-hidden py-2.5">
        <div className="marquee-track flex w-max" style={{ animationDuration: `${duration}s` }}>
          {copies.map((k) => (
            <ul key={k} className="marquee-group flex shrink-0 pl-8" aria-hidden={k > 0 ? true : undefined} inert={k > 0}>{items.map((i) => <Entry key={i.id} item={i} />)}</ul>
          ))}
        </div>
      </div>
    </section>
  );
}
