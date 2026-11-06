import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, Clock, GraduationCap, Globe, Handshake, Mail, MapPin, Phone, User } from "lucide-react";
import { siteContact } from "@/config/site";
import { CONTACT_TOPIC_CARDS } from "@/content/contact";
import { publicImage } from "@/lib/images";
import { cn } from "@/lib/utils";

/** Rangée de coordonnées : n'affiche que les informations réellement configurées (aucune donnée inventée). */
export function InfoCards() {
  const cards = [
    siteContact.phone && { Icon: Phone, tone: "bg-cta", title: "Appelez-nous", lines: [siteContact.phone, siteContact.hours].filter(Boolean) as string[], href: `tel:${siteContact.phone.replace(/\s/g, "")}` },
    siteContact.email && { Icon: Mail, tone: "bg-[#1479ff]", title: "Écrivez-nous", lines: [siteContact.email], href: `mailto:${siteContact.email}` },
    siteContact.address && { Icon: MapPin, tone: "bg-danger", title: "Notre adresse", lines: [siteContact.address] },
    siteContact.hours && { Icon: Clock, tone: "bg-brand-dark", title: "Nos horaires", lines: [siteContact.hours] },
  ].filter(Boolean) as { Icon: typeof Phone; tone: string; title: string; lines: string[]; href?: string }[];
  if (cards.length === 0) return null;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ Icon, tone, title, lines, href }) => (
        <li key={title} className="flex items-center gap-4 rounded-xl border border-line bg-white p-5 shadow-card">
          <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white", tone)}><Icon className="h-6 w-6" aria-hidden /></span>
          <div className="min-w-0 text-sm text-muted">
            <h2 className="font-bold text-brand-dark">{title}</h2>
            {lines.map((l, i) => (i === 0 && href ? <a key={l} href={href} className="block break-words hover:text-brand">{l}</a> : <p key={l} className="break-words">{l}</p>))}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MapCard() {
  if (!siteContact.mapEmbedUrl) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-line shadow-card">
      <iframe title="Carte : localisation de SECURIPASS" src={siteContact.mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="block h-[260px] w-full border-0 lg:h-[333px]" />
    </div>
  );
}

export function DetailsCard() {
  const photo = publicImage("contact/accueil");
  const rows = [
    siteContact.address && { Icon: MapPin, label: "Adresse", value: siteContact.address },
    siteContact.phone && { Icon: Phone, label: "Téléphone", value: siteContact.phone, sub: siteContact.hours ?? undefined, href: `tel:${siteContact.phone.replace(/\s/g, "")}` },
    siteContact.email && { Icon: Mail, label: "Email", value: siteContact.email, href: `mailto:${siteContact.email}` },
    siteContact.website && !/localhost/.test(siteContact.website) && { Icon: Globe, label: "Site web", value: siteContact.website.replace(/^https?:\/\//, ""), href: siteContact.website },
  ].filter(Boolean) as { Icon: typeof Phone; label: string; value: string; sub?: string; href?: string }[];
  return (
    <div className="relative flex-1 overflow-hidden rounded-xl border border-line bg-white shadow-card">
      {photo && (
        <Image
          src={photo} alt="" width={1100} height={733} sizes="320px" aria-hidden
          className="absolute inset-y-0 right-0 hidden h-full w-[55%] object-cover object-[60%_50%] sm:block [mask-image:linear-gradient(90deg,transparent_0,#000_45%)]"
        />
      )}
      <div className="relative p-6">
        <h2 className="text-2xl font-extrabold text-brand-dark">Nos coordonnées</h2>
        {rows.length === 0 ? (
          <p className="mt-3 max-w-xs text-sm text-muted">Utilisez le formulaire : nous vous répondrons par e-mail.</p>
        ) : (
          <ul className="mt-5 space-y-4 sm:max-w-[60%]">
            {rows.map(({ Icon, label, value, sub, href }) => (
              <li key={label} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-dark text-white"><Icon className="h-5 w-5" aria-hidden /></span>
                <div className="min-w-0 text-sm">
                  <p className="font-bold text-brand-dark">{label}</p>
                  {href ? <a href={href} className="break-words text-muted hover:text-brand">{value}</a> : <p className="break-words text-muted">{value}</p>}
                  {sub && <p className="text-xs text-muted">{sub}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const TOPIC_ICONS = { user: User, building: Building2, graduation: GraduationCap, handshake: Handshake } as const;

export function Topics() {
  return (
    <section className="rounded-2xl bg-surface p-5 md:p-6" aria-labelledby="topics-title">
      <h2 id="topics-title" className="text-2xl font-extrabold text-brand-dark">Vous avez un besoin spécifique ?</h2>
      <p className="mt-1 text-muted">Nous vous accompagnons selon votre profil.</p>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CONTACT_TOPIC_CARDS.map((t) => {
          const Icon = TOPIC_ICONS[t.icon];
          return (
            <li key={t.value} className="flex flex-col rounded-xl border border-line bg-white p-4 shadow-card">
              <div className="flex items-center gap-3">
                <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white", t.tone)}><Icon className="h-7 w-7" aria-hidden /></span>
                <div>
                  <h3 className="font-bold text-brand-dark">{t.title}</h3>
                  <p className="mt-0.5 text-xs leading-snug text-muted">{t.text}</p>
                </div>
              </div>
              <Link href={`/contact?type=${t.value}#message`} className="mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">
                Nous contacter <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
