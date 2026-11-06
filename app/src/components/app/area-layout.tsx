import { Suspense } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { AppShell } from "./app-shell";
import { UserMenu, UserMenuFallback } from "./user-menu";
import { NotificationsBell } from "./notifications-bell";
import { UnreadBadge } from "./unread-badge";
import { SearchForm } from "./search-form";
import type { AreaNav } from "@/config/navigation";

export function AreaLayout({ nav, roleLabel, notifications = false, messagesHref, search, children }: {
  nav: AreaNav;
  /** Rôle affiché sous le nom dans le menu du compte. */
  roleLabel: string;
  notifications?: boolean;
  /** Lien de l'icône de messagerie dans l'en-tête, quand l'espace dispose d'une messagerie. */
  messagesHref?: string;
  search?: { action: string };
  children: React.ReactNode;
}) {
  return (
    <AppShell
      nav={nav}
      searchSlot={search && <SearchForm action={search.action} />}
      badges={notifications ? { "/app/notifications": <Suspense fallback={null}><UnreadBadge /></Suspense> } : undefined}
      userSlot={
        <div className="flex items-center gap-3">
          {notifications && <Suspense fallback={null}><NotificationsBell /></Suspense>}
          {messagesHref && (
            <Link href={messagesHref} aria-label="Messages" className="rounded-lg p-2 text-brand-dark hover:bg-brand-soft">
              <MessageSquare className="h-5 w-5" aria-hidden />
            </Link>
          )}
          <Suspense fallback={<UserMenuFallback />}><UserMenu roleLabel={roleLabel} currentHome={nav.home} /></Suspense>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
