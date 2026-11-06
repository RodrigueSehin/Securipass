import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Police auto-hébergée : pas de dépendance réseau à Google, utile en connexion variable.
const inter = localFont({
  src: "./fonts/Inter-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SECURIPASS — Former · Certifier · Sécuriser",
    template: "%s | SECURIPASS",
  },
  description:
    "Plateforme de formation et de certification professionnelle en sécurité : gardiennage, secourisme, sécurité incendie et prévention des risques.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
