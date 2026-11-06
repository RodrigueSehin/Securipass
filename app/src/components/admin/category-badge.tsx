import {
  BookOpen, Briefcase, Building2, Cross, Flame, Folder, HardHat, Heart, HeartPulse, Leaf, Lock, Network, PersonStanding, ShieldCheck, Siren, TriangleAlert, Users,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/admin/categories";
import { cn } from "@/lib/utils";

/** Icônes proposées pour une catégorie (clés stockées en base). */
export const CATEGORY_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  folder: { icon: Folder, label: "Dossier" }, flame: { icon: Flame, label: "Incendie" }, "hard-hat": { icon: HardHat, label: "Chantier" },
  "heart-pulse": { icon: HeartPulse, label: "Santé" }, "triangle-alert": { icon: TriangleAlert, label: "Risques" }, "person-standing": { icon: PersonStanding, label: "Évacuation" },
  network: { icon: Network, label: "Informatique" }, lock: { icon: Lock, label: "Accès" }, building: { icon: Building2, label: "Bâtiments" },
  leaf: { icon: Leaf, label: "Environnement" }, users: { icon: Users, label: "Management" }, heart: { icon: Heart, label: "Bien-être" },
  shield: { icon: ShieldCheck, label: "Sécurité" }, cross: { icon: Cross, label: "Secours" }, siren: { icon: Siren, label: "Urgence" },
  briefcase: { icon: Briefcase, label: "Métiers" }, book: { icon: BookOpen, label: "Formation" },
};

/** Pastille d'icône d'une catégorie : la couleur est une clé connue ou un code hexadécimal. */
export function CategoryBadge({ icon, color, size = 40, className }: { icon: string; color: string; size?: number; className?: string }) {
  const Icon = (CATEGORY_ICONS[icon] ?? CATEGORY_ICONS.folder).icon;
  const hex = /^#[0-9a-f]{6}$/i.test(color);
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-xl text-white", !hex && (CATEGORY_COLORS[color] ?? CATEGORY_COLORS.blue), className)}
      style={{ width: size, height: size, ...(hex ? { backgroundColor: color } : {}) }} aria-hidden>
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}
