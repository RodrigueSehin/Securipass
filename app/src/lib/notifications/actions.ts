"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/auth/schemas";

/** Marque une seule notification comme lue, puis revient à la liste (filtres conservés). */
export async function markNotificationRead(formData: FormData): Promise<void> {
  const back = safeRedirect(formData.get("returnTo")?.toString(), "/app/notifications");
  const id = z.string().uuid().safeParse(formData.get("notificationId"));
  if (id.success) {
    const supabase = await createClient();
    await supabase.rpc("mark_notifications_read", { p_ids: [id.data] });
  }
  revalidatePath("/app", "layout");
  redirect(back);
}
