// Grant Coach — the hardcopy of an online application (Josh, 2026-10-22).
//
// Most grants are answered straight into the funder's portal, so the folder
// is NLA's only copy of what was sent. This prints every question in portal
// order with its limit and the answer, so after submitting online Josh can
// print or file a record of exactly what went in.
import jsPDF from "jspdf";
import nlaLogo from "@/assets/nla-logo.png";
import type { MergeNote } from "@/lib/grantCoach/attachments";

export interface AnswersPdfFolder {
  name: string;
  funder: string;
  program_name: string | null;
  due_at: string | null;
  amount_requested: number | null;
  period_start: string | null;
  period_end: string | null;
}
export interface AnswersPdfItem {
  section: string;
  label: string;
  detail: string | null;
  answer: string | null;
  status: string;
  limit_kind?: "words" | "characters" | null;
  limit_value?: number | null;
  pasted_at?: string | null;
}

const DARK: [number, number, number] = [17, 24, 39];
const GRAY: [number, number, number] = [107, 114, 128];
const RED: [number, number, number] = [191, 15, 62];
const RULE: [number, number, number] = [229, 231, 235];

const nyDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
const plainDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** "142 / 250 words" or "980 / 1,000 characters" — what the funder allowed and what was used. */
export const limitLine = (it: AnswersPdfItem): string | null => {
  if (!it.limit_kind || !it.limit_value) return null;
  const used = it.answer ? (it.limit_kind === "words" ? wordCount(it.answer) : it.answer.trim().length) : 0;
  return `${used.toLocaleString()} / ${it.limit_value.toLocaleString()} ${it.limit_kind}`;
};

/** Only the questions belong in the hardcopy: rows that carry an answer, or that came off a portal screen. */
export const printableItems = <T extends AnswersPdfItem & { source_path?: string | null }>(items: T[]) =>
  items.filter((i) => i.status !== "na" && (i.answer?.trim() || i.section.startsWith("Portal") || i.source_path));

const loadLogo = async (): Promise<string | null> => {
  try {
    const blob = await (await fetch(nlaLogo)).blob();
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => res(null); r.readAsDataURL(blob); });
  } catch { return null; }
};

/** What the attachments page says about each file. */
const howLine = (n: MergeNote) => {
  switch (n.how) {
    case "merged": return "follows, after the answers";
    case "not a PDF": return "filed in the folder's documents (not a PDF, so it is not merged here)";
    case "link": return "a link, not a file";
    case "could not read": return "filed in the folder's documents (the PDF could not be merged)";
    default: return "NOT ATTACHED";
  }
};

export async function buildAnswersPdf(folder: AnswersPdfFolder, items: AnswersPdfItem[], printedAt = new Date(), attachments: MergeNote[] = []): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const L = 54, R = W - 54, TEXT_W = R - L, BOTTOM = H - 60;
  let y = 54;

  const need = (h: number) => { if (y + h > BOTTOM) { doc.addPage(); y = 54; } };
  const para = (text: string, size: number, color: [number, number, number], style: "normal" | "bold" | "italic" = "normal", lead = 1.35) => {
    doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color);
    const lineH = size * lead;
    for (const block of text.replace(/\r\n/g, "\n").split("\n")) {
      const lines = block.trim() ? (doc.splitTextToSize(block, TEXT_W) as string[]) : [""];
      for (const ln of lines) { need(lineH); doc.text(ln, L, y + size); y += lineH; }
    }
  };

  // ── Cover block ──
  const logo = await loadLogo();
  if (logo) doc.addImage(logo, "PNG", L, y, 44, 44);
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...DARK);
  doc.text(folder.name, logo ? L + 56 : L, y + 20, { maxWidth: TEXT_W - 56 });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...GRAY);
  doc.text(`No Limits Academy Inc. · application to ${folder.funder}`, logo ? L + 56 : L, y + 38);
  y += 62;

  const facts: [string, string][] = [];
  if (folder.program_name) facts.push(["Program", folder.program_name]);
  if (folder.amount_requested != null) facts.push(["Amount requested", `$${Number(folder.amount_requested).toLocaleString()}`]);
  if (folder.period_start && folder.period_end) facts.push(["Grant period", `${plainDate(folder.period_start)} – ${plainDate(folder.period_end)}`]);
  if (folder.due_at) facts.push(["Due", nyDate(folder.due_at)]);
  const answered = items.filter((i) => i.answer?.trim()).length;
  const pasted = items.filter((i) => i.pasted_at).length;
  facts.push(["Questions", `${items.length} · ${answered} answered · ${pasted} pasted into the portal`]);
  facts.push(["Printed", printedAt.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })]);
  doc.setFontSize(10);
  for (const [k, v] of facts) {
    doc.setFont("helvetica", "bold"); doc.setTextColor(...GRAY); doc.text(k.toUpperCase(), L, y + 10);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(v, TEXT_W - 130) as string[];
    doc.text(lines, L + 130, y + 10); y += 15 * lines.length;
  }
  y += 8; doc.setDrawColor(...RED); doc.setLineWidth(1.5); doc.line(L, y, R, y); y += 18;

  // ── Questions, in portal order, grouped by screen ──
  let section = "";
  let n = 0;
  for (const it of items) {
    if (it.section !== section) {
      section = it.section;
      need(40); y += 6;
      para(section.replace(/^Portal · /, "").toUpperCase(), 9.5, RED, "bold");
      doc.setDrawColor(...RULE); doc.setLineWidth(0.6); doc.line(L, y + 2, R, y + 2); y += 10;
    }
    n += 1;
    need(54);
    para(`${n}. ${it.label}`, 11, DARK, "bold");
    if (it.detail?.trim()) para(it.detail.trim(), 9, GRAY, "italic");
    const meta = [limitLine(it), it.pasted_at ? `Pasted ${nyDate(it.pasted_at)}` : it.answer?.trim() ? "Not marked pasted" : null].filter(Boolean).join("  ·  ");
    if (meta) para(meta, 8.5, GRAY);
    y += 3;
    if (it.answer?.trim()) para(it.answer.trim(), 10.5, DARK, "normal", 1.45);
    else para("Not answered.", 10.5, RED, "italic");
    y += 14;
  }

  // ── Attachments: what was submitted with the answers, and where each file is ──
  if (attachments.length) {
    need(40); y += 6;
    para("ATTACHMENTS", 9.5, RED, "bold");
    doc.setDrawColor(...RULE); doc.setLineWidth(0.6); doc.line(L, y + 2, R, y + 2); y += 10;
    para(`${attachments.filter((a) => a.how === "merged").length} of ${attachments.length} attached files follow this page as PDF pages, in this order. The rest are in the folder's documents.`, 9, GRAY, "italic");
    y += 4;
    attachments.forEach((a, i) => {
      need(40);
      para(`${i + 1}. ${a.label}`, 11, DARK, "bold");
      para(`${a.fileName ?? "—"} · ${howLine(a)}`, 10, a.how === "missing" ? RED : DARK);
      y += 8;
    });
  }

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GRAY);
    doc.text(`${folder.funder} · ${folder.name} · NLA's copy of the online application`, L, H - 30);
    doc.text(`Page ${p} of ${pages}`, R, H - 30, { align: "right" });
  }
  return doc;
}

export const answersPdfFileName = (folder: Pick<AnswersPdfFolder, "name" | "funder">, on = new Date()) => {
  const ymd = on.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return `${`${folder.funder} ${folder.name}`.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").slice(0, 70)}_answers_${ymd}.pdf`;
};
