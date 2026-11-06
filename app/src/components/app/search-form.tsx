import { Search } from "lucide-react";

/** Recherche de l’en-tête : envoie la saisie au catalogue (paramètre q), sans JavaScript. */
export function SearchForm({ action }: { action: string }) {
  return (
    <form action={action} role="search" className="relative hidden w-full max-w-xl md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
      <input
        name="q"
        type="search"
        placeholder="Rechercher une formation, un mot-clé…"
        aria-label="Rechercher une formation"
        className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </form>
  );
}
