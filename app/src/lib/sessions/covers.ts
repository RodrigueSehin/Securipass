import { categoryUi } from "@/content/categories";
import { publicImage } from "@/lib/images";
import type { WizardCourse } from "./wizard-queries";

/** Ajoute l'image de la formation (couverture, sinon image de sa catégorie). */
export function withCovers(courses: WizardCourse[]) {
  return courses.map((c) => {
    const ui = categoryUi(c.category?.slug, c.category?.name);
    return { ...c, cover: c.cover_url ?? (ui.image ? publicImage(`home/${ui.image}`) : null) };
  });
}
