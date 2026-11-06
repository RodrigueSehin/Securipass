import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { updateUserRoles, updateUserStatus } from "@/lib/admin/users-actions";
import { loadUser } from "@/lib/admin/users-queries";
import { ROLE_CODES, ROLE_LABEL, ROLE_TONE, USER_STATUS } from "@/lib/admin/users";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Utilisateur" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ resultat?: string; erreur?: string }> };

const RESULTS: Record<string, string> = { roles: "Les rôles ont été mis à jour.", suspendu: "Le compte a été suspendu.", reactive: "Le compte a été réactivé." };

async function Detail({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const u = await loadUser(id);
  if (!u) notFound();
  const st = USER_STATUS[u.status] ?? USER_STATUS.active;
  const back = `/admin/utilisateurs/${u.id}`;

  return (
    <div className="max-w-3xl space-y-6">
      <nav aria-label="Fil d’Ariane" className="text-xs text-muted">
        <Link href="/admin" className="hover:underline">Administration</Link> <span aria-hidden>›</span> <Link href="/admin/utilisateurs" className="hover:underline">Utilisateurs</Link> <span aria-hidden>›</span> <span className="text-brand-dark">{u.full_name || u.email}</span>
      </nav>
      {sp.resultat && RESULTS[sp.resultat] && <Alert tone="success">{RESULTS[sp.resultat]}</Alert>}
      {sp.erreur && <Alert>{sp.erreur}</Alert>}

      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-card">
        <Avatar name={u.full_name || u.email} src={u.avatar_url} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-brand-dark">{u.full_name || "Sans nom"}</h1>
          <p className="text-sm text-muted">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{u.roles.map((r) => <span key={r} className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", ROLE_TONE[r])}>{ROLE_LABEL[r]}</span>)}</div>
        </div>
        <span className={cn("rounded-md px-3 py-1 text-xs font-semibold", st.tone)}>{st.label}</span>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted">Organisation</dt><dd className="font-semibold text-brand-dark">{u.organization ?? "—"}</dd></div>
          <div><dt className="text-muted">Inscription</dt><dd className="text-brand-dark">{formatDateTime(u.created_at)}</dd></div>
          <div><dt className="text-muted">Dernière connexion</dt><dd className="text-brand-dark">{u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : "Jamais"}</dd></div>
        </dl>
      </section>

      <form action={updateUserRoles} className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-card">
        <input type="hidden" name="userId" value={u.id} />
        <h2 className="text-lg font-bold text-brand-dark">Rôles</h2>
        <p className="text-sm text-muted">Un compte peut cumuler plusieurs rôles. Les droits changent à sa prochaine connexion à l’espace concerné.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLE_CODES.map((c) => (
            <label key={c} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-brand-dark">
              <input type="checkbox" name="role" value={c} defaultChecked={u.roles.includes(c)} className="h-4 w-4" /> {ROLE_LABEL[c]}
            </label>
          ))}
        </div>
        <Button type="submit">Enregistrer les rôles</Button>
      </form>

      {u.status !== "deletion_requested" && (
        <form action={updateUserStatus} className="space-y-3 rounded-2xl border border-line bg-white p-5 shadow-card">
          <input type="hidden" name="userId" value={u.id} />
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="status" value={u.status === "suspended" ? "active" : "suspended"} />
          <h2 className="text-lg font-bold text-brand-dark">Accès au compte</h2>
          <p className="text-sm text-muted">{u.status === "suspended" ? "Ce compte est suspendu : son titulaire ne peut plus accéder à ses espaces." : "Suspendre le compte empêche son titulaire d’accéder à ses espaces. Ses données sont conservées."}</p>
          <Button type="submit" variant="outline" className={u.status === "suspended" ? "" : "border-danger text-danger hover:bg-danger/10"}>{u.status === "suspended" ? "Réactiver le compte" : "Suspendre le compte"}</Button>
        </form>
      )}
    </div>
  );
}

export default function UserPage(props: Props) {
  return (
    <Suspense fallback={<div className="h-96 max-w-3xl animate-pulse rounded-2xl bg-white" aria-hidden />}>
      <Detail {...props} />
    </Suspense>
  );
}
