import Link from "next/link";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  cta: "bg-cta text-white hover:bg-cta-dark",
  outline: "border border-brand text-brand bg-white hover:bg-brand-soft",
  ghost: "text-brand-dark hover:bg-brand-soft",
} as const;

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type Variant = keyof typeof variants;

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={cn(base, variants[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cn(base, variants[variant], className)} {...props} />;
}
