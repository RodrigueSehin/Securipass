import { describe, expect, it } from "vitest";
import { FILE_MAX_MB, SLA_HOURS, categoryShares, conversationCount, conversationOf, createTicketSchema, describeEvent, filterHistory, formatDelay, formatFileSize, isAllowedFile, messageSchema, parseHistoryFilter, parseSupportFilters, type HistoryEvent, type SupportDetail } from "./support";

const id = "7d1c2b3a-1111-4222-8333-444455556666";

describe("parseSupportFilters", () => {
  it("ne garde que les valeurs connues", () => {
    expect(parseSupportFilters({ onglet: "mine", q: "  SUP-0268 ", categorie: "paiements", statut: "waiting", priorite: "high" }))
      .toEqual({ tab: "mine", q: "SUP-0268", category: "paiements", status: "waiting", priority: "high" });
    expect(parseSupportFilters({ onglet: "x", categorie: "constructor", statut: "banni", priorite: "urgente" }))
      .toEqual({ tab: "all", q: "", category: "", status: "", priority: "" });
    expect(parseSupportFilters({ q: "x".repeat(300) }).q).toHaveLength(100);
  });
});

describe("formatDelay", () => {
  it("affiche heures et minutes", () => {
    expect(formatDelay(6 * 3600 + 24 * 60)).toBe("6h 24min");
    expect(formatDelay(3600)).toBe("1h 00min");
    expect(formatDelay(45 * 60)).toBe("45min");
    expect(formatDelay(20)).toBe("< 1min");
    expect(formatDelay(2 * 86400 + 5 * 3600)).toBe("2j 5h");
    expect(formatDelay(null)).toBe("—");
    expect(formatDelay(Number.NaN)).toBe("—");
  });
});

describe("categoryShares", () => {
  it("garde cinq catégories puis regroupe le reste avec « Autres »", () => {
    const items = categoryShares([
      { category: "formations", count: 36 }, { category: "paiements", count: 23 }, { category: "certifications", count: 18 }, { category: "technique", count: 15 },
      { category: "compte", count: 15 }, { category: "sessions", count: 5 }, { category: "autres", count: 8 },
    ], 120);
    expect(items.map((i) => [i.label, i.percent])).toEqual([["Formations", 30], ["Paiements", 19], ["Certifications", 15], ["Technique", 13], ["Compte", 13], ["Autres", 11]]);
    expect(items.at(-1)!.count).toBe(13);
    expect(categoryShares([], 0)).toEqual([]);
    expect(categoryShares([{ category: "compte", count: 2 }], 2)).toEqual([{ key: "compte", label: "Compte", count: 2, percent: 100 }]);
  });
});

describe("createTicketSchema", () => {
  const base = { requesterId: id, category: "paiements", priority: "high", subject: "Problème de paiement", description: "" };
  it("accepte une demande complète et vide la description facultative", () => {
    const r = createTicketSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.description).toBeNull();
  });
  it("refuse demandeur, catégorie, priorité ou sujet invalides", () => {
    expect(createTicketSchema.safeParse({ ...base, requesterId: "x" }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...base, category: "inconnue" }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...base, priority: "urgente" }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...base, subject: " a " }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...base, description: "d".repeat(4001) }).success).toBe(false);
  });
});

describe("barème de délai", () => {
  it("est de 8 h, 24 h et 72 h selon la priorité", () => {
    expect(SLA_HOURS).toEqual({ high: 8, medium: 24, low: 72 });
  });
});

describe("formulaire de création : formation concernée", () => {
  const base = { requesterId: id, category: "formations", priority: "low", subject: "Accès refusé", description: "" };
  it("accepte une formation ou aucune, refuse un identifiant invalide", () => {
    expect(createTicketSchema.parse({ ...base, courseId: id }).courseId).toBe(id);
    expect(createTicketSchema.parse({ ...base, courseId: "" }).courseId).toBeNull();
    expect(createTicketSchema.parse(base).courseId).toBeNull();
    expect(createTicketSchema.safeParse({ ...base, courseId: "nope" }).success).toBe(false);
  });
});

describe("messageSchema", () => {
  it("accepte une réponse ou une note interne et normalise le drapeau", () => {
    expect(messageSchema.parse({ ticketId: id, body: "  Bonjour  " })).toEqual({ ticketId: id, body: "Bonjour", internal: false });
    expect(messageSchema.parse({ ticketId: id, body: "Note", internal: "1" }).internal).toBe(true);
    expect(messageSchema.parse({ ticketId: id, body: "Note", internal: "0" }).internal).toBe(false);
  });
  it("refuse un message vide ou trop long, un ticket ou un drapeau invalides", () => {
    expect(messageSchema.safeParse({ ticketId: id, body: "   " }).success).toBe(false);
    expect(messageSchema.safeParse({ ticketId: id, body: "x".repeat(5001) }).success).toBe(false);
    expect(messageSchema.safeParse({ ticketId: "x", body: "Bonjour" }).success).toBe(false);
    expect(messageSchema.safeParse({ ticketId: id, body: "Bonjour", internal: "oui" }).success).toBe(false);
  });
});

describe("pièces jointes", () => {
  it("n'accepte que PDF, images et texte de 10 Mo au maximum", () => {
    expect(isAllowedFile("application/pdf", 516_096)).toBe(true);
    expect(isAllowedFile("image/png", 1)).toBe(true);
    expect(isAllowedFile("image/png", FILE_MAX_MB * 1024 * 1024)).toBe(true);
    expect(isAllowedFile("image/png", FILE_MAX_MB * 1024 * 1024 + 1)).toBe(false);
    expect(isAllowedFile("image/png", 0)).toBe(false);
    expect(isAllowedFile("application/x-msdownload", 100)).toBe(false);
    expect(isAllowedFile("image/svg+xml", 100)).toBe(false);
  });
  it("affiche la taille en o, Ko ou Mo", () => {
    expect(formatFileSize(500)).toBe("500 o");
    expect(formatFileSize(516_096)).toBe("504 Ko");
    expect(formatFileSize(268 * 1024)).toBe("268 Ko");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1,5 Mo");
  });
});

describe("conversation", () => {
  const detail = (description: string | null, messages: SupportDetail["messages"]): SupportDetail => ({
    ticket: { id, reference: "SUP-0268", subject: "S", description, category: "formations", priority: "high", status: "in_progress", created_at: "2026-10-22T14:32:00Z", updated_at: "2026-10-22T16:20:00Z",
      resolved_at: null, assigned_to: null, course_id: null, course_title: null },
    requester: { id: "r1", name: "Kouadio Aïcha", email: "a@x.ci", phone: null, avatar_url: null, code: "APP-00125" },
    messages, files: [],
  });
  const msg = (internal: boolean, is_requester = false): SupportDetail["messages"][number] => ({ id: `m${Math.random()}`, author_id: "a", author_name: "A", author_avatar: null, internal, body: "x", created_at: "2026-10-22T15:05:00Z", is_requester });
  it("commence par la description du ticket, écrite par le demandeur", () => {
    const c = conversationOf(detail("Bonjour", [msg(false)]));
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ id: "description", author_name: "Kouadio Aïcha", is_requester: true, body: "Bonjour", created_at: "2026-10-22T14:32:00Z" });
    expect(conversationOf(detail(null, [msg(false)]))).toHaveLength(1);
  });
  it("compte les messages et réponses, sans les notes internes", () => {
    expect(conversationCount(detail("Bonjour", [msg(false), msg(true), msg(false, true)]))).toBe(3);
    expect(conversationCount(detail(null, [msg(true)]))).toBe(0);
  });
});

describe("historique", () => {
  const ev = (action: string, over: Partial<HistoryEvent> = {}): HistoryEvent => ({
    id: 1, action, occurred_at: "2026-10-22T16:20:00Z", metadata: {}, actor_id: "a1", actor_name: "Zadi Stéphane", actor_avatar: null, actor_is_requester: false,
    from_name: null, to_name: null, excerpt: null, ...over,
  });

  it("décrit la création, la copie et la priorité", () => {
    expect(describeEvent(ev("support.create"))).toMatchObject({ kind: "creation", title: "Ticket créé", detail: "Demande initiale de l’utilisateur.", actorBadge: "Support", actorName: "Zadi Stéphane" });
    expect(describeEvent(ev("support.duplicate", { metadata: { from: "SUP-0268" } }))).toMatchObject({ kind: "creation", detail: "Copie du ticket SUP-0268." });
    expect(describeEvent(ev("support.priority", { metadata: { from: "medium", to: "high" } }))).toMatchObject({ kind: "priorite", detail: "La priorité est passée de « Moyenne » à « Haute »." });
    expect(describeEvent(ev("support.category", { metadata: { from: "formations", to: "documents" } })).detail).toBe("La catégorie est passée de « Formations » à « Documents ».");
  });

  it("distingue résolution, archivage, réouverture et changement de statut", () => {
    expect(describeEvent(ev("support.status", { metadata: { from: "in_progress", to: "resolved" } }))).toMatchObject({ title: "Ticket résolu", highlight: true, icon: "check" });
    expect(describeEvent(ev("support.status", { metadata: { from: "resolved", to: "archived" } })).title).toBe("Ticket archivé");
    expect(describeEvent(ev("support.status", { metadata: { from: "resolved", to: "in_progress" } }))).toMatchObject({ title: "Ticket rouvert", detail: "Le ticket est repassé à « En cours »." });
    const s = describeEvent(ev("support.status", { metadata: { from: "in_progress", to: "waiting" } }));
    expect(s).toMatchObject({ title: "Statut mis à jour", detail: "Le statut est passé de « En cours » à « En attente »." });
    expect(s.highlight).toBe(false);
  });

  it("décrit les assignations avec les noms de responsables", () => {
    expect(describeEvent(ev("support.assign")).detail).toBe("Ticket affecté à Zadi Stéphane.");
    expect(describeEvent(ev("support.reassign", { to_name: "Paul Kouassi" }))).toMatchObject({ title: "Ticket réassigné", detail: "Ticket affecté à Paul Kouassi." });
    expect(describeEvent(ev("support.reassign", { to_name: null, from_name: "Paul Kouassi" }))).toMatchObject({ title: "Assignation retirée", detail: "Le ticket n’est plus assigné à Paul Kouassi." });
    expect(describeEvent(ev("support.unassign")).detail).toBe("Le ticket n’est plus assigné.");
    expect(describeEvent(ev("support.assign")).kind).toBe("assignation");
  });

  it("reprend un extrait des réponses et des notes, avec des points de suspension s'il est coupé", () => {
    expect(describeEvent(ev("support.reply", { excerpt: "Bonjour Aïcha" }))).toMatchObject({ kind: "messages", title: "Réponse envoyée à l’utilisateur", detail: "Bonjour Aïcha" });
    expect(describeEvent(ev("support.reply")).detail).toBe("Message de réponse ajouté dans la conversation.");
    expect(describeEvent(ev("support.note", { excerpt: "x".repeat(140) })).detail).toBe(`${"x".repeat(140)}…`);
    expect(describeEvent(ev("support.note", { excerpt: "Courte" }))).toMatchObject({ title: "Note interne ajoutée", detail: "Courte" });
  });

  it("décrit les pièces jointes et tolère une action inconnue", () => {
    expect(describeEvent(ev("support.file.add", { metadata: { name: "Capture.pdf" } }))).toMatchObject({ kind: "fichiers", title: "Pièce jointe ajoutée", detail: "Capture.pdf" });
    expect(describeEvent(ev("support.file.remove", { metadata: { name: "Capture.pdf" } })).title).toBe("Pièce jointe retirée");
    expect(describeEvent(ev("support.autre"))).toMatchObject({ title: "autre", detail: "" });
  });

  it("indique l'auteur : demandeur, équipe ou système", () => {
    expect(describeEvent(ev("support.create", { actor_is_requester: true })).actorBadge).toBe("Demandeur");
    expect(describeEvent(ev("support.create", { actor_id: null, actor_name: null }))).toMatchObject({ actorBadge: "Système", actorName: "Système" });
  });

  it("filtre par type d'événement et ignore un filtre inconnu", () => {
    const entries = [ev("support.create"), ev("support.reply"), ev("support.note"), ev("support.status", { metadata: { to: "waiting" } })].map(describeEvent);
    expect(filterHistory(entries, "all")).toHaveLength(4);
    expect(filterHistory(entries, "messages")).toHaveLength(2);
    expect(filterHistory(entries, "statut")).toHaveLength(1);
    expect(filterHistory(entries, "fichiers")).toHaveLength(0);
    expect(parseHistoryFilter("messages")).toBe("messages");
    expect(parseHistoryFilter("zzz")).toBe("all");
    expect(parseHistoryFilter(undefined)).toBe("all");
  });
});
