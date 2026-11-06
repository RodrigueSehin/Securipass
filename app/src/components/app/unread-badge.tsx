import { createClient } from "@/lib/supabase/server";

/** Pastille du nombre de notifications non lues, affichée dans la barre latérale. Données dynamiques : sous Suspense. */
export async function UnreadBadge() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  const unread = count ?? 0;
  if (unread === 0) return null;
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
      <span className="sr-only">{unread} non lue{unread > 1 ? "s" : ""}</span>
      <span aria-hidden>{unread > 99 ? "99+" : unread}</span>
    </span>
  );
}
