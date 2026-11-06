"use client";

import { useActionState } from "react";
import { Lock, Mail } from "lucide-react";
import { submitRequest } from "@/lib/requests/actions";
import type { FormState } from "@/lib/auth/actions";

export function Newsletter() {
  const [state, action, pending] = useActionState<FormState, FormData>(submitRequest, {});
  const err = state.fieldErrors?.email?.[0] ?? state.error;

  return (
    <section aria-labelledby="newsletter-title" className="rounded-xl bg-brand-dark p-6 text-white md:px-8 md:py-7">
      <div className="grid items-center gap-6 lg:grid-cols-[auto_1fr_minmax(0,620px)]">
        <span className="hidden h-[84px] w-[84px] items-center justify-center rounded-full bg-white text-brand-dark lg:flex"><Mail className="h-10 w-10" strokeWidth={1.75} aria-hidden /></span>
        <div>
          <h2 id="newsletter-title" className="text-2xl font-extrabold">Abonnez-vous à notre newsletter</h2>
          <p className="mt-1 text-sm text-white/90 md:text-base">Recevez nos derniers articles, conseils et actualités directement dans votre boîte mail.</p>
        </div>
        {state.message ? (
          <p role="status" className="rounded-lg bg-white/10 p-3 text-sm">{state.message}</p>
        ) : (
          <form action={action} noValidate>
            <input type="hidden" name="kind" value="newsletter" />
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>Ne pas remplir<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
            </div>
            <div className="flex overflow-hidden rounded-lg bg-white">
              <label htmlFor="newsletter-email" className="sr-only">Votre adresse email</label>
              <input id="newsletter-email" name="email" type="email" required autoComplete="email" placeholder="Votre adresse email" aria-invalid={!!err}
                className="min-w-0 flex-1 px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-inset focus:ring-cta" />
              <button type="submit" disabled={pending} className="bg-cta px-6 text-sm font-semibold text-white transition-colors hover:bg-cta-dark disabled:opacity-60">{pending ? "Envoi…" : "S’abonner"}</button>
            </div>
            {err && <p role="alert" className="mt-2 text-xs text-[#ffb4b1]">{err}</p>}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-white/75"><Lock className="h-3.5 w-3.5" aria-hidden />Pas de spam. Désabonnement à tout moment.</p>
          </form>
        )}
      </div>
    </section>
  );
}
