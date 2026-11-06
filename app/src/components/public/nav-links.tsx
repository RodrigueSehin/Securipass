"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "@/config/nav";

type Cat = { slug: string; name: string };

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function List({ pathname, categories }: { pathname: string | null; categories: Cat[] }) {
  return (
    <ul className="flex items-center gap-7">
      {NAV.map((n) => {
        const active = isActive(pathname, n.href);
        const link = (
          <Link
            href={n.href} aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1 border-b-2 py-5 text-sm font-semibold transition-colors",
              active ? "border-cta text-brand" : "border-transparent text-brand-dark hover:text-brand",
            )}
          >
            {n.label}
            {"menu" in n && <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
          </Link>
        );
        if (!("menu" in n) || categories.length === 0) return <li key={n.href}>{link}</li>;
        // Menu déroulant sans JavaScript : s'ouvre au survol et au focus clavier.
        return (
          <li key={n.href} className="group relative">
            {link}
            <div className="invisible absolute left-0 top-full z-50 w-72 rounded-xl border border-line bg-white p-2 opacity-0 shadow-card transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <ul>
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/formations?categorie=${c.slug}`} className="block rounded-lg px-3 py-2 text-sm text-brand-dark hover:bg-brand-soft">{c.name}</Link>
                  </li>
                ))}
                <li className="mt-1 border-t border-line pt-1">
                  <Link href="/formations" className="block rounded-lg px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">Tout le catalogue →</Link>
                </li>
              </ul>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Active({ categories }: { categories: Cat[] }) {
  const pathname = usePathname();
  return <List pathname={pathname} categories={categories} />;
}

export function NavLinks({ categories }: { categories: Cat[] }) {
  return (
    <nav aria-label="Navigation principale" className="hidden lg:block">
      <Suspense fallback={<List pathname={null} categories={categories} />}>
        <Active categories={categories} />
      </Suspense>
    </nav>
  );
}

/** Navigation mobile : liens défilables, sans JavaScript. */
export function MobileNav() {
  return (
    <nav aria-label="Navigation mobile" className="flex gap-5 overflow-x-auto border-t border-line px-4 py-2.5 lg:hidden">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className="shrink-0 text-sm font-semibold text-brand-dark">{n.label}</Link>
      ))}
    </nav>
  );
}
