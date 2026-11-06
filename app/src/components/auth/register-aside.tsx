import Image from "next/image";
import Link from "next/link";
import { Bell, BarChart3, GraduationCap, IdCard, Medal, ShieldCheck } from "lucide-react";
import { publicImage } from "@/lib/images";

const BENEFITS = [
  { Icon: GraduationCap, tone: "bg-cta", title: "Suivez vos formations", text: "Apprenez à votre rythme, en ligne ou en présentiel." },
  { Icon: Medal, tone: "bg-[#1479ff]", title: "Obtenez des certificats", text: "Des certificats vérifiables avec QR Code." },
  { Icon: BarChart3, tone: "bg-success", title: "Suivez votre progression", text: "Visualisez votre avancement et vos résultats." },
  { Icon: Bell, tone: "bg-danger", title: "Recevez des notifications", text: "Soyez informé des nouvelles formations et sessions." },
  { Icon: IdCard, tone: "bg-[#7c4dff]", title: "Construisez votre profil", text: "Valorisez vos compétences avec votre Security Pass." },
] as const;

export function RegisterAside({ loginHref }: { loginHref: string }) {
  const photo = publicImage("home/agent-securite");
  return (
    <aside className="relative overflow-hidden rounded-2xl border border-line bg-[linear-gradient(160deg,#f5f8fc_0%,#eaf2ff_100%)] p-6 shadow-card md:p-8">
      {photo && (
        <div className="pointer-events-none absolute bottom-24 right-0 hidden h-[26rem] w-[55%] md:block" aria-hidden>
          <Image src={photo} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover object-[65%_30%] [mask-image:linear-gradient(to_right,transparent,black_45%),linear-gradient(to_bottom,black_70%,transparent)] [mask-composite:intersect]" />
        </div>
      )}
      <div className="relative">
        <h2 className="text-2xl font-extrabold text-brand-dark">Pourquoi créer un compte ?</h2>
        <p className="mt-1 text-sm text-muted">Accédez à un espace personnalisé et profitez de nombreux avantages.</p>
        <ul className="mt-6 space-y-5 md:max-w-[62%]">
          {BENEFITS.map(({ Icon, tone, title, text }) => (
            <li key={title} className="flex items-start gap-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white ${tone}`}><Icon className="h-6 w-6" aria-hidden /></span>
              <span><span className="block font-bold text-brand-dark">{title}</span><span className="block text-sm text-muted">{text}</span></span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-white/90 p-4">
          <ShieldCheck className="h-9 w-9 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-brand-dark">Déjà un compte ?</p>
            <p className="text-sm text-muted">Connectez-vous pour accéder à votre espace.</p>
          </div>
          <Link href={loginHref} className="rounded-lg border border-brand px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft">Se connecter</Link>
        </div>
      </div>
    </aside>
  );
}
