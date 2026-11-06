// Optimise les images de référence (maquettes/images/) vers public/images/ : WebP redimensionné, logo rogné, icône du site.
// Usage : npm run images   (à relancer quand une image de référence change)
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const src = resolve(root, "..", "maquettes", "images");
const out = join(root, "public", "images");
mkdirSync(join(out, "home"), { recursive: true });
mkdirSync(join(out, "brand"), { recursive: true });
mkdirSync(join(out, "banners"), { recursive: true });
mkdirSync(join(out, "about"), { recursive: true });
mkdirSync(join(out, "contact"), { recursive: true });

const photos = [
  ["Security Team Responds to Urban Fire.png", "home/hero.webp", 1800],
  ["Urban Security Guard on Patrol.png", "home/agent-securite.webp", 900],
  ["Workplace CPR Training Session.png", "home/secourisme.webp", 900],
  ["Firefighter Battling an Inferno.png", "home/securite-incendie.webp", 900],
  ["Collaborative Construction Site Tablet Meeting.png", "home/entreprise.webp", 1100],
  ["SECURIPASS Consultation and Training Center.png", "about/histoire.webp", 1100],
  ["Industrial CPR Training with Rescuer and Manikin.png", "about/engagement.webp", 1100],
  ["Modern Securipass Headquarters by the Palms.png", "contact/accueil.webp", 1100],
  ["Smiling Call Center Professional at Desk.png", "contact/equipe.webp", 1800],
  // Bannières panoramiques (dossier maquettes/images/bannières/)
  ["bannières/Industrial Team Reviewing Tablet.png", "banners/industrial.webp", 2000],
  ["bannières/Collaborative Security Team with Tablet.png", "banners/collaborative.webp", 2000],
];

for (const [file, dest, width] of photos) {
  const info = await sharp(join(src, file)).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(join(out, dest));
  console.log(`${dest}  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} Ko`);
}

// Logo : rognage des marges blanches, hauteur 2x pour écrans haute densité (affiché à ~44 px).
const logoSrc = join(src, "Securipass Logo.png");
const trimmed = await sharp(logoSrc).trim({ threshold: 18 }).toBuffer({ resolveWithObject: true });
const logo = await sharp(trimmed.data).resize({ height: 176 }).png({ compressionLevel: 9 }).toFile(join(out, "brand", "logo.png"));
console.log(`brand/logo.png  ${logo.width}x${logo.height}  ${Math.round(logo.size / 1024)} Ko`);

// Icône du site : le blason seul (partie gauche du logo), sur fond blanc, carré.
const { width: tw, height: th } = trimmed.info;
const shieldWidth = Math.round(th * 0.78);
const shield = await sharp(trimmed.data)
  .extract({ left: 0, top: 0, width: Math.min(shieldWidth, tw), height: th })
  .resize({ height: 232 })
  .extend({ top: 12, bottom: 12, left: 12, right: 12, background: "#ffffff" })
  .resize(256, 256, { fit: "contain", background: "#ffffff" })
  .png()
  .toBuffer();
await sharp(shield).toFile(join(root, "src", "app", "icon.png"));
console.log("src/app/icon.png  256x256");
console.log(`logo source rogné : ${tw}x${th}`);
