import Link from "next/link";
import { CalendarDays, Download, FileText, Image as ImageIcon, Info, Maximize2, Paperclip, Trash2 } from "lucide-react";
import { RowMenu } from "@/components/admin/row-menu";
import { AttachFileButton } from "@/components/admin/support-attachments";
import { Avatar } from "@/components/ui/avatar";
import { formatFileSize, type SupportFile } from "@/lib/admin/support";
import { removeSupportFile } from "@/lib/admin/support-actions";
import { cn } from "@/lib/utils";

const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Abidjan" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const kindOf = (f: SupportFile) => (f.mime === "application/pdf" ? "PDF" : f.mime?.startsWith("image/") ? (f.mime.split("/")[1] ?? "IMG").toUpperCase().replace("JPEG", "JPG") : "TXT");

/** Onglet « Pièces jointes » : tableau des fichiers, total et aperçu du fichier sélectionné (le premier par défaut). */
export function SupportFilesTab({ ticketId, files, selectedId, archived, base }: { ticketId: string; files: SupportFile[]; selectedId?: string; archived: boolean; base: string }) {
  const selected = files.find((f) => f.id === selectedId) ?? files[0];
  const total = files.reduce((sum, f) => sum + f.size, 0);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Paperclip className="mt-1 h-6 w-6 text-brand" aria-hidden />
          <div><h3 className="text-lg font-extrabold text-brand-dark">Pièces jointes du ticket</h3><p className="text-sm text-muted">Consultez, téléchargez ou ajoutez des fichiers liés à cette demande.</p></div>
        </div>
        <div className="w-full sm:w-auto"><AttachFileButton ticketId={ticketId} disabled={archived} variant="primary" /></div>
      </div>

      {files.length === 0 ? <p className="rounded-lg bg-surface px-4 py-8 text-center text-sm text-muted">Aucune pièce jointe pour le moment.</p> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-brand-soft/60 text-xs font-extrabold text-brand-dark">
                <tr><th className="px-4 py-3">Nom du fichier</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Taille</th><th className="px-3 py-3">Ajouté par</th><th className="px-3 py-3">Date d’ajout</th><th className="px-3 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {files.map((f) => {
                  const image = f.mime?.startsWith("image/");
                  const Icon = image ? ImageIcon : FileText;
                  const who = f.uploader_name ?? "—";
                  return (
                    <tr key={f.id} className={cn(f.id === selected?.id && "bg-brand-soft/40")}>
                      <td className="px-4 py-3">
                        <Link href={`${base}?onglet=pieces-jointes&fichier=${f.id}`} className="flex items-center gap-3 font-bold text-brand-dark hover:text-brand" aria-current={f.id === selected?.id ? "true" : undefined}>
                          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", image ? "bg-brand-soft text-brand" : "bg-danger/10 text-danger")} aria-hidden><Icon className="h-5 w-5" /></span>
                          <span className="break-all">{f.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3"><span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", image ? "bg-brand-soft text-brand" : "bg-danger/10 text-danger")}>{kindOf(f)}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{formatFileSize(f.size)}</td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-2"><Avatar name={who} src={f.uploader_avatar} size={32} /><span><span className="block font-bold text-brand-dark">{who}</span><span className="block text-xs text-muted">{f.is_requester ? "Apprenant" : "Support"}</span></span></span>
                      </td>
                      <td className="px-3 py-3 text-xs text-brand-dark"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-brand" aria-hidden /><span>{dayFmt.format(new Date(f.created_at))}<br />à {timeFmt.format(new Date(f.created_at))}</span></span></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <a href={`/admin/support/fichiers/${f.id}`} download aria-label={`Télécharger ${f.name}`} className="rounded-lg border border-line p-2 text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /></a>
                          <RowMenu label={`Actions pour ${f.name}`}>
                            <form action={removeSupportFile}>
                              <input type="hidden" name="fileId" value={f.id} /><input type="hidden" name="back" value={base} />
                              <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-danger hover:bg-brand-soft"><Trash2 className="h-4 w-4" aria-hidden />Retirer</button>
                            </form>
                          </RowMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 flex items-center gap-2 rounded-lg bg-brand-soft/60 px-4 py-3 text-sm text-brand-dark"><Info className="h-4 w-4 text-brand" aria-hidden />{files.length} fichier{files.length > 1 ? "s" : ""} ({formatFileSize(total)} au total)</p>

          {selected && (
            <section className="mt-4 overflow-hidden rounded-xl border border-line" aria-label={`Aperçu de ${selected.name}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <p className="flex min-w-0 items-center gap-3 font-extrabold text-brand-dark">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", selected.mime?.startsWith("image/") ? "bg-brand-soft text-brand" : "bg-danger/10 text-danger")} aria-hidden>{selected.mime?.startsWith("image/") ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span>
                  <span className="truncate">{selected.name}</span>
                </p>
                <div className="flex items-center gap-3 text-xs text-brand-dark">
                  <span>{formatFileSize(selected.size)} | Ajouté le {dayFmt.format(new Date(selected.created_at))} à {timeFmt.format(new Date(selected.created_at))}</span>
                  <a href={`/admin/support/fichiers/${selected.id}`} download aria-label="Télécharger" className="rounded-lg border border-line p-2 text-brand hover:bg-brand-soft"><Download className="h-4 w-4" aria-hidden /></a>
                  <a href={`/admin/support/fichiers/${selected.id}?apercu=1`} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir dans un nouvel onglet" className="rounded-lg border border-line p-2 text-brand hover:bg-brand-soft"><Maximize2 className="h-4 w-4" aria-hidden /></a>
                </div>
              </div>
              <div className="bg-[#2f3441] p-3">
                {selected.mime === "application/pdf" || selected.mime === "text/plain" ? (
                  <iframe title={`Aperçu de ${selected.name}`} src={`/admin/support/fichiers/${selected.id}?apercu=1`} className="h-[28rem] w-full rounded bg-white" />
                ) : selected.mime?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/admin/support/fichiers/${selected.id}?apercu=1`} alt={selected.name} className="mx-auto max-h-[28rem] rounded bg-white object-contain" />
                ) : <p className="py-10 text-center text-sm text-white">Aperçu indisponible pour ce type de fichier.</p>}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
