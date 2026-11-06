import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

async function LoginFormWithRedirect({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const { redirect } = await searchParams;
  return <LoginForm redirectTo={redirect} />;
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-3xl font-extrabold text-brand-dark">Connexion</h1>
      <p className="mt-1 text-sm text-muted">Accédez à votre espace SECURIPASS.</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-2xl bg-surface" aria-hidden />}>
        <LoginFormWithRedirect searchParams={searchParams} />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted">
        Pas encore de compte ? <Link href="/inscription" className="font-semibold text-brand hover:underline">S’inscrire</Link>
      </p>
    </div>
  );
}
