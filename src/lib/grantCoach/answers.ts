// Grant Coach — answers that come from data, not from the writer.
//
// When a funder's application is read in, every question is matched to a
// Grant Vault field (or an organization document) where it can be. Those
// answers are filled here, exactly, with no AI: the legal name is the legal
// name, the ZIP is the ZIP. Only questions that need writing go to the
// writer. (Josh, 2026-10-22: "facts come from data deterministically.")
import { ORG_FIELDS, formatEin, orgFieldValue } from "@/lib/grantCoach/orgProfile";
import { ORG_DOCUMENTS } from "@/lib/grantCoach/orgDocuments";

export type VaultPart = "street" | "street2" | "city" | "state" | "zip" | "name" | "first" | "last" | "title";
export const VAULT_PARTS: VaultPart[] = ["street", "street2", "city", "state", "zip", "name", "first", "last", "title"];

export interface Address { street: string; street2: string; city: string; state: string; zip: string }

/**
 * "301 North Vineyard Court, Cape May NJ 08204", "1086 Route 47 South, Rio
 * Grande, NJ 08242", or the same on several lines. The last line/segment
 * holding "<city> <ST> <zip>" is the city line; what comes before it is the
 * street (and a second street line when there are two).
 */
export const parseAddress = (raw: string): Address | null => {
  const text = raw.replace(/\r/g, "").trim();
  if (!text) return null;
  const tail = text.match(/^(.*?)[,\s]+([A-Za-z][A-Za-z .'-]*?)[,\s]+([A-Z]{2})\.?[,\s]+(\d{5}(?:-\d{4})?)\s*$/s);
  if (!tail) return null;
  const [, before, city, state, zip] = tail;
  const streetLines = before.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  if (!streetLines.length) return null;
  return { street: streetLines[0], street2: streetLines.slice(1).join(", "), city: city.trim(), state, zip };
};

/** "Josh Mercado, Program Director" or "Josh Mercado — Program Director". */
export const parseNameTitle = (raw: string) => {
  const [name, ...rest] = raw.trim().split(/\s*(?:,|—|–| - )\s*/);
  const words = (name ?? "").split(/\s+/).filter(Boolean);
  return { name: name ?? "", first: words[0] ?? "", last: words.slice(1).join(" "), title: rest.join(", ") };
};

const usDate = (v: string) => {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : v;
};

/** The Vault's answer for a question, or null when the Vault has nothing there yet. */
export const vaultAnswer = (key: string, part: VaultPart | null | undefined, saved: Record<string, string | null>): string | null => {
  const field = ORG_FIELDS.find((f) => f.key === key);
  if (!field) return null;
  let value = orgFieldValue(field, saved).trim();
  if (!value) return null;
  if (key === "ein") value = formatEin(value);
  if (field.kind === "date") value = usDate(value);
  if (field.kind === "yesno") value = /^y/i.test(value) ? "Yes" : /^n/i.test(value) ? "No" : value;
  if (!part) return value;
  if (["street", "street2", "city", "state", "zip"].includes(part)) {
    const a = parseAddress(value);
    if (!a) return part === "street" ? value : null;
    return a[part as keyof Address] || null;
  }
  const n = parseNameTitle(value);
  return n[part as "name" | "first" | "last" | "title"] || null;
};

/** The answer for a piece the Vault has no value for (a second address line): leave the portal field empty. */
export const LEAVE_BLANK = "Leave blank";
/** True when the Vault holds the field but not this piece of it — the honest answer is "leave it empty". */
export const pieceIsEmpty = (key: string, part: VaultPart | null | undefined, saved: Record<string, string | null>) =>
  !!part && vaultAnswer(key, part, saved) == null && vaultAnswer(key, null, saved) != null;

/** True when two answers say the same thing (case, spacing, $ and commas aside). */
export const sameValue = (a: string, b: string) => {
  const norm = (v: string) => v.trim().toLowerCase().replace(/[$,]/g, "").replace(/\s+/g, " ");
  return norm(a) === norm(b);
};

/** What an attachment slot holds: the matched organization document, on file or not. */
export const documentAnswer = (docKey: string, onFile: Set<string>) => {
  const doc = ORG_DOCUMENTS.find((d) => d.key === docKey);
  if (!doc) return { answer: null, needs: "Attach the file this asks for." };
  return onFile.has(docKey)
    ? { answer: `Attach: ${doc.title} (on file in Grant Coach → Documents).`, needs: null }
    : { answer: null, needs: `Upload the ${doc.title} to Grant Coach → Documents, then attach it here.` };
};

/** The [NEED: …] notes the writer leaves where it lacks a fact, as one line. */
export const needsFrom = (answer: string | null | undefined): string | null => {
  const found = [...(answer ?? "").matchAll(/\[NEED:\s*([^\]]+)\]/gi)].map((m) => m[1].trim());
  return found.length ? `Grant Coach needs: ${[...new Set(found)].join("; ")}.` : null;
};

/** A fact row is short and exact: it sits in the compact block, not a big card. */
export const isFactRow = (it: { vault_key?: string | null; kind: string; limit_value?: number | null }) =>
  !!it.vault_key || it.kind === "field" || it.kind === "choice" || it.kind === "acknowledgment" || it.kind === "signature" || it.kind === "upload";

/** What the classifier is shown: every Vault field and document it may match a question to. */
export const vaultCatalog = () => ({
  fields: ORG_FIELDS.map((f) => ({ key: f.key, label: f.label, kind: f.kind })),
  documents: ORG_DOCUMENTS.map((d) => ({ key: d.key, label: d.title })),
});
