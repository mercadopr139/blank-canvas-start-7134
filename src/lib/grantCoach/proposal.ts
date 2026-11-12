// A grant delivered as a written proposal (Josh, 2026-11-12, the Avalon Lions
// special grant: a letter RFP with four items, answered by a proposal emailed
// back). Every grant before it was an online portal with copy/paste boxes.
// This file holds what is different about a proposal: the delivery setting,
// the proposal's setup (who it goes to, who signs), the itemized cost estimate
// as lines the page can add up, and the attachment check (a row that asks for
// a 990 should not carry the determination letter).

export type Delivery = "portal" | "proposal";

export const DELIVERY_LABEL: Record<Delivery, string> = { portal: "Online portal", proposal: "Written proposal" };

export const asDelivery = (v: unknown): Delivery => (v === "proposal" ? "proposal" : "portal");

/** Who the proposal goes to, its subject line, and who signs it — kept on the folder (grant_folders.proposal). */
export interface ProposalSetup {
  to_name: string;
  to_title: string;
  to_org: string;
  /** Lines of the address, newline-separated. */
  to_address: string;
  subject: string;
  /** "Josh Mercado, Program Director" */
  signer: string;
  /** The closing paragraph before "Sincerely"; empty = the page's default. */
  closing?: string;
}

export const EMPTY_SETUP: ProposalSetup = { to_name: "", to_title: "", to_org: "", to_address: "", subject: "", signer: "", closing: "" };

/** The closing paragraph as printed: Josh's own, or the default built from the signer. */
export const closingText = (setup: ProposalSetup) =>
  setup.closing?.trim() || `Thank you for considering this request. ${setup.signer.trim() ? `${setup.signer.trim().split(",")[0]} is` : "We are"} available for any questions and for an interview.`;

/** The setup with the blanks filled from what the folder and the Vault already know. */
export function defaultSetup(saved: Partial<ProposalSetup> | null | undefined, folder: { name: string; funder: string; amount_requested: number | null; program_name: string | null }, signerFromVault: string | null): ProposalSetup {
  const s = { ...EMPTY_SETUP, ...(saved ?? {}) };
  if (!s.to_org.trim()) s.to_org = folder.funder.trim();
  if (!s.subject.trim()) s.subject = [folder.name.trim(), folder.amount_requested != null ? `request for $${Number(folder.amount_requested).toLocaleString()}` : null].filter(Boolean).join(" — ");
  if (!s.signer.trim() && signerFromVault?.trim()) s.signer = signerFromVault.trim();
  return s;
}

/** A row that asks for the cost estimate / budget: its answer is lines the page adds up. */
export const isCostItem = (label: string) => /\b(cost estimate|itemi[sz]ed|budget|cost of each|line.item)\b/i.test(label);

/** A row that is contact information: printed as a block, not a paragraph. */
export const isContactItem = (label: string) => /\bcontact\b/i.test(label);

export interface CostLine { item: string; /** null = the line carries no figure yet; the table prints a blank. */ amount: number | null }
export interface CostGroup { heading: string | null; /** The figure on the heading line itself ("Equipment purchase — $8,000"), if any. */ amount: number | null; lines: CostLine[] }
export interface CostTable {
  groups: CostGroup[];
  /** The priced item lines added up; when no item is priced, the group figures added up. */
  total: number;
  /** Priced item lines. */
  lineCount: number;
  /** Lines that look like items but carry no dollar figure. */
  unpriced: string[];
}

/** A group's figure as printed: its own, or its priced lines added up. */
export const groupAmount = (g: CostGroup) => {
  const priced = g.lines.filter((l) => l.amount != null);
  return priced.length ? priced.reduce((s, l) => s + (l.amount ?? 0), 0) : g.amount;
};

const AMOUNT_RE = /(?:[—–\-:]\s*)?\$\s?([\d,]+(?:\.\d{1,2})?)\s*$/;
const GROUP_TOTAL_RE = /^(.*?)\s*[—–\-:]?\s*(?:subtotal|total)?\s*\$\s?[\d,]+(?:\.\d{1,2})?\s*$/i;

/** Read a cost estimate written as lines: a heading line, then "- item — $1,234" lines under it; "Total" lines are ignored (the page adds it up). */
export function parseCostLines(answer: string | null | undefined): CostTable {
  const groups: CostGroup[] = [];
  const unpriced: string[] = [];
  let current: CostGroup | null = null;
  let total = 0, lineCount = 0;
  for (const raw of (answer ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(total|grand total|total request)\b/i.test(line)) continue;
    const bullet = /^[-•*]\s+/.test(line);
    const text = line.replace(/^[-•*]\s+/, "");
    const m = text.match(AMOUNT_RE);
    if (bullet) {
      if (!current) { current = { heading: null, amount: null, lines: [] }; groups.push(current); }
      if (m) {
        const amount = Number(m[1].replace(/,/g, ""));
        current.lines.push({ item: text.slice(0, m.index).replace(/[—–\-:]\s*$/, "").trim(), amount });
        total += amount; lineCount += 1;
      } else { current.lines.push({ item: text, amount: null }); unpriced.push(text); }
      continue;
    }
    // A heading, with or without its own figure ("Equipment purchase — $8,000": the figure is the group's, the lines are what count).
    const g = text.match(GROUP_TOTAL_RE);
    const heading = (g ? g[1] : text).replace(/[—–\-:]\s*$/, "").trim();
    // A long sentence is prose around the table, not a heading.
    if (heading.split(/\s+/).length > 12 || /[.!?]$/.test(heading)) continue;
    current = { heading, amount: m ? Number(m[1].replace(/,/g, "")) : null, lines: [] };
    groups.push(current);
  }
  const kept = groups.filter((g) => g.lines.length);
  // Nothing priced line by line: the group figures are the estimate.
  if (!lineCount) total = kept.reduce((s, g) => s + (g.amount ?? 0), 0);
  return { groups: kept, total, lineCount, unpriced };
}

export const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** One line for the row, or null when the estimate is itemized and adds up to the request. */
export function costCheck(answer: string | null | undefined, amountRequested: number | null): string | null {
  const t = parseCostLines(answer);
  if (t.unpriced.length) return `${t.unpriced.length} line${t.unpriced.length === 1 ? " has" : "s have"} no dollar figure: ${t.unpriced.slice(0, 3).join("; ")}${t.unpriced.length > 3 ? "…" : ""}.`;
  if (!t.lineCount) return "Not itemized yet: write each item on its own line as “- item — $amount”, with a heading line above each group.";
  if (amountRequested != null && Math.round(t.total) !== Math.round(amountRequested)) return `The lines add up to ${money(t.total)}; the request is ${money(amountRequested)}.`;
  return null;
}

/** The cost estimate as the writer and the hardcopy's text form read it. */
export function costTableText(t: CostTable): string {
  const out: string[] = [];
  for (const g of t.groups) {
    const ga = groupAmount(g);
    if (g.heading) out.push(ga != null ? `${g.heading} — ${money(ga)}` : g.heading);
    for (const l of g.lines) out.push(l.amount != null ? `- ${l.item} — ${money(l.amount)}` : `- ${l.item}`);
    out.push("");
  }
  out.push(`Total — ${money(t.total)}`);
  return out.join("\n").trim();
}

/* ───── The attachment check ───── */

interface Expected { name: string; is: RegExp; isNot?: { name: string; re: RegExp }[] }
const DETERMINATION = { name: "the IRS determination letter", re: /determination|501\s*\(?c\)?\s*\(?3\)?|exempt(ion)? status|non-?profit status|tax.exempt/i };
const EXPECTED: { asks: RegExp; expect: Expected }[] = [
  { asks: /\b990\b/, expect: { name: "Form 990 or 990-EZ", is: /\b990\b|return of organization exempt/i, isNot: [DETERMINATION, { name: "an audit", re: /audit/i }] } },
  { asks: /\baudit/i, expect: { name: "an audit", is: /audit/i, isNot: [{ name: "a Form 990", re: /\b990\b/ }, DETERMINATION] } },
  { asks: /determination|501\s*\(?c\)?|exempt|non-?profit status/i, expect: { name: "the IRS determination letter", is: DETERMINATION.re, isNot: [{ name: "a Form 990", re: /\b990\b/ }] } },
  { asks: /\bw-?9\b/i, expect: { name: "a W-9", is: /\bw-?9\b/i } },
  { asks: /budget/i, expect: { name: "a budget", is: /budget/i, isNot: [{ name: "a Form 990", re: /\b990\b/ }, DETERMINATION] } },
  { asks: /insurance|certificate of liability/i, expect: { name: "an insurance certificate", is: /insurance|liability|certificate/i } },
  { asks: /board (list|of directors|members|roster)/i, expect: { name: "the board list", is: /board|trustee|director/i } },
];

/** A line when the attached file does not look like what the row asks for, else null. Reads the file's name, title and the first page of its text. */
export function attachmentMismatch(label: string, doc: { title: string; file_name: string | null; read_text?: string | null } | null | undefined): string | null {
  if (!doc) return null;
  const rule = EXPECTED.find((r) => r.asks.test(label));
  if (!rule) return null;
  const nameText = `${doc.title} ${doc.file_name ?? ""}`;
  const body = (doc.read_text ?? "").slice(0, 3000);
  if (rule.expect.is.test(nameText) || rule.expect.is.test(body)) return null;
  const other = rule.expect.isNot?.find((o) => o.re.test(nameText) || o.re.test(body));
  return other
    ? `This asks for ${rule.expect.name}; the attached file looks like ${other.name}.`
    : `This asks for ${rule.expect.name}; the attached file does not look like one — check it.`;
}

/* ───── The proposal's sections ───── */

export interface ProposalItem { label: string; detail: string | null; kind: string; answer: string | null; status: string; attachment?: { title: string; file_name: string | null } | null }
export interface ProposalSection { heading: string; kind: "prose" | "cost" | "contact"; text: string; cost?: CostTable }

/** The rows as the proposal prints them: every answered non-upload row in order, under the funder's own heading. Uploads become enclosures. */
export function proposalSections(items: ProposalItem[]): { sections: ProposalSection[]; enclosures: string[]; missing: string[] } {
  const sections: ProposalSection[] = [];
  const enclosures: string[] = [];
  const missing: string[] = [];
  for (const it of items) {
    if (it.status === "na") continue;
    const heading = it.label.replace(/^\d+[.)]\s*/, "").trim();
    if (it.kind === "upload") {
      if (it.attachment) enclosures.push(`${heading}: ${it.attachment.file_name ?? it.attachment.title}`);
      else missing.push(heading);
      continue;
    }
    if (it.kind === "acknowledgment" || it.kind === "signature") continue;
    const text = (it.answer ?? "").trim();
    if (!text) { missing.push(heading); continue; }
    if (isCostItem(it.label)) {
      const cost = parseCostLines(text);
      sections.push({ heading, kind: "cost", text, cost: cost.groups.length ? cost : undefined });
    } else sections.push({ heading, kind: isContactItem(it.label) ? "contact" : "prose", text });
  }
  return { sections, enclosures, missing };
}

/** The prose that sits around a cost table — sentences before the first priced line and after the last — so the page prints them on either side of the table. */
export function costProse(text: string): { before: string[]; after: string[] } {
  // A "Total request: … = $20,000. The balance is …" line: the page adds the total itself; any sentence after it is kept.
  const lines = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim().replace(/^(total|grand total|total request)\b[^.]*\.?\s*/i, "")).filter(Boolean);
  const priced = lines.map((l) => /^[-•*]\s+/.test(l) && AMOUNT_RE.test(l));
  const first = priced.indexOf(true), last = priced.lastIndexOf(true);
  const isProse = (l: string) => !/^[-•*]\s+/.test(l) && (l.split(/\s+/).length > 12 || /[.!?]$/.test(l));
  if (first < 0) return { before: lines.filter(isProse), after: [] };
  return { before: lines.slice(0, first).filter(isProse), after: lines.slice(last + 1).filter(isProse) };
}
