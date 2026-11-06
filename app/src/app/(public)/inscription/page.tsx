import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, Headphones, Lock, ShieldCheck, UsersRound } from "lucide-react";
import { RegisterAside } from "@/components/auth/register-aside";
import { RegisterWizard } from "@/components/auth/register-wizard";
import { categoryUi } from "@/content/categories";
import { safeRedirect } from "@/lib/auth/schemas";
import { getCategories } from "@/lib/courses/queries";
import { publicImage } from "@/lib/images";

export const metadata: Metadata = { title: "Créer un compte" };

type SP = Promise<{ redirect?: string }>;

const ASSURANCES = [
  { Icon: ShieldCheck, title: "Inscription gratuite", text: "Créez votre compte gratuitement" },
  { Icon: UsersRound, title: "Accès rapide", text: "En quelques minutes seulement" },
  { Icon: Lock, title: "Données sécurisées", text: "Vos informations sont protégées" },
  { Icon: Headphones, title: "Assistance dédiée", text: "Notre équipe vous accompagne" },
] as const;

function Hero() {
  const photo = publicImage("home/hero");
  return (
    <section className="relative overflow-hidden bg-brand-dark text-white">
      {photo && (
        <div className="absolute inset-y-0 right-0 w-full opacity-25 md:w-[50%] md:opacity-100" aria-hidden>
          <Image src={photo} alt="" fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover object-[35%_25%]" />
          <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,#092a66_0%,#092a66d9_22%,#092a6600_65%)] md:block" />
        </div>
      )}
      <div className="relative mx-auto max-w-7xl px-4 py-9 md:py-12">
        <nav aria-label="Fil d’Ariane" className="flex items-center gap-1.5 text-xs text-white/80">
          <Link href="/" className="hover:text-white">Accueil</Link><ChevronRight className="h-3 w-3" aria-hidden />
          <span aria-current="page" className="text-white">Inscription</span>
        </nav>
        <h1 className="mt-4 text-3xl font-extrabold md:text-5xl">Créer un <span className="text-cta">compte</span></h1>
        <p className="mt-3 max-w-xl text-white/85 md:text-lg">
          Rejoignez SECURIPASS et développez vos compétences en sécurité, secourisme et sécurité incendie.
        </p>
      </div>
    </section>
  );
}

async function Content({ searchParams }: { searchParams: SP }) {
  const { redirect } = await searchParams;
  const target = redirect ? safeRedirect(redirect, "/app") : undefined;
  const categories = (await getCategories()).map((c) => ({ slug: c.slug, label: categoryUi(c.slug, c.name).label }));
  const loginHref = target ? `/connexion?redirect=${encodeURIComponent(target)}` : "/connexion";
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1fr_1.15fr]">
      {/* Sur mobile, le formulaire passe avant l'argumentaire ; sur ordinateur l'ordre de la maquette est conservé. */}
      <div className="order-2 lg:order-1"><RegisterAside loginHref={loginHref} /></div>
      <div className="order-1 lg:order-2"><RegisterWizard redirectTo={target} categories={categories} /></div>
    </div>
  );
}

export default function RegisterPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <Hero />
      <Suspense fallback={<div className="mx-auto h-[40rem] max-w-7xl animate-pulse px-4 py-8" aria-hidden />}>
        <Content searchParams={searchParams} />
      </Suspense>
      <section className="bg-surface" aria-label="Nos engagements">
        <ul className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-line">
          {ASSURANCES.map(({ Icon, title, text }) => (
            <li key={title} className="flex items-center gap-4 lg:px-6">
              <Icon className="h-10 w-10 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />
              <span><span className="block font-bold text-brand-dark">{title}</span><span className="block text-sm text-muted">{text}</span></span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
