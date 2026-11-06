/**
 * Informations publiques de l'organisation : renseignées par variables d'environnement, jamais inventées.
 * Un élément absent n'est tout simplement pas affiché.
 */
const env = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export const siteContact = {
  email: env(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
  phone: env(process.env.NEXT_PUBLIC_CONTACT_PHONE),
  address: env(process.env.NEXT_PUBLIC_CONTACT_ADDRESS),
  hours: env(process.env.NEXT_PUBLIC_CONTACT_HOURS),
  website: env(process.env.NEXT_PUBLIC_SITE_URL),
  /**
   * Carte de la page Contact : URL d'intégration https (OpenStreetMap « Partager > HTML », Google Maps « Intégrer »).
   * Par défaut : fond de carte OpenStreetMap sur Cocody, Abidjan, sans repère précis (aucune adresse n'est inventée).
   */
  mapEmbedUrl: (() => {
    const v = env(process.env.NEXT_PUBLIC_CONTACT_MAP_EMBED_URL);
    return v && v.startsWith("https://") ? v : "https://www.openstreetmap.org/export/embed.html?bbox=-4.02%2C5.32%2C-3.93%2C5.39&layer=mapnik";
  })(),
};

export const siteSocials = {
  facebook: env(process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK),
  linkedin: env(process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN),
  youtube: env(process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE),
  instagram: env(process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM),
};

/** Lien de la vidéo de présentation (https). Sans lui, le bouton « Voir la vidéo » n'est pas affiché. */
export const promoVideoUrl = (() => {
  const v = env(process.env.NEXT_PUBLIC_PROMO_VIDEO_URL);
  return v && v.startsWith("https://") ? v : null;
})();
