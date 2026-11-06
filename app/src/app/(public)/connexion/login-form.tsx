"use client";

import { useActionState } from "react";
import { login, type FormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action} className="mt-6 space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card" noValidate>
      {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
      {state.error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{state.error}</p>}
      <Field label="Adresse e-mail" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} errors={state.fieldErrors?.email} />
      <Field label="Mot de passe" name="password" type="password" autoComplete="current-password" required errors={state.fieldErrors?.password} />
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Connexion…" : "Se connecter"}</Button>
    </form>
  );
}
