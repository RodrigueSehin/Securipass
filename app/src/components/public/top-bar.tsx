import { Mail, MapPin, Phone } from "lucide-react";
import { siteContact, siteSocials } from "@/config/site";
import { SOCIALS } from "@/components/ui/social-icons";

/** Barre d'information au-dessus de l'en-tête. N'affiche que les informations réellement configurées. */
export function TopBar() {
  const socials = (Object.keys(SOCIALS) as (keyof typeof SOCIALS)[]).filter((k) => siteSocials[k]);
  const hasContact = siteContact.address || siteContact.phone || siteContact.email;
  if (!hasContact && socials.length === 0) return null;

  return (
    <div className="hidden bg-brand-dark text-xs text-white md:block">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-6 px-4">
        <ul className="flex items-center gap-6">
          {siteContact.address && <li className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden />{siteContact.address}</li>}
          {siteContact.phone && <li><a href={`tel:${siteContact.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:underline"><Phone className="h-3.5 w-3.5" aria-hidden />{siteContact.phone}</a></li>}
          {siteContact.email && <li><a href={`mailto:${siteContact.email}`} className="flex items-center gap-1.5 hover:underline"><Mail className="h-3.5 w-3.5" aria-hidden />{siteContact.email}</a></li>}
        </ul>
        {socials.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-white/80">Suivez-nous :</span>
            {socials.map((k) => {
              const { label, Icon } = SOCIALS[k];
              return (
                <a key={k} href={siteSocials[k]!} target="_blank" rel="noopener noreferrer" aria-label={label} className="hover:text-cta">
                  <Icon className="h-4 w-4" />
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
