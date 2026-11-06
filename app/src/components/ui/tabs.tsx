"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function TabNav({ tabs, label }: { tabs: { href: string; label: string; exact?: boolean }[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={cn("whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold", active ? "border-brand text-brand" : "border-transparent text-muted hover:text-brand-dark")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
