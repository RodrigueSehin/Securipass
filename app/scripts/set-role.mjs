// Affiche ou modifie les rôles d'un compte (par exemple pour créer le premier administrateur).
// Usage :
//   npm run role -- --email jean@exemple.com                       affiche les rôles actuels
//   npm run role -- --email jean@exemple.com --add admin           prévisualise l'ajout du rôle admin
//   npm run role -- --email jean@exemple.com --add admin --yes     applique l'ajout
//   npm run role -- --email jean@exemple.com --remove support --yes
//   npm run role -- --email jean@exemple.com --set admin,instructor --yes   remplace tous les rôles
// Rôles : learner, instructor, company, admin, pedagogy_manager, certification_manager, support.
// Garde-fous : un compte garde au moins un rôle, et le dernier administrateur ne peut pas être retiré.
// Prérequis : migrations appliquées, .env avec NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (clé privée : ne jamais la partager).
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROLES = ["learner", "instructor", "company", "admin", "pedagogy_manager", "certification_manager", "support"];
const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

function parse(argv) {
  const out = { email: "", add: [], remove: [], set: null, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => { const v = argv[++i]; if (!v || v.startsWith("--")) fail(`${a} attend une valeur`); return v; };
    const list = () => value().split(",").map((r) => r.trim()).filter(Boolean);
    if (a === "--email") out.email = value().trim().toLowerCase();
    else if (a === "--add") out.add.push(...list());
    else if (a === "--remove") out.remove.push(...list());
    else if (a === "--set") out.set = list();
    else if (a === "--yes") out.yes = true;
    else fail(`Option inconnue : ${a}`);
  }
  for (const r of [...out.add, ...out.remove, ...(out.set ?? [])]) if (!ROLES.includes(r)) fail(`Rôle inconnu « ${r} ». Rôles : ${ROLES.join(", ")}`);
  if (out.set && (out.add.length || out.remove.length)) fail("--set ne se combine pas avec --add ou --remove");
  if (out.set && out.set.length === 0) fail("--set demande au moins un rôle");
  if (!out.email || !out.email.includes("@")) fail("Indiquez le compte avec --email adresse@exemple.com (voir l'en-tête du script)");
  return out;
}

const opts = parse(process.argv.slice(2));

process.loadEnvFile(resolve(import.meta.dirname, "..", ".env"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis dans .env");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: profile, error: pErr } = await db.from("profiles").select("id, email, full_name").ilike("email", opts.email).maybeSingle();
if (pErr) fail(`Lecture du profil : ${pErr.message}`);
if (!profile) fail(`Aucun compte avec l'adresse ${opts.email}. Le compte doit d'abord être créé (inscription sur le site ou Authentication > Users).`);

const { data: roleRows, error: rErr } = await db.from("roles").select("id, code");
if (rErr) fail(`Lecture des rôles : ${rErr.message}`);
const idOf = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));

async function currentRoles() {
  const { data, error } = await db.from("user_roles").select("role_id").eq("user_id", profile.id);
  if (error) fail(`Lecture des rôles du compte : ${error.message}`);
  const codeOf = Object.fromEntries(roleRows.map((r) => [r.id, r.code]));
  return data.map((r) => codeOf[r.role_id]).filter(Boolean).sort();
}

const before = await currentRoles();
console.log(`Compte : ${profile.full_name || "(sans nom)"} <${profile.email}>`);
console.log(`Rôles actuels : ${before.join(", ") || "aucun"}`);

const wantsChange = opts.set !== null || opts.add.length > 0 || opts.remove.length > 0;
if (!wantsChange) process.exit(0);

const after = opts.set ? [...new Set(opts.set)].sort() : [...new Set([...before, ...opts.add])].filter((r) => !opts.remove.includes(r)).sort();
const toAdd = after.filter((r) => !before.includes(r));
const toRemove = before.filter((r) => !after.includes(r));
console.log(`Rôles après   : ${after.join(", ") || "aucun"}`);

if (after.length === 0) fail("Un compte doit garder au moins un rôle.");
if (toAdd.length === 0 && toRemove.length === 0) { console.log("Rien à changer."); process.exit(0); }

if (toRemove.includes("admin")) {
  const { count, error } = await db.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role_id", idOf.admin);
  if (error) fail(`Comptage des administrateurs : ${error.message}`);
  if ((count ?? 0) <= 1) fail("Ce compte est le dernier administrateur : ajoutez-en un autre avant de lui retirer le rôle.");
}

if (!opts.yes) {
  console.log(`\nAperçu seulement (+ ${toAdd.join(", ") || "rien"} / - ${toRemove.join(", ") || "rien"}). Relancez avec --yes pour appliquer.`);
  process.exit(0);
}

if (toAdd.length) {
  const { error } = await db.from("user_roles").insert(toAdd.map((r) => ({ user_id: profile.id, role_id: idOf[r] })));
  if (error) fail(`Ajout des rôles : ${error.message}`);
}
if (toRemove.length) {
  const { error } = await db.from("user_roles").delete().eq("user_id", profile.id).in("role_id", toRemove.map((r) => idOf[r]));
  if (error) fail(`Retrait des rôles : ${error.message}`);
}
await db.from("audit_logs").insert({
  actor_id: null, action: "user.roles.script", entity_type: "profile", entity_id: profile.id, metadata: { email: profile.email, before, after },
});

console.log(`\n✓ Rôles mis à jour : ${(await currentRoles()).join(", ")}`);
console.log("Le compte doit se déconnecter puis se reconnecter pour que le changement s'applique.");
