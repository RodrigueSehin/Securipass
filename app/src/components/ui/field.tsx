import { cn } from "@/lib/utils";

const inputClass = (err?: string) =>
  cn(
    "w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-surface disabled:text-muted",
    err ? "border-danger" : "border-line",
  );

function FieldShell({
  id, label, error, hint, className, children,
}: { id: string; label: string; error?: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-brand-dark">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

type Common = { label: string; name: string; errors?: string[]; hint?: string };

/** `id` est facultatif : à fournir quand plusieurs formulaires portant les mêmes noms de champs sont affichés. */
export function Field({
  label, name, errors, hint, className, id: idProp, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & Common) {
  const id = idProp ?? `f-${name}`;
  const err = errors?.[0];
  return (
    <FieldShell id={id} label={label} error={err} hint={hint} className={className}>
      <input id={id} name={name} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined} className={inputClass(err)} {...props} />
    </FieldShell>
  );
}

export function TextareaField({
  label, name, errors, hint, className, id: idProp, ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & Common) {
  const id = idProp ?? `f-${name}`;
  const err = errors?.[0];
  return (
    <FieldShell id={id} label={label} error={err} hint={hint} className={className}>
      <textarea id={id} name={name} rows={5} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined} className={inputClass(err)} {...props} />
    </FieldShell>
  );
}

export function SelectField({
  label, name, errors, hint, className, children, id: idProp, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & Common) {
  const id = idProp ?? `f-${name}`;
  const err = errors?.[0];
  return (
    <FieldShell id={id} label={label} error={err} hint={hint} className={className}>
      <select id={id} name={name} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined} className={inputClass(err)} {...props}>{children}</select>
    </FieldShell>
  );
}
