export function PageHero({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="bg-brand-dark text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 md:py-16">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-cta">{eyebrow}</p>}
        <h1 className="mt-2 max-w-3xl text-3xl font-extrabold md:text-4xl">{title}</h1>
        {children && <p className="mt-3 max-w-2xl text-white/80">{children}</p>}
      </div>
    </section>
  );
}

export function Section({ title, children, tone = "white" }: { title?: string; children: React.ReactNode; tone?: "white" | "soft" }) {
  return (
    <section className={tone === "soft" ? "bg-surface" : undefined}>
      <div className="mx-auto max-w-7xl px-4 py-12">
        {title && <h2 className="mb-6 text-2xl font-extrabold text-brand-dark">{title}</h2>}
        {children}
      </div>
    </section>
  );
}

export function FeatureGrid({ items }: { items: { title: string; text: string }[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => (
        <li key={i.title} className="rounded-xl border border-line bg-white p-5">
          <h3 className="font-bold text-brand-dark">{i.title}</h3>
          <p className="mt-1 text-sm text-muted">{i.text}</p>
        </li>
      ))}
    </ul>
  );
}
