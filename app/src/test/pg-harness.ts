// Base PostgreSQL embarquée (PGlite) qui rejoue les migrations avec un faux environnement Supabase.
// Permet de tester les règles métier SQL (RLS, fonctions, triggers) sans Docker ni réseau.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}',
  last_sign_in_at timestamptz
);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, metadata jsonb
);
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select string_to_array(name, '/') $$;
alter table storage.objects enable row level security;
`;

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export async function createTestDb() {
  const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  await db.exec(SUPABASE_STUBS);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  // Comme Supabase : droits par défaut sur le schéma public, la RLS fait la barrière.
  await db.exec(`
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    grant all on all tables in schema public to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
    grant all on all tables in schema storage to authenticated, service_role;
  `);
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** Crée un utilisateur (le trigger crée profil + rôle apprenant) et lui attribue des rôles. */
export async function addUser(db: TestDb, email: string, roles: string[] = [], name = email.split("@")[0]) {
  const r = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify({ full_name: name })],
  );
  const id = r.rows[0].id;
  for (const code of roles) {
    await db.query(`insert into public.user_roles (user_id, role_id) select $1, id from public.roles where code = $2`, [id, code]);
  }
  return id;
}

/** Exécute `fn` avec les droits d'un utilisateur connecté (ou anonyme si userId est null). */
export async function asUser<T>(db: TestDb, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${userId ? "authenticated" : "anon"}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}
