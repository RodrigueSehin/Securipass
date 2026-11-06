import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";

const EXTENSIONS = [".webp", ".jpg", ".png"];

/**
 * Chemin public d'une photo déposée dans public/images/, sinon null (le composant affiche alors une illustration).
 * `relativePath` peut omettre l'extension : .webp, .jpg puis .png sont essayés.
 */
export function publicImage(relativePath: string): string | null {
  const clean = relativePath.replace(/^\/+/, "");
  if (clean.includes("..")) return null;
  const candidates = /\.[a-z0-9]+$/i.test(clean) ? [clean] : EXTENSIONS.map((e) => clean + e);
  const found = candidates.find((c) => existsSync(join(process.cwd(), "public", "images", c)));
  return found ? `/images/${found}` : null;
}
