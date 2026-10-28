// The program narrative as a PDF (Josh, 2026-10-28: "instead of a Word file,
// can I download a PDF?"). Same page as the Word file: letter, one-inch
// margins, 11-point type, NLA's name in the header, the funder's seven
// headings in order, page numbers. And the same text as plain text, for
// pasting straight into a portal box.
import jsPDF from "jspdf";
import type { NarrativeMeta, NarrativeSection } from "@/lib/grantCoach/narrativeDocx";

const INCH = 72;
const PAGE_W = 612, PAGE_H = 792;
const TEXT_W = PAGE_W - 2 * INCH;
const BOTTOM = PAGE_H - INCH;
const BODY = 11, HEAD = 11.5, LEAD = 15;

export function buildNarrativePdf(sections: NarrativeSection[], meta: NarrativeMeta): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = INCH;
  const need = (h: number) => { if (y + h > BOTTOM) { doc.addPage(); y = INCH; } };

  // Title block
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(17, 24, 39);
  doc.text(`${meta.org}${meta.program ? ` — ${meta.program}` : ""}`, INCH, y); y += 18;
  doc.setFont("helvetica", "normal").setFontSize(BODY).setTextColor(68, 68, 68);
  doc.text(`Program Narrative · ${meta.grant}`, INCH, y); y += 22;

  for (const s of sections) {
    need(HEAD + LEAD * 2);
    doc.setFont("helvetica", "bold").setFontSize(HEAD).setTextColor(17, 24, 39);
    const headLines = doc.splitTextToSize(`${s.n}. ${s.heading}`, TEXT_W) as string[];
    for (const l of headLines) { need(LEAD); doc.text(l, INCH, y); y += LEAD; }
    y += 2;
    doc.setFont("helvetica", "normal").setFontSize(BODY).setTextColor(17, 24, 39);
    for (const para of s.text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
      const lines = doc.splitTextToSize(para.replace(/\s*\n\s*/g, " ").trim(), TEXT_W) as string[];
      for (const l of lines) { need(LEAD); doc.text(l, INCH, y); y += LEAD; }
      y += 6;
    }
    y += 6;
  }

  // Header line and page numbers on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(120, 120, 120);
    doc.text(`${meta.org} · Program Narrative · ${meta.grant}`, PAGE_W - INCH, INCH - 24, { align: "right" });
    doc.text(`Page ${p} of ${pages}`, PAGE_W / 2, PAGE_H - INCH + 28, { align: "center" });
  }
  return doc;
}

export function downloadNarrativePdf(sections: NarrativeSection[], meta: NarrativeMeta, fileName: string) {
  buildNarrativePdf(sections, meta).save(fileName);
}

/** The narrative as plain text: numbered headings, a blank line between paragraphs — ready to paste. */
export const narrativeText = (sections: NarrativeSection[]) =>
  sections.map((s) => `${s.n}. ${s.heading}\n\n${s.text.trim()}`).join("\n\n\n");
