import { Suspense } from "react";
import { connection } from "next/server";
import { CreateBlogForm } from "@/components/admin/create-blog-form";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export const metadata = { title: "Nouveau contenu" };

/** Date et heure par défaut de la publication (heure d'Abidjan, UTC+0). */
async function Form() {
  await connection();
  const now = new Date().toISOString();
  return <CreateBlogForm today={now.slice(0, 10)} nowTime={now.slice(11, 16)} />;
}

export default function NewBlogPostPage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader crumbs={[{ label: "Blog et contenus publics", href: "/admin/blog" }, { label: "Nouveau contenu" }]} icon="blog" title="Nouveau contenu" description="Créez un article, une actualité, une ressource ou une vidéo et publiez-le pour le grand public." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden />}>
        <Form />
      </Suspense>
    </div>
  );
}
