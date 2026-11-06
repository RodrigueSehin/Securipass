import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/** Cloche de l'en-tête : nombre de notifications non lues (lien vers la liste). Données dynamiques : sous Suspense. */
export async function NotificationsBell() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  const unread = count ?? 0;
  return (
    <Link
      href="/app/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}
      className="relative rounded-lg p-2 text-brand-dark hover:bg-brand-soft"
    >
      <Bell className="h-5 w-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white" aria-hidden>
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
