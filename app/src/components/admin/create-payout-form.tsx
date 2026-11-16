"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Calculator, CalendarDays, Check, CreditCard, FileText, Hash, Info, Landmark, Mail, Pencil, Phone, Trash2, Upload, User, UserRound, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/feedback";
import { PAYOUT_METHODS, sessionLabel } from "@/lib/admin/commissions";
import { createPayout } from "@/lib/admin/commissions-actions";
import { BANKS, MOBILE_OPERATORS, PAYOUT_PROOF_MAX_MB, payoutDetails, payoutTotals, type PayoutGroup, type PayoutInstructor, type PayoutMethod } from "@/lib/admin/payout-create";
import type { FormState } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/browser";
import { cn, formatFcfa } from "@/lib/utils";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-brand-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const lbl = "mb-1 block text-sm font-semibold text-brand-dark";
const Err = ({ e }: { e?: string[] }) => (e?.[0] ? <p role="alert" className="mt-1 text-xs text-danger">{e[0]}</p> : null);
const Req = () => <span className="text-danger">*</span>;
const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const sessionDates = (start: string | null, end: string | null) => {
  if (!start) return "—";
  const s = new Date(start), e = end ? new Date(end) : null;
  if (!e || s.toISOString().slice(0, 10) === e.toISOString().slice(0, 10)) return dayMonth.format(s);
  const sameMonth = s.toISOString().slice(0, 7) === e.toISOString().slice(0, 7);
  return sameMonth ? `${dayFmt.format(s)} - ${dayMonth.format(e)}` : `${dayMonth.format(s)} - ${dayMonth.format(e)}`;
};
const groupKey = (g: PayoutGroup) => g.ids[0];

function Step({ n, title, hint, optional, children }: { n: number; title: string; hint: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-base font-extrabold text-white" aria-hidden>{n}</span>
        <div><h2 className="text-lg font-extrabold text-brand-dark">{title}</h2><p className="text-sm text-muted">{hint}{optional && " (optionnelle)"}</p></div>
      </div>
      {children}
    </section>
  );
}

function IconField({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return <div className="relative"><Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />{children}</div>;
}

/** Nouveau versement : bénéficiaire et mode, sélection des commissions à solder, coordonnées de paiement et justificatif, avec récapitulatif. */
export function CreatePayoutForm({ instructors, today, initialInstructor }: { instructors: PayoutInstructor[]; today: string; initialInstructor: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createPayout, {});
  return <Inner state={state} action={action} pending={pending} instructors={instructors} today={today} initialInstructor={initialInstructor} />;
}

function Inner({ state, action, pending, instructors, today, initialInstructor }: {
  state: FormState; action: (f: FormData) => void; pending: boolean; instructors: PayoutInstructor[]; today: string; initialInstructor: string;
}) {
  const fe = state.fieldErrors ?? {};
  const sv = state.values ?? {};
  const [instructorId, setInstructorId] = useState(sv.instructorId ?? initialInstructor);
  const [method, setMethod] = useState<PayoutMethod | "">((sv.method as PayoutMethod) ?? "bank_transfer");
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [fees, setFees] = useState(sv.fees ?? "0");
  const [holder, setHolder] = useState(sv.holder ?? "");
  const [reason, setReason] = useState(sv.reason ?? "");
  const [proof, setProof] = useState<{ path: string; name: string; size: number } | null>(null);
  const [proofMsg, setProofMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const person = instructors.find((i) => i.id === instructorId) ?? null;
  const groups = person?.groups ?? [];
  const chosen = selected ?? new Set(groups.map(groupKey));
  const picked = groups.filter((g) => chosen.has(groupKey(g)));
  const totals = payoutTotals(picked.map((g) => g.amount), Number(fees.replace(/\s/g, "").replace(",", ".")) || 0);
  const need = payoutDetails(method);
  const banks = method === "mobile_money" ? MOBILE_OPERATORS : BANKS;

  function pickInstructor(id: string) {
    setInstructorId(id); setSelected(null);
    const p = instructors.find((i) => i.id === id);
    setHolder(p?.name ?? "");
    setReason(p ? `Versement des commissions` : "");
  }
  const toggle = (g: PayoutGroup) => setSelected(() => { const next = new Set(chosen); const k = groupKey(g); if (next.has(k)) next.delete(k); else next.add(k); return next; });
  const toggleAll = () => setSelected(picked.length === groups.length ? new Set() : new Set(groups.map(groupKey)));

  async function addProof(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setProofMsg(null);
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size > PAYOUT_PROOF_MAX_MB * 1024 * 1024) return setProofMsg(`PDF, JPG ou PNG de ${PAYOUT_PROOF_MAX_MB} Mo maximum.`);
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("auth");
      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_").slice(-80)}`;
      const { error } = await supabase.storage.from("payout-proofs").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setProof({ path, name: file.name.slice(0, 200), size: file.size });
    } catch {
      setProofMsg("Impossible d’envoyer le fichier. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={action} noValidate className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      {fe.commissionIds && <Alert>{fe.commissionIds[0]}</Alert>}
      <input type="hidden" name="proofPath" value={proof?.path ?? ""} />
      <Err e={fe.proofPath} />
      {picked.flatMap((g) => g.ids).map((id) => <input key={id} type="hidden" name="commissionIds" value={id} />)}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Step n={1} title="Informations du versement" hint="Définissez le bénéficiaire et les détails du versement.">
            <div className="grid gap-4 md:grid-cols-2">
              <div><label htmlFor="v-formateur" className={lbl}>Formateur (bénéficiaire) <Req /></label>
                <IconField icon={User}>
                  <select id="v-formateur" name="instructorId" value={instructorId} onChange={(e) => pickInstructor(e.target.value)} className={cn(input, "pl-9")} aria-invalid={!!fe.instructorId}>
                    <option value="">Choisir un formateur…</option>
                    {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </IconField><Err e={fe.instructorId} /></div>
              <div><label htmlFor="v-mode" className={lbl}>Mode de versement <Req /></label>
                <IconField icon={Landmark}>
                  <select id="v-mode" name="method" value={method} onChange={(e) => setMethod(e.target.value as PayoutMethod)} className={cn(input, "pl-9")} aria-invalid={!!fe.method}>
                    {(Object.keys(PAYOUT_METHODS) as PayoutMethod[]).map((k) => <option key={k} value={k}>{PAYOUT_METHODS[k]}</option>)}
                  </select>
                </IconField><Err e={fe.method} /></div>
              <div><label className={lbl}>Référence du versement</label>
                <IconField icon={Hash}><input readOnly value="Attribuée à l’enregistrement" className={cn(input, "bg-surface pl-9")} /></IconField></div>
              <div><label htmlFor="v-date" className={lbl}>Date de versement <Req /></label>
                <IconField icon={CalendarDays}><input id="v-date" name="paidDate" type="date" max={today} defaultValue={sv.paidDate ?? today} className={cn(input, "pl-9")} aria-invalid={!!fe.paidDate} /></IconField><Err e={fe.paidDate} /></div>
            </div>
          </Step>

          <Step n={2} title="Sélection des commissions" hint="Choisissez les commissions à inclure dans ce versement.">
            {!person ? <p className="rounded-lg bg-surface px-4 py-6 text-center text-sm text-muted">Choisissez d’abord un formateur pour voir ses commissions à verser.</p> : (
              <>
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[34rem] text-left text-sm">
                    <thead className="bg-surface text-xs text-brand-dark">
                      <tr>
                        <th scope="col" className="w-10 px-3 py-3"><input type="checkbox" aria-label="Tout sélectionner" checked={groups.length > 0 && picked.length === groups.length} onChange={toggleAll} className="h-4 w-4 rounded border-line" /></th>
                        <th scope="col" className="px-3 py-3 font-semibold">Formation / Session</th>
                        <th scope="col" className="px-3 py-3 font-semibold">Date de session</th>
                        <th scope="col" className="px-3 py-3 font-semibold">Commission</th>
                        <th scope="col" className="px-3 py-3 font-semibold">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g) => (
                        <tr key={groupKey(g)} className="border-t border-line">
                          <td className="px-3 py-3"><input type="checkbox" checked={chosen.has(groupKey(g))} onChange={() => toggle(g)} aria-label={`Inclure ${g.course_title}`} className="h-4 w-4 rounded border-line" /></td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md bg-brand-soft">{g.cover_url && <Image src={g.cover_url} alt="" fill sizes="56px" className="object-cover" unoptimized />}</span>
                              <div className="min-w-0"><p className="font-bold text-brand-dark">{g.course_title}</p><p className="text-xs text-muted">{sessionLabel(g.session_start)}</p></div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-brand-dark"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-brand" aria-hidden />{sessionDates(g.session_start, g.session_end)}</span></td>
                          <td className="whitespace-nowrap px-3 py-3 font-semibold text-brand-dark">{formatFcfa(g.amount)}</td>
                          <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 rounded-md bg-cta/15 px-3 py-1 text-xs font-semibold text-[#a16207]"><span className="h-2 w-2 rounded-full bg-cta" aria-hidden />À verser</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-soft px-4 py-3 text-sm text-brand-dark">
                  <span className="inline-flex items-center gap-2"><Info className="h-4 w-4 text-brand" aria-hidden />{picked.length} commission{picked.length > 1 ? "s" : ""} sélectionnée{picked.length > 1 ? "s" : ""}</span>
                  <span>Total à verser : <strong className="text-lg">{formatFcfa(totals.total)}</strong></span>
                </p>
              </>
            )}
          </Step>

          <Step n={3} title="Détails du paiement" hint="Coordonnées de paiement et pièce justificative" optional>
            <div className="grid gap-4 md:grid-cols-2">
              {need.holder && (
                <div><label htmlFor="v-titulaire" className={lbl}>Titulaire du compte <Req /></label>
                  <IconField icon={UserRound}><input id="v-titulaire" name="holder" value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={120} className={cn(input, "pl-9")} aria-invalid={!!fe.holder} /></IconField><Err e={fe.holder} /></div>
              )}
              {need.bank && (
                <div><label htmlFor="v-banque" className={lbl}>{need.bankLabel} <Req /></label>
                  <IconField icon={Landmark}><select id="v-banque" name="bank" key={method} defaultValue={sv.bank ?? ""} className={cn(input, "pl-9")} aria-invalid={!!fe.bank}>
                    <option value="">Choisir…</option>{banks.map((b) => <option key={b} value={b}>{b}</option>)}</select></IconField><Err e={fe.bank} /></div>
              )}
              {need.account && (
                <div><label htmlFor="v-compte" className={lbl}>{need.accountLabel} <Req /></label>
                  <IconField icon={CreditCard}><input id="v-compte" name="account" defaultValue={sv.account ?? ""} maxLength={60} autoComplete="off" className={cn(input, "pl-9")} aria-invalid={!!fe.account} /></IconField><Err e={fe.account} /></div>
              )}
              <div className={need.holder ? "" : "md:col-span-2"}><label htmlFor="v-motif" className={lbl}>Motif du versement <Req /></label>
                <IconField icon={Pencil}><input id="v-motif" name="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className={cn(input, "pl-9")} aria-invalid={!!fe.reason} /></IconField><Err e={fe.reason} /></div>
              <div><label htmlFor="v-frais" className={lbl}>Frais de transfert (FCFA)</label>
                <input id="v-frais" name="fees" inputMode="numeric" value={fees} onChange={(e) => setFees(e.target.value)} className={input} aria-invalid={!!fe.fees} /><Err e={fe.fees} /></div>
              <div className="md:col-span-2">
                <p className={lbl}>Justificatif de paiement <span className="font-normal text-muted">(optionnel)</span></p>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-brand/50 bg-brand-soft/40 px-4 py-5 text-center hover:bg-brand-soft">
                    <Upload className="h-6 w-6 text-brand" aria-hidden />
                    <span className="text-sm font-semibold text-brand">{busy ? "Envoi en cours…" : "Téléverser le justificatif"}</span>
                    <span className="text-xs text-muted">PDF, JPG, PNG (max {PAYOUT_PROOF_MAX_MB} Mo)</span>
                    <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" onChange={addProof} disabled={busy} className="sr-only" />
                  </label>
                  {proof && (
                    <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                      <FileText className="h-8 w-8 shrink-0 text-danger" aria-hidden />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-brand-dark">{proof.name}</p><p className="text-xs text-muted">{Math.max(1, Math.round(proof.size / 1024))} Ko</p></div>
                      <button type="button" onClick={() => setProof(null)} aria-label="Retirer le justificatif" className="rounded-lg p-2 text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" aria-hidden /></button>
                    </div>
                  )}
                </div>
                {proofMsg && <p role="alert" className="mt-1 text-xs text-danger">{proofMsg}</p>}
              </div>
            </div>
          </Step>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-4">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-4 flex items-center gap-3 text-lg font-extrabold text-brand-dark"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white" aria-hidden><Calculator className="h-5 w-5" /></span>Récapitulatif du versement</h2>
            <dl className="divide-y divide-line text-sm">
              <div className="flex items-center justify-between gap-3 py-3"><dt className="text-brand-dark">Formateur</dt><dd className="flex items-center gap-2 font-bold text-brand-dark">{person ? <><Avatar name={person.name} src={person.avatar_url} size={28} />{person.name}</> : "—"}</dd></div>
              <div className="flex justify-between gap-3 py-3"><dt className="text-brand-dark">Nombre de commissions</dt><dd className="font-bold text-brand-dark">{totals.count}</dd></div>
              <div className="flex justify-between gap-3 py-3"><dt className="text-brand-dark">Montant total des commissions</dt><dd className="font-bold text-brand-dark">{formatFcfa(totals.total)}</dd></div>
              <div className="flex justify-between gap-3 py-3"><dt className="text-brand-dark">Frais (si applicable)</dt><dd className="font-bold text-brand-dark">{formatFcfa(totals.fees)}</dd></div>
            </dl>
            <p className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-brand-soft px-4 py-3 text-brand"><span className="font-bold text-brand-dark">Montant net à verser</span><span className="text-xl font-extrabold">{formatFcfa(totals.net)}</span></p>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-3 flex items-center gap-3 text-lg font-extrabold text-brand-dark"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white" aria-hidden><User className="h-5 w-5" /></span>Informations du bénéficiaire</h2>
            {person ? (
              <ul className="space-y-2.5 rounded-xl bg-surface p-4 text-sm text-brand-dark">
                <li className="flex items-center gap-3"><User className="h-4 w-4 shrink-0 text-brand" aria-hidden />{person.name}</li>
                <li className="flex items-center gap-3"><Mail className="h-4 w-4 shrink-0 text-brand" aria-hidden /><span className="break-all">{person.email}</span></li>
                {person.phone && <li className="flex items-center gap-3"><Phone className="h-4 w-4 shrink-0 text-brand" aria-hidden />{person.phone}</li>}
              </ul>
            ) : <p className="text-sm text-muted">Aucun formateur sélectionné.</p>}
            <p className="mt-4 flex items-start gap-3 rounded-xl bg-success/10 px-4 py-3 text-sm text-brand-dark"><Check className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />Le versement sera enregistré et le statut des commissions sélectionnées passera à « Versée ».</p>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Link href="/admin/commissions" className="inline-flex items-center justify-center rounded-lg border border-brand bg-white px-5 py-3 text-sm font-semibold text-brand hover:bg-brand-soft">Annuler</Link>
            <button disabled={pending || busy || picked.length === 0} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50">
              <CreditCard className="h-4 w-4" aria-hidden /> {pending ? "Enregistrement…" : "Effectuer le versement"}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}
