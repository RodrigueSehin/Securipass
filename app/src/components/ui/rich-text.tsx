import { parseRichText, type Inline } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((n, i) => {
        switch (n.t) {
          case "bold": return <strong key={i} className="font-semibold text-brand-dark">{n.v}</strong>;
          case "italic": return <em key={i}>{n.v}</em>;
          case "underline": return <u key={i}>{n.v}</u>;
          case "link": return <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline">{n.v}</a>;
          default: return <span key={i}>{n.v}</span>;
        }
      })}
    </>
  );
}

/** Affiche un texte enrichi (voir lib/rich-text) sans jamais injecter de HTML. */
export function RichText({ text, className }: { text: string | null | undefined; className?: string }) {
  const blocks = parseRichText(text);
  return (
    <div className={cn("space-y-3 text-[15px] leading-relaxed text-muted", className)}>
      {blocks.map((b, i) => {
        if (b.t === "h") {
          const H = b.level === 3 ? "h3" : "h4";
          return <H key={i} className="font-bold text-brand-dark"><Inlines items={b.inline} /></H>;
        }
        if (b.t === "ul" || b.t === "ol") {
          const List = b.t;
          return <List key={i} className={cn("space-y-1 pl-5", List === "ul" ? "list-disc" : "list-decimal")}>{b.items.map((it, j) => <li key={j}><Inlines items={it} /></li>)}</List>;
        }
        return (
          <p key={i}>
            {b.lines.map((l, j) => <span key={j}>{j > 0 && <br />}<Inlines items={l} /></span>)}
          </p>
        );
      })}
    </div>
  );
}

