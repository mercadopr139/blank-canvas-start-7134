// The proposal as it goes to the funder (Josh, 2026-11-12: "This is supposed
// to be a narrative"). A letter RFP answered by a written proposal, mailed or
// emailed: NLA's letterhead, the date, who it goes to, a subject line, the
// sections under the funder's own headings, the cost estimate as a table that
// adds up, a closing with the signature, the enclosures listed, and the
// enclosed PDFs following. None of the record-keeping of the answers PDF
// (pasted dates, "not answered", "NLA's copy of the online application").
import jsPDF from "jspdf";
import nlaLogo from "@/assets/nla-logo.png";
import { costProse, money, type ProposalSection, type ProposalSetup } from "@/lib/grantCoach/proposal";

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

const DARK: [number, number, number] = [17, 24, 39];
const GRAY: [number, number, number] = [107, 114, 128];
const RED: [number, number, number] = [191, 15, 62];
const RULE: [number, number, number] = [229, 231, 235];
const INCH = 72;
const BODY = 11, LEAD = 15.5;

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

export async function buildProposalPdf(input: ProposalPdfInput): Promise<jsPDF> {
  const { folder, setup, letterhead, sections, enclosures } = input;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const L = INCH, R = W - INCH, TEXT_W = R - L, BOTTOM = H - INCH;
  let y = INCH - 8;

  const need = (h: number) => { if (y + h > BOTTOM) { doc.addPage(); y = INCH; } };
  const setType = (size: number, color: [number, number, number], style: "normal" | "bold" | "italic" = "normal") => { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color); };
  /** A paragraph; blank lines in the text are paragraph breaks. */
  const para = (text: string, size = BODY, color: [number, number, number] = DARK, style: "normal" | "bold" | "italic" = "normal", lead = LEAD, indent = 0) => {
    setType(size, color, style);
    for (const block of text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
      const flat = block.replace(/\s*\n\s*/g, " ").trim();
      if (!flat) continue;
      const lines = doc.splitTextToSize(flat, TEXT_W - indent) as string[];
      for (const ln of lines) { need(lead); doc.text(ln, L + indent, y + size); y += lead; }
      y += lead * 0.45;
    }
  };
  /** Lines kept as lines (an address, a contact block). */
  const lines = (text: string, size = BODY, color: [number, number, number] = DARK, style: "normal" | "bold" | "italic" = "normal") => {
    setType(size, color, style);
    for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
      const ln = raw.trim();
      if (!ln) continue;
      for (const piece of doc.splitTextToSize(ln, TEXT_W) as string[]) { need(LEAD); doc.text(piece, L, y + size); y += LEAD; }
    }
  };

  // ── Letterhead ──
  const logo = await loadLogo();
  const logoSize = 48;
  if (logo) doc.addImage(logo, "PNG", L, y, logoSize, logoSize);
  const hx = logo ? L + logoSize + 12 : L;
  setType(15, DARK, "bold"); doc.text(letterhead.org, hx, y + 16);
  setType(9, GRAY);
  const addr = letterhead.address.replace(/\r\n/g, "\n").split("\n").map((s) => s.trim()).filter(Boolean).join(", ");
  const contactBits = [letterhead.phone, letterhead.website, letterhead.ein ? `EIN ${letterhead.ein}` : null].filter(Boolean).join(" · ");
  doc.text(addr, hx, y + 30, { maxWidth: TEXT_W - (hx - L) });
  if (contactBits) doc.text(contactBits, hx, y + 42, { maxWidth: TEXT_W - (hx - L) });
  y += logoSize + 10;
  doc.setDrawColor(...RED); doc.setLineWidth(1.5); doc.line(L, y, R, y); y += 22;

  // ── Date, addressee ──
  setType(BODY, DARK); doc.text(longDate(input.date), L, y + BODY); y += LEAD * 1.6;
  const toLines = [
    [setup.to_name.trim(), setup.to_title.trim()].filter(Boolean).join(", "),
    setup.to_org.trim(),
    ...setup.to_address.replace(/\r\n/g, "\n").split("\n").map((s) => s.trim()).filter(Boolean),
  ].filter(Boolean);
  if (toLines.length) { lines(toLines.join("\n")); y += LEAD * 0.6; }

  // ── Subject, salutation ──
  if (setup.subject.trim()) { para(`Re: ${setup.subject.trim()}`, BODY, DARK, "bold"); }
  para(salutation(setup));

  // ── The sections, under the funder's headings ──
  for (const s of sections) {
    need(LEAD * 3);
    y += 4;
    setType(BODY + 1, DARK, "bold");
    for (const ln of doc.splitTextToSize(s.heading, TEXT_W) as string[]) { need(LEAD); doc.text(ln, L, y + BODY + 1); y += LEAD; }
    y += 4;
    if (s.kind === "cost" && s.cost) {
      // The sentence before the lines, then the table (kept with at least its first rows), then the sentence after.
      const prose = costProse(s.text);
      if (prose.before.length) para(prose.before.join("\n\n"));
      need(LEAD * 4);
      const colAmt = 96;
      const rowH = LEAD;
      const drawRow = (item: string, amount: string, style: "normal" | "bold", shade = false, indent = 0) => {
        const itemLines = doc.splitTextToSize(item, TEXT_W - colAmt - 12 - indent) as string[];
        const h = rowH * itemLines.length + 4;
        need(h);
        if (shade) { doc.setFillColor(243, 244, 246); doc.rect(L, y, TEXT_W, h, "F"); }
        setType(BODY - 0.5, DARK, style);
        itemLines.forEach((ln, i) => doc.text(ln, L + 6 + indent, y + BODY + 1 + i * rowH));
        if (amount) doc.text(amount, R - 6, y + BODY + 1, { align: "right" });
        y += h;
        doc.setDrawColor(...RULE); doc.setLineWidth(0.5); doc.line(L, y, R, y);
      };
      drawRow("Item", "Amount", "bold", true);
      for (const g of s.cost.groups) {
        if (g.heading) drawRow(g.heading, money(g.lines.reduce((t, l) => t + l.amount, 0)), "bold");
        for (const l of g.lines) drawRow(l.item, money(l.amount), "normal", false, g.heading ? 14 : 0);
      }
      drawRow("Total request", money(s.cost.total), "bold", true);
      y += LEAD * 0.8;
      if (prose.after.length) para(prose.after.join("\n\n"));
      if (folder.amount_requested != null && Math.round(s.cost.total) !== Math.round(folder.amount_requested)) {
        para(`(The lines add up to ${money(s.cost.total)}; the folder's request is ${money(folder.amount_requested)}.)`, 9, RED, "italic");
      }
    } else if (s.kind === "contact") {
      lines(s.text.replace(/\s*·\s*/g, "\n"));
      y += LEAD * 0.45;
    } else {
      para(s.text);
    }
  }

  // ── Closing ──
  need(LEAD * 7);
  y += 6;
  para(`Thank you for considering this request. ${setup.signer.trim() ? `${setup.signer.trim().split(",")[0]} is` : "We are"} available for any questions and for an interview.`);
  para("Sincerely,");
  y += LEAD * 1.4;
  if (setup.signer.trim()) {
    const [name, ...rest] = setup.signer.split(",").map((s) => s.trim());
    lines([name, rest.join(", "), letterhead.org].filter(Boolean).join("\n"));
  } else lines(letterhead.org);
  if (enclosures.length) {
    y += LEAD * 0.8;
    need(LEAD * (enclosures.length + 1));
    setType(BODY - 1, GRAY, "bold"); doc.text(enclosures.length === 1 ? "Enclosure" : "Enclosures", L, y + BODY); y += LEAD;
    setType(BODY - 1, DARK);
    for (const e of enclosures) { for (const ln of doc.splitTextToSize(e, TEXT_W) as string[]) { need(LEAD); doc.text(ln, L, y + BODY); y += LEAD; } }
  }

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    setType(8, GRAY);
    doc.text(`${letterhead.org} · ${folder.name}`, L, H - 36);
    doc.text(`Page ${p} of ${pages}`, R, H - 36, { align: "right" });
  }
  return doc;
}

export const proposalPdfFileName = (folder: { name: string; funder: string }, ymd: string) =>
  `${`${folder.funder} ${folder.name}`.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").slice(0, 70)}_proposal_${ymd}.pdf`;
