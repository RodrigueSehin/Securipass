import { Suspense } from "react";
import type { Metadata } from "next";
import { CatalogueHero } from "@/components/catalogue/catalogue-hero";
import { CatalogueListing } from "@/components/catalogue/catalogue-listing";
import type { RawParams } from "@/lib/courses/filters";

export const metadata: Metadata = { title: "Catalogue des formations" };

type SP = Promise<RawParams>;

export default function CoursesPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <CatalogueHero />
      <Suspense fallback={<div className="mx-auto h-96 max-w-7xl animate-pulse px-4 py-6" aria-hidden />}>
        <CatalogueListing searchParams={searchParams} basePath="/formations" />
      </Suspense>
    </>
  );
}
