import jsPDF from "jspdf";
import { format } from "date-fns";
import nlaLogo from "@/assets/nla-logo.png";

// Donor-facing "Program Highlights" report. Prose-focused (no stat boxes): a
// branded header, a short intro, then one titled section per activity with
// bold title + flowing paragraphs. Matches the voice of NLA's hand-written
// highlights (Smile Lab, Banking & Boxing, Meal Train).

const BRAND_DARK = [17, 24, 39] as const;
const BRAND_GRAY = [107, 114, 128] as const;
const LIGHT_BG = [249, 250, 251] as const;
const ACCENT = [191, 15, 62] as const; // NLA red
const BORDER = [229, 231, 235] as const;

export interface HighlightSection {
  title: string;
  body: string;
}

export interface ProgramHighlightsData {
  periodLabel?: string;
  intro?: string;
  sections: HighlightSection[];
  logoBase64?: string;
}

const clean = (s: unknown): string =>
  String(s ?? "")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/–/g, "-")
    .replace(/—/g, "-");

function generateProgramHighlightsPdf(data: ProgramHighlightsData): jsPDF {
  const { periodLabel, intro, sections, logoBase64 } = data;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginL = 16;
  const marginR = 16;
  const contentW = pageWidth - marginL - marginR;

  // ─── HEADER BAND ───
  doc.setFillColor(...LIGHT_BG);
  doc.rect(0, 0, pageWidth, 44, "F");

  let logoRightEdge = marginL;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", marginL, 6, 24, 24);
      logoRightEdge = marginL + 28;
    } catch (e) {
      console.error("Failed to add logo to PDF:", e);
    }
  }

  doc.setTextColor(...BRAND_DARK);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PROGRAM HIGHLIGHTS", logoRightEdge, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("No Limits Academy", logoRightEdge, 24);

  const metaX = pageWidth - marginR;
  const labelX = metaX - 62;
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_GRAY);
  if (periodLabel) doc.text("Reporting Period", labelX, 12);
  doc.text("Generated", labelX, periodLabel ? 18 : 12);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont("helvetica", "bold");
  if (periodLabel) doc.text(clean(periodLabel), metaX, 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(format(new Date(), "MMM d, yyyy"), metaX, periodLabel ? 18 : 12, { align: "right" });

  doc.setFillColor(...ACCENT);
  doc.rect(0, 44, pageWidth, 0.8, "F");

  let y = 54;
  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - 22) {
      doc.addPage();
      y = 18;
    }
  };

  const drawParagraphs = (text: string, fontSize: number, lineH: number, gap: number) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND_DARK);
    clean(text).trim().split(/\n{2,}/).forEach((para) => {
      const lines = doc.splitTextToSize(para.replace(/\s*\n\s*/g, " ").trim(), contentW);
      lines.forEach((line: string) => {
        checkPage(lineH);
        doc.text(line, marginL, y);
        y += lineH;
      });
      y += gap;
    });
  };

  // ─── INTRO ───
  if (intro?.trim()) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10.5);
    doc.setTextColor(...BRAND_GRAY);
    const lines = doc.splitTextToSize(clean(intro).replace(/\s*\n\s*/g, " ").trim(), contentW);
    lines.forEach((line: string) => {
      checkPage(5.5);
      doc.text(line, marginL, y);
      y += 5.5;
    });
    y += 5;
  }

  // ─── SECTIONS ───
  sections.forEach((sec, idx) => {
    // Keep title + first couple lines together.
    checkPage(20);

    // Accent tick + title (wraps if long)
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_DARK);
    const titleLines = doc.splitTextToSize(clean(sec.title), contentW - 5);
    titleLines.forEach((line: string, i: number) => {
      if (i > 0) checkPage(6.5);
      doc.setFillColor(...ACCENT);
      doc.rect(marginL, y - 4, 1.6, 5.5, "F");
      doc.text(line, marginL + 5, y);
      y += 6.5;
    });
    y += 1.5;

    drawParagraphs(sec.body, 10.5, 5.4, 2.6);

    if (idx < sections.length - 1) {
      y += 2;
      checkPage(8);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.line(marginL, y, pageWidth - marginR, y);
      y += 8;
    }
  });

  // ─── SIGNATURE ───
  y += 4;
  checkPage(26);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, pageWidth - marginR, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_DARK);
  doc.text("With gratitude,", marginL, y);
  y += 5.5;
  doc.text("Josh Mercado", marginL, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_GRAY);
  doc.text("Program Director, No Limits Academy", marginL, y);
  y += 4;
  doc.text("joshmercado@nolimitsboxingacademy.org", marginL, y);

  // ─── FOOTER (every page) ───
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text(`No Limits Academy  •  Program Highlights  •  Page ${p} of ${pageCount}`, pageWidth / 2, pageHeight - 9, { align: "center" });
  }

  return doc;
}

async function loadLogoBase64(): Promise<string | undefined> {
  try {
    const response = await fetch(nlaLogo);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to load logo:", e);
    return undefined;
  }
}

export async function downloadProgramHighlightsPdf(
  data: Omit<ProgramHighlightsData, "logoBase64">
): Promise<void> {
  const logoBase64 = await loadLogoBase64();
  const doc = generateProgramHighlightsPdf({ ...data, logoBase64 });
  doc.save(`NLA_Program-Highlights_${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
