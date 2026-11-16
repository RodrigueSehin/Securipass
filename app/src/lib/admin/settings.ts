import { z } from "zod";

export type PlatformSettings = {
  name: string; default_language: string; currency: string; timezone: string; sender_email: string;
  color_primary: string; color_secondary: string; color_accent: string; updated_at: string;
  tagline: string; description: string; contact_phone: string; website: string; address: string; date_format: string; time_format: string;
  allow_registrations: boolean; email_notifications: boolean; sms_notifications: boolean; maintenance_mode: boolean;
};
export const BOOL_FIELDS = ["allow_registrations", "email_notifications", "sms_notifications", "maintenance_mode"] as const;
export type BoolField = (typeof BOOL_FIELDS)[number];
export const DATE_FORMATS = { "dd/mm/yyyy": "jj/mm/aaaa", "mm/dd/yyyy": "mm/jj/aaaa", "yyyy-mm-dd": "aaaa-mm-jj" } as const;
export const TIME_FORMATS = { "24h": "24 heures (ex. : 14:30)", "12h": "12 heures (ex. : 2:30 PM)" } as const;

export const LANGUAGES = { fr: "Français (FR)", en: "English (EN)" } as const;
export const CURRENCIES = { XOF: "FCFA (XOF)", EUR: "Euro (EUR)", USD: "Dollar US (USD)" } as const;
export const TIMEZONES = {
  "Africa/Abidjan": "Afrique/Abidjan (GMT+0)", "Africa/Dakar": "Afrique/Dakar (GMT+0)", "Africa/Lagos": "Afrique/Lagos (GMT+1)", "Europe/Paris": "Europe/Paris (GMT+1/+2)", UTC: "UTC",
} as const;

export const DEFAULT_SETTINGS: PlatformSettings = {
  name: "SECURIPASS", default_language: "fr", currency: "XOF", timezone: "Africa/Abidjan", sender_email: "no-reply@securipass.ci",
  color_primary: "#1F3F6D", color_secondary: "#EED58E", color_accent: "#FF7A00", updated_at: "",
  tagline: "Former · Certifier · Sécuriser", description: "Plateforme de gestion de la formation, de la certification et du développement des compétences.",
  contact_phone: "", website: "", address: "", date_format: "dd/mm/yyyy", time_format: "24h",
  allow_registrations: true, email_notifications: true, sms_notifications: false, maintenance_mode: false,
};

const hex = z.string().trim().regex(/^#[0-9a-f]{6}$/i, "Couleur au format #RRGGBB.");
/** Un champ à la fois (crayon de l'aperçu) ou les trois couleurs ensemble (personnalisation rapide). */
export const settingsFieldSchemas = {
  name: z.string().trim().min(2, "Au moins 2 caractères.").max(80, "80 caractères au maximum."),
  default_language: z.enum(["fr", "en"]),
  currency: z.enum(["XOF", "EUR", "USD"]),
  timezone: z.enum(Object.keys(TIMEZONES) as [keyof typeof TIMEZONES, ...(keyof typeof TIMEZONES)[]]),
  sender_email: z.string().trim().max(200).email("Adresse e-mail invalide."),
  color_primary: hex, color_secondary: hex, color_accent: hex,
  tagline: z.string().trim().max(120, "Slogan : 120 caractères au maximum."),
  description: z.string().trim().min(1, "La description est obligatoire.").max(250, "Description : 250 caractères au maximum."),
  contact_phone: z.string().trim().max(40, "Téléphone : 40 caractères au maximum.").regex(/^[+\d\s().-]*$/, "Numéro de téléphone invalide."),
  website: z.string().trim().max(200).refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Site web : adresse en http:// ou https://."),
  address: z.string().trim().max(200, "Adresse : 200 caractères au maximum."),
  date_format: z.enum(["dd/mm/yyyy", "mm/dd/yyyy", "yyyy-mm-dd"]),
  time_format: z.enum(["24h", "12h"]),
  allow_registrations: z.enum(["true", "false"]), email_notifications: z.enum(["true", "false"]),
  sms_notifications: z.enum(["true", "false"]), maintenance_mode: z.enum(["true", "false"]),
} as const;
export type SettingsField = keyof typeof settingsFieldSchemas;

/** Ne retient que les champs connus présents dans le formulaire ; renvoie les valeurs validées ou la première erreur. */
export function parseSettingsForm(entries: Record<string, FormDataEntryValue | null>): { values: Partial<Record<SettingsField, string>> } | { error: string } {
  const values: Partial<Record<SettingsField, string>> = {};
  for (const key of Object.keys(settingsFieldSchemas) as SettingsField[]) {
    const raw = entries[key];
    if (raw === null || raw === undefined) continue;
    const parsed = settingsFieldSchemas[key].safeParse(raw.toString());
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Valeur invalide." };
    values[key] = parsed.data;
  }
  return Object.keys(values).length === 0 ? { error: "Aucune modification à enregistrer." } : { values };
}

/** Catégories de la page : seules celles dont l'écran existe sont actives. */
export const SETTINGS_SECTIONS = [
  { key: "general", title: "Général", text: "Informations de la plateforme, identité, logo, langue, fuseau horaire, devise.", tone: "bg-[#4f6df5]", href: "/admin/parametres/general" },
  { key: "users", title: "Utilisateurs et accès", text: "Rôles, permissions, politiques de sécurité et accès à la plateforme.", tone: "bg-[#8b5cf6]", href: null },
  { key: "courses", title: "Formations", text: "Paramètres des formations, sessions, inscriptions et certifications.", tone: "bg-[#22c55e]", href: null },
  { key: "payments", title: "Paiements et facturation", text: "Moyens de paiement, factures, taxes, remboursements et commissions.", tone: "bg-[#facc15]", href: null },
  { key: "notifications", title: "Notifications", text: "Configuration des notifications email, SMS et alertes applicatives.", tone: "bg-[#f43f5e]", href: null },
  { key: "emails", title: "Emails et communication", text: "Modèles d’emails, expéditeur, signature et communications automatiques.", tone: "bg-[#14b8a6]", href: null },
  { key: "integrations", title: "Intégrations", text: "Connexions avec des outils externes (Teams, OneDrive, calendrier, API, etc.).", tone: "bg-[#a855f7]", href: null },
  { key: "security", title: "Sécurité", text: "Politique de mot de passe, authentification (2FA), sessions et journal de connexion.", tone: "bg-[#3b82f6]", href: null },
  { key: "data", title: "Données et maintenance", text: "Sauvegardes, import/export de données, nettoyage et réinitialisation.", tone: "bg-[#8d99ae]", href: null },
] as const;
