"use client";

import { useRef } from "react";
import { reassignSupportTicket, setSupportCategory, setSupportPriority, setSupportStatus } from "@/lib/admin/support-actions";
import {
  SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, SUPPORT_STATUS, type SupportCategory, type SupportDetail, type SupportPriority, type SupportStaff, type SupportStatus,
} from "@/lib/admin/support";
import { cn } from "@/lib/utils";

const select = "w-full rounded-lg border border-line bg-white px-2.5 py-2 text-sm font-semibold text-brand-dark";

/** Liste qui s'applique dès le choix : le formulaire qui la porte est envoyé au changement. */
function AutoSelect({ action, name, value, ticketId, back, children, className, label }: {
  action: (formData: FormData) => void | Promise<void>; name: string; value: string; ticketId: string; back: string; children: React.ReactNode; className?: string; label: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="back" value={back} />
      <select name={name} defaultValue={value} aria-label={label} onChange={() => form.current?.requestSubmit()} className={cn(select, className)}>{children}</select>
    </form>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <><span className="text-sm text-brand-dark">{label}</span><div>{children}</div></>;
}

/** Statut, priorité, catégorie et responsable du ticket, modifiables sur place. */
export function TicketFields({ ticket, staff, back }: { ticket: SupportDetail["ticket"]; staff: SupportStaff[]; back: string }) {
  const closed = ticket.status === "resolved" || ticket.status === "archived";
  const st = SUPPORT_STATUS[ticket.status];
  const pr = SUPPORT_PRIORITIES[ticket.priority];
  const known = staff.some((s) => s.id === ticket.assigned_to);
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
      <Row label="Statut"><AutoSelect action={setSupportStatus} name="status" value={ticket.status} ticketId={ticket.id} back={back} label="Statut" className={st.tone}>
        {(Object.keys(SUPPORT_STATUS) as SupportStatus[]).map((k) => <option key={k} value={k} disabled={k === "archived" && ticket.status !== "resolved" && ticket.status !== "archived"}>{SUPPORT_STATUS[k].label}</option>)}
      </AutoSelect></Row>
      <Row label="Priorité"><AutoSelect action={setSupportPriority} name="priority" value={ticket.priority} ticketId={ticket.id} back={back} label="Priorité" className={pr.tone}>
        {(Object.keys(SUPPORT_PRIORITIES) as SupportPriority[]).map((k) => <option key={k} value={k}>{SUPPORT_PRIORITIES[k].label}</option>)}
      </AutoSelect></Row>
      <Row label="Catégorie"><AutoSelect action={setSupportCategory} name="category" value={ticket.category} ticketId={ticket.id} back={back} label="Catégorie">
        {(Object.keys(SUPPORT_CATEGORIES) as SupportCategory[]).map((k) => <option key={k} value={k}>{SUPPORT_CATEGORIES[k]}</option>)}
      </AutoSelect></Row>
      <Row label="Assigné à"><AutoSelect action={reassignSupportTicket} name="assignee" value={ticket.assigned_to ?? ""} ticketId={ticket.id} back={back} label="Assigné à">
        <option value="">Non assigné</option>
        {!known && ticket.assigned_to && <option value={ticket.assigned_to}>Ancien responsable</option>}
        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </AutoSelect></Row>
      {closed && <p className="col-span-2 text-xs text-muted">Ticket clos : rouvrez-le pour le réassigner.</p>}
    </div>
  );
}
