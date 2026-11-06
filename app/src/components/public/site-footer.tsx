import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { SOCIALS } from "@/components/ui/social-icons";
import { siteContact, siteSocials } from "@/config/site";
import { HOME_CATEGORIES } from "@/content/home";
import { NAV } from "@/config/nav";

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-white">{children}</h2>;
}

export function SiteFooter() {
  const socials = (Object.keys(SOCIALS) as (keyof typeof SOCIALS)[]).filter((k) => siteSocials[k]);
  const contactLines = [
    { Icon: MapPin, text: siteContact.address, href: null },
    { Icon: Phone, text: siteContact.phone, href: siteContact.phone ? `tel:${siteContact.phone.replace(/\s/g, "")}` : null },
    { Icon: Mail, text: siteContact.email, href: siteContact.email ? `mailto:${siteContact.email}` : null },
    { Icon: Clock, text: siteContact.hours, href: null },
  ].filter((l) => l.text);

  return (
    <footer className="border-t border-white/15 bg-brand-dark text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-2 lg:grid-cols-[1.2fr_1.1fr_1.1fr_1fr]">
        <div className="lg:pr-6">
          <Logo onDark />
          <p className="mt-4 max-w-xs text-sm text-white/70">
            La plateforme digitale de formation, certification et gestion des compétences en sécurité.
          </p>
          {socials.length > 0 && (
            <div className="mt-5 flex gap-3">
              {socials.map((k) => {
                const { label, Icon } = SOCIALS[k];
                return (
                  <a key={k} href={siteSocials[k]!} target="_blank" rel="noopener noreferrer" aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 hover:border-cta hover:text-cta">
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <nav aria-label="Liens rapides" className="lg:border-l lg:border-white/25 lg:pl-8">
          <Heading>Liens rapides</Heading>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm text-white/75">
            {NAV.map((n) => <li key={n.href}><Link href={n.href} className="hover:text-white">{n.label}</Link></li>)}
          </ul>
        </nav>

        <nav aria-label="Nos formations" className="lg:border-l lg:border-white/25 lg:pl-8">
          <Heading>Nos formations</Heading>
          <ul className="mt-4 space-y-2.5 text-sm text-white/75">
            {HOME_CATEGORIES.map((c) => (
              <li key={c.slug}><Link href={`/formations?categorie=${c.slug}`} className="hover:text-white">{c.title}</Link></li>
            ))}
            <li><Link href="/formations" className="font-semibold text-cta hover:underline">Tout le catalogue →</Link></li>
          </ul>
        </nav>

        <div className="lg:border-l lg:border-white/25 lg:pl-8">
          <Heading>Contact</Heading>
          {contactLines.length > 0 ? (
            <ul className="mt-4 space-y-2.5 text-sm text-white/75">
              {contactLines.map(({ Icon, text, href }) => (
                <li key={text} className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cta" aria-hidden />
                  {href ? <a href={href} className="hover:text-white">{text}</a> : <span>{text}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-white/75">Une question ? Écrivez-nous depuis le formulaire de contact.</p>
          )}
          <ButtonLink href="/contact" variant="cta" className="mt-5">Nous écrire →</ButtonLink>
        </div>
      </div>

      <div className="border-t border-white/20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-white/80">
          <p>© SECURIPASS. Tous droits réservés.</p>
          <p className="flex flex-wrap gap-x-4">
            <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
            <Link href="/confidentialite" className="hover:text-white">Politique de confidentialité</Link>
            <Link href="/conditions" className="hover:text-white">Conditions d’utilisation</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
