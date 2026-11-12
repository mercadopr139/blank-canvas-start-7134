// The proposal as it goes to the funder (Josh, 2026-11-12: "This is supposed
// to be a narrative"). A letter RFP answered by a written proposal, mailed or
// emailed: NLA's letterhead, the date, who it goes to, a subject line, the
// sections under the funder's own headings, the cost estimate as a table that
// adds up, a closing with the signature, the enclosures listed, and the
// enclosed PDFs following. None of the record-keeping of the answers PDF
// (pasted dates, "not answered", "NLA's copy of the online application").
//
// Typography (Josh, 2026-11-12, "worthy for review"): one-inch margins,
// 11-point Helvetica, bold headings with air above them, run-in labels
// ("Equipment, with safety paramount:") in bold, bullet lines kept as
// bullets, the cost table ruled with the total in a shaded row.
import jsPDF from "jspdf";
import nlaLogo from "@/assets/nla-logo.png";
import { closingText, costProse, groupAmount, money, type ProposalSection, type ProposalSetup } from "@/lib/grantCoach/proposal";

export interface Letterhead { org: string; address: string; phone: string | null; website: string | null; ein: string | null }
export interface ProposalPdfInput {
  folder: { name: string; funder: string; program_name: string | null; amount_requested: number | null };
  setup: ProposalSetup;
  letterhead: Letterhead;
  sections: ProposalSection[];
  /** "Financial Documentation: NLA_990_2025.pdf" — listed under Enclosures, in order. */
  enclosures: string[];
  /** The date on the letter, YYYY-MM-DD (America/New_York). */
  date: string;
}

type RGB = [number, number, number];
const DARK: RGB = [17, 24, 39];
const GRAY: RGB = [107, 114, 128];
const RED: RGB = [191, 15, 62];
const RULE: RGB = [209, 213, 219];
const SHADE: RGB = [243, 244, 246];
const INCH = 72;
const BODY = 11, LEAD = 15.5, PARA_GAP = 7;
type Style = "normal" | "bold" | "italic";

const longDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const loadLogo = async (): Promise<string | null> => {
  try {
    const blob = await (await fetch(nlaLogo)).blob();
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => res(null); r.readAsDataURL(blob); });
  } catch { return null; }
};

/** "Dear Jim Lutz," — the full name, never a guessed honorific; "Dear Selection Committee," when no one is named. */
export const salutation = (setup: ProposalSetup) => `Dear ${setup.to_name.trim() || "Selection Committee"},`;

/** A run-in label: a short phrase (up to seven words) ending in a colon at the start of a paragraph. */
export const runInLabel = (paragraph: string): { label: string; rest: string } | null => {
  const m = paragraph.match(/^([^.:!?\n]{3,80}?:)\s+(\S[\s\S]*)$/);
  if (!m) return null;
  const words = m[1].trim().split(/\s+/).length;
  if (words > 7) return null;
  return { label: m[1].trim(), rest: m[2].trim() };
};

export async function buildProposalPdf(input: ProposalPdfInput): Promise<jsPDF> {
  const { folder, setup, letterhead, sections, enclosures } = input;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const L = INCH, R = W - INCH, TEXT_W = R - L, BOTTOM = H - INCH;
  let y = INCH - 8;

  const need = (h: number) => { if (y + h > BOTTOM) { doc.addPage(); y = INCH; } };
  const setType = (size: number, color: RGB, style: Style = "normal") => { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color); };

  /** One paragraph, wrapped; a run-in label at its start is bold. */
  const paragraph = (text: string, size = BODY, color: RGB = DARK, style: Style = "normal", indent = 0) => {
    const flat = text.replace(/\s*\n\s*/g, " ").trim();
    if (!flat) return;
    const run = style === "normal" ? runInLabel(flat) : null;
    if (run) {
      setType(size, color, "bold");
      const labelW = doc.getTextWidth(run.label + " ");
      const firstW = TEXT_W - indent - labelW;
      setType(size, color, "normal");
      // What fits beside the label on the first line, then the rest at full width.
      const words = run.rest.split(" ");
      let first = "";
      let i = 0;
      for (; i < words.length; i++) {
        const trial = first ? `${first} ${words[i]}` : words[i];
        if (doc.getTextWidth(trial) > firstW) break;
        first = trial;
      }
      need(LEAD);
      setType(size, color, "bold"); doc.text(run.label, L + indent, y + size);
      setType(size, color, "normal"); if (first) doc.text(first, L + indent + labelW, y + size);
      y += LEAD;
      const remainder = words.slice(i).join(" ");
      if (remainder) for (const ln of doc.splitTextToSize(remainder, TEXT_W - indent) as string[]) { need(LEAD); doc.text(ln, L + indent, y + size); y += LEAD; }
    } else {
      setType(size, color, style);
      for (const ln of doc.splitTextToSize(flat, TEXT_W - indent) as string[]) { need(LEAD); doc.text(ln, L + indent, y + size); y += LEAD; }
    }
    y += PARA_GAP;
  };
  /** A bullet line, hanging indent. */
  const bullet = (text: string, size = BODY) => {
    setType(size, DARK);
    const ind = 14;
    const lines = doc.splitTextToSize(text.trim(), TEXT_W - ind) as string[];
    lines.forEach((ln, k) => { need(LEAD); if (k === 0) doc.text("•", L + 3, y + size); doc.text(ln, L + ind, y + size); y += LEAD; });
  };
  /** Prose as written: blank lines separate paragraphs; lines starting with "-", "•" or "*" are bullets and stay on their own lines. */
  const prose = (text: string) => {
    const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
    for (const block of blocks) {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) continue;
      let buf: string[] = [];
      const flush = () => { if (buf.length) { paragraph(buf.join(" ")); buf = []; } };
      for (const ln of lines) {
        if (/^[-•*]\s+/.test(ln)) { flush(); bullet(ln.replace(/^[-•*]\s+/, "")); }
        else buf.push(ln);
      }
      flush();
      if (lines.some((l) => /^[-•*]\s+/.test(l))) y += PARA_GAP;
    }
  };
  /** Lines kept as lines (an address, a contact block). */
  const lines = (text: string, size = BODY, color: RGB = DARK, style: Style = "normal") => {
    setType(size, color, style);
    for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
      const ln = raw.trim();
      if (!ln) continue;
      for (const piece of doc.splitTextToSize(ln, TEXT_W) as string[]) { need(LEAD); doc.text(piece, L, y + size); y += LEAD; }
    }
  };
  /** A section heading: bold, a little larger, air above it, kept with the lines that follow. No rule — a letter does not underline its headings (Josh, 2026-11-12). */
  const heading = (text: string) => {
    need(LEAD * 4);
    y += 8;
    setType(12.5, DARK, "bold");
    for (const ln of doc.splitTextToSize(text, TEXT_W) as string[]) { doc.text(ln, L, y + 12.5); y += LEAD + 1; }
    y += 5;
  };

  // ── Letterhead ──
  const logo = await loadLogo();
  const logoSize = 50;
  if (logo) doc.addImage(logo, "PNG", L, y, logoSize, logoSize);
  const hx = logo ? L + logoSize + 14 : L;
  setType(16, DARK, "bold"); doc.text(letterhead.org, hx, y + 17);
  setType(9, GRAY);
  const addr = letterhead.address.replace(/\r\n/g, "\n").split("\n").map((s) => s.trim()).filter(Boolean).join(", ");
  const contactBits = [letterhead.phone, letterhead.website?.replace(/^https?:\/\//, ""), letterhead.ein ? `EIN ${letterhead.ein}` : null].filter(Boolean).join("   ·   ");
  if (addr) doc.text(addr, hx, y + 31, { maxWidth: TEXT_W - (hx - L) });
  if (contactBits) doc.text(contactBits, hx, y + 43, { maxWidth: TEXT_W - (hx - L) });
  y += logoSize + 12;
  doc.setDrawColor(...RED); doc.setLineWidth(1.5); doc.line(L, y, R, y); y += 26;

  // ── Date, addressee ──
  setType(BODY, DARK); doc.text(longDate(input.date), L, y + BODY); y += LEAD * 1.7;
  const toLines = [
    [setup.to_name.trim(), setup.to_title.trim()].filter(Boolean).join(", "),
    setup.to_org.trim(),
    ...setup.to_address.replace(/\r\n/g, "\n").split("\n").map((s) => s.trim()).filter(Boolean),
  ].filter(Boolean);
  if (toLines.length) { lines(toLines.join("\n")); y += LEAD * 0.7; }

  // ── Subject, salutation ──
  if (setup.subject.trim()) { setType(BODY, DARK, "bold"); for (const ln of doc.splitTextToSize(`Re: ${setup.subject.trim()}`, TEXT_W) as string[]) { need(LEAD); doc.text(ln, L, y + BODY); y += LEAD; } y += PARA_GAP; }
  setType(BODY, DARK); need(LEAD); doc.text(salutation(setup), L, y + BODY); y += LEAD + PARA_GAP;

  // ── The sections, under the funder's headings ──
  for (const s of sections) {
    heading(s.heading);
    if (s.kind === "cost" && s.cost) {
      const pr = costProse(s.text);
      for (const p of pr.before) paragraph(p);
      need(LEAD * 4);
      const colAmt = 96;
      const rowH = LEAD;
      const drawRow = (item: string, amount: string, style: Style, shade = false, indent = 0, color: RGB = DARK) => {
        const itemLines = doc.splitTextToSize(item, TEXT_W - colAmt - 12 - indent) as string[];
        const h = rowH * itemLines.length + 5;
        need(h);
        if (shade) { doc.setFillColor(...SHADE); doc.rect(L, y, TEXT_W, h, "F"); }
        setType(BODY - 0.5, color, style);
        itemLines.forEach((ln, i) => doc.text(ln, L + 6 + indent, y + BODY + 1.5 + i * rowH));
        if (amount) doc.text(amount, R - 6, y + BODY + 1.5, { align: "right" });
        y += h;
        doc.setDrawColor(...RULE); doc.setLineWidth(0.5); doc.line(L, y, R, y);
      };
      doc.setDrawColor(...DARK); doc.setLineWidth(0.8); doc.line(L, y, R, y);
      drawRow("Item", "Amount", "bold", true);
      for (const g of s.cost.groups) {
        const ga = groupAmount(g);
        if (g.heading) drawRow(g.heading, ga != null ? money(ga) : "", "bold");
        for (const l of g.lines) drawRow(l.item, l.amount != null ? money(l.amount) : "—", "normal", false, g.heading ? 14 : 0, l.amount != null ? DARK : GRAY);
      }
      drawRow("Total request", money(s.cost.total), "bold", true);
      doc.setDrawColor(...DARK); doc.setLineWidth(0.8); doc.line(L, y, R, y);
      y += LEAD * 0.9;
      if (folder.amount_requested != null && Math.round(s.cost.total) !== Math.round(folder.amount_requested)) {
        paragraph(`(The lines add up to ${money(s.cost.total)}; the folder's request is ${money(folder.amount_requested)}.)`, 9, RED, "italic");
      }
      for (const p of pr.after) paragraph(p);
    } else if (s.kind === "contact") {
      lines(s.text.replace(/\s*·\s*/g, "\n"));
      y += PARA_GAP;
    } else {
      prose(s.text);
    }
  }

  // ── Closing ──
  need(LEAD * 8);
  y += 4;
  paragraph(closingText(setup));
  setType(BODY, DARK); need(LEAD); doc.text("Sincerely,", L, y + BODY); y += LEAD;
  y += LEAD * 1.6;
  if (setup.signer.trim()) {
    const [name, ...rest] = setup.signer.split(",").map((s) => s.trim());
    setType(BODY, DARK, "bold"); need(LEAD); doc.text(name, L, y + BODY); y += LEAD;
    lines([rest.join(", "), letterhead.org].filter(Boolean).join("\n"));
  } else lines(letterhead.org);
  if (enclosures.length) {
    y += LEAD;
    need(LEAD * (enclosures.length + 1));
    setType(BODY - 1.5, GRAY, "bold"); doc.text((enclosures.length === 1 ? "Enclosure" : "Enclosures").toUpperCase(), L, y + BODY); y += LEAD;
    setType(BODY - 1, DARK);
    for (const e of enclosures) { for (const ln of doc.splitTextToSize(e, TEXT_W) as string[]) { need(LEAD); doc.text(ln, L, y + BODY); y += LEAD; } }
  }

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...RULE); doc.setLineWidth(0.5); doc.line(L, H - 50, R, H - 50);
    setType(8, GRAY);
    doc.text(`${letterhead.org}  ·  ${folder.name}`, L, H - 38);
    doc.text(`Page ${p} of ${pages}`, R, H - 38, { align: "right" });
  }
  return doc;
}

export const proposalPdfFileName = (folder: { name: string; funder: string }, ymd: string) =>
  `${`${folder.funder} ${folder.name}`.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").slice(0, 70)}_proposal_${ymd}.pdf`;
