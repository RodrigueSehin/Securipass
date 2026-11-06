import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, BadgeCheck, BarChart3, CalendarClock, Check, Clock, Headphones, Languages, Laptop, Layers, ListChecks, MapPin, ShoppingCart } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { siteContact } from "@/config/site";
import { MODE_DETAIL, formatValidity, initials, pluralize, programmeStats } from "@/lib/courses/detail";
import { LEVELS, type Mode } from "@/lib/courses/labels";
import type { PublicCourse } from "@/lib/courses/types";
import { formatDuration, formatFcfa } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/courses/schemas";
import { CertificateSpecimen } from "./certificate-specimen";

const MODE_ICONS: Record<Mode, typeof Laptop> = { online: Laptop, onsite: MapPin, hybrid: Layers };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-white shadow-card ${className}`}>{children}</div>;
}

export function DetailSidebar({ course: c, image, hasCertificate }: { course: PublicCourse; image: string | null; hasCertificate: boolean }) {
  const paid = c.price_amount > 0;
  const ModeIcon = MODE_ICONS[c.delivery_mode];
  const stats = programmeStats(c.modules);
  const facts = [
    { Icon: Clock, text: `${formatDuration(c.duration_minutes)} de formation` },
    { Icon: ModeIcon, text: MODE_DETAIL[c.delivery_mode] },
    { Icon: BarChart3, text: `Niveau ${LEVELS[c.level].toLowerCase()}` },
    { Icon: Languages, text: `Langue : ${c.language === "fr" ? "français" : c.language}` },
    ...(stats.lessons > 0 ? [{ Icon: ListChecks, text: `${pluralize(stats.lessons, "leçon", "leçons")} au programme` }] : []),
    ...(c.sessions.length > 0 ? [{ Icon: CalendarClock, text: `${pluralize(c.sessions.length, "session à venir", "sessions à venir")}` }] : []),
    ...(hasCertificate ? [{ Icon: BadgeCheck, text: "Certificat SECURIPASS" }] : []),
  ];
  const phone = siteContact.phone;

  return (
    <aside className="space-y-5">
      <Card className="overflow-hidden">
        {image && (
          <div className="relative h-44">
            <Image src={image} alt="" fill sizes="(min-width: 1024px) 22rem, 100vw" className="object-cover object-[55%_25%]" unoptimized={image.startsWith("http")} />
          </div>
        )}
        <div className="p-5">
          <p className="text-3xl font-extrabold text-brand-dark">{paid ? formatFcfa(c.price_amount) : "Gratuit"}</p>
          <p className="mt-1 text-xs text-muted">{paid ? "Prix indiqué avant tout paiement" : "Aucun paiement requis"}</p>
          {paid && (c.payment_methods ?? []).length > 0 && (
            <p className="mt-2 text-xs text-muted">
              Paiement accepté : {(c.payment_methods ?? []).map((m) => PAYMENT_METHOD_LABELS[m as keyof typeof PAYMENT_METHOD_LABELS] ?? m).join(", ")}
              {c.allow_installments ? " · paiement en plusieurs fois possible" : ""}.
            </p>
          )}
          {c.parent_course && (
            <p className="mt-2 text-xs text-muted">Fait partie du parcours : <Link href={`/formations/${c.parent_course.slug}`} className="font-semibold text-brand underline">{c.parent_course.title}</Link></p>
          )}
          {paid ? (
            <>
              <button disabled aria-describedby="pay-note" className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-cta/50 px-5 py-3 text-sm font-semibold text-white">
                <ShoppingCart className="h-4 w-4" aria-hidden />S’inscrire maintenant
              </button>
              <p id="pay-note" className="mt-2 text-xs text-muted">
                L’inscription en ligne aux formations payantes ouvrira avec le paiement sécurisé. Pour réserver dès maintenant, <Link href="/contact" className="text-brand underline">contactez-nous</Link>.
              </p>
            </>
          ) : c.registrations_open === false ? (
            <>
              <button disabled className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-surface px-5 py-3 text-sm font-semibold text-muted">Inscriptions fermées</button>
              <p className="mt-2 text-xs text-muted">Les inscriptions en ligne sont fermées pour le moment. <Link href="/contact" className="text-brand underline">Contactez-nous</Link> pour être informé de la réouverture.</p>
            </>
          ) : (
            <ButtonLink href={`/formations/${c.slug}/inscription`} variant="cta" className="mt-4 w-full py-3">
              <ShoppingCart className="h-4 w-4" aria-hidden />S’inscrire maintenant <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
          )}
          {c.sessions.length === 0 && !paid && <p className="mt-2 text-xs text-muted">Aucune session planifiée : l’inscription est ouverte à tout moment.</p>}
          <ul className="mt-5 space-y-3 text-sm text-brand-dark">
            {facts.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3"><Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />{text}</li>
            ))}
          </ul>
        </div>
      </Card>

      <Link href={phone ? `tel:${phone.replace(/\s/g, "")}` : "/contact"} className="flex items-center gap-4 rounded-2xl bg-brand-soft px-5 py-4 hover:bg-[#dbe9ff]">
        <Headphones className="h-9 w-9 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />
        <span className="flex-1">
          <span className="block text-sm font-bold text-brand-dark">Une question ?</span>
          <span className="block text-sm text-brand">{phone ?? "Écrivez-nous"}</span>
        </span>
        <ArrowRight className="h-4 w-4 text-brand" aria-hidden />
      </Link>

      {hasCertificate && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-dark"><Award className="h-5 w-5 text-cta" aria-hidden />Certification délivrée</h2>
          <div className="mt-3"><CertificateSpecimen /></div>
          <ul className="mt-4 space-y-2 text-sm text-brand-dark">
            {["Certificat numérique avec QR Code", "Vérifiable en ligne", ...(c.certificate_validity_months ? [`Valable ${formatValidity(c.certificate_validity_months)} (renouvelable)`] : [])].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-success text-white"><Check className="h-3 w-3" strokeWidth={3} aria-hidden /></span>{t}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Exemple illustratif. Le certificat n’est délivré que si les conditions de la formation sont remplies.</p>
        </Card>
      )}

      {c.instructor_name && (
        <Card className="p-5">
          <h2 className="text-lg font-extrabold text-brand-dark">Formateur principal</h2>
          <div className="mt-3 flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white" aria-hidden>{initials(c.instructor_name)}</span>
            <div>
              <p className="font-bold text-brand-dark">{c.instructor_name}</p>
              <p className="text-sm text-muted">Formateur sur SECURIPASS</p>
            </div>
          </div>
          <Link href="/formateurs" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Devenir formateur <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </Card>
      )}
    </aside>
  );
}
