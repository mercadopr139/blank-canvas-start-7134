import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import nlaLogo from "@/assets/nla-logo.png";

// ─── Colors (matching the invoice / meal-report house style) ───
const BRAND_DARK = [17, 24, 39] as const;
const BRAND_GRAY = [107, 114, 128] as const;
const LIGHT_BG = [249, 250, 251] as const;
const ACCENT = [191, 15, 62] as const; // NLA red
const TABLE_HEAD = [31, 41, 55] as const;
const BORDER = [229, 231, 235] as const;

export interface ReportStat {
  label: string;
  value: string;
}

export interface ReportTable {
  columns: string[];
  rows: string[][];
}

export interface CornerCoachReportData {
  title: string;
  periodLabel?: string;
  narrative: string;
  stats: ReportStat[];
  table?: ReportTable | null;
  logoBase64?: string;
}

function drawHR(doc: jsPDF, y: number, marginL: number, marginR: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, pageWidth - marginR, y);
}

function generateCornerCoachReportPdf(data: CornerCoachReportData): jsPDF {
  const { title, periodLabel, narrative, stats, table, logoBase64 } = data;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginL = 14;
  const marginR = 14;
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
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  // Long titles wrap so they never collide with the meta column.
  const titleLines = doc.splitTextToSize(title.toUpperCase(), pageWidth - logoRightEdge - 70);
  doc.text(titleLines[0] ?? "REPORT", logoRightEdge, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("No Limits Academy", logoRightEdge, 24);

  const metaX = pageWidth - marginR;
  const labelX = metaX - 62;
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_GRAY);
  if (periodLabel) doc.text("Report Period", labelX, 12);
  doc.text("Generated", labelX, periodLabel ? 18 : 12);

  doc.setTextColor(...BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  if (periodLabel) doc.text(periodLabel, metaX, 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(format(new Date(), "MMM d, yyyy"), metaX, periodLabel ? 18 : 12, { align: "right" });

  // NLA-red accent stripe under the band.
  doc.setFillColor(...ACCENT);
  doc.rect(0, 44, pageWidth, 0.8, "F");

  let y = 52;

  // ─── SUMMARY STAT STRIP ───
  const cleanStats = (stats ?? []).slice(0, 5);
  if (cleanStats.length > 0) {
    const gap = 2.67;
    const boxW = (contentW - gap * (cleanStats.length - 1)) / cleanStats.length;
    cleanStats.forEach((item, i) => {
      const x = marginL + i * (boxW + gap);
      doc.setFillColor(...LIGHT_BG);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(x, y, boxW, 18, 2, 2, "FD");
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND_DARK);
      const valLines = doc.splitTextToSize(item.value, boxW - 4);
      doc.text(valLines[0] ?? "", x + boxW / 2, y + 9, { align: "center" });
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND_GRAY);
      const labelLines = doc.splitTextToSize(item.label, boxW - 3);
      doc.text(labelLines.slice(0, 2), x + boxW / 2, y + 14, { align: "center" });
    });
    y += 24;
  }

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - 24) {
      doc.addPage();
      y = 16;
    }
  };

  // ─── NARRATIVE ───
  if (narrative?.trim()) {
    drawHR(doc, y, marginL, marginR);
    y += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_GRAY);
    doc.text("SUMMARY", marginL, y);
    y += 5;

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND_DARK);
    const paragraphs = narrative.trim().split(/\n{2,}/);
    paragraphs.forEach((para) => {
      const lines = doc.splitTextToSize(para.replace(/\s*\n\s*/g, " ").trim(), contentW);
      lines.forEach((line: string) => {
        checkPage(6);
        doc.text(line, marginL, y);
        y += 5;
      });
      y += 2; // paragraph gap
    });
    y += 2;
  }

  // ─── DATA TABLE ───
  if (table && table.columns?.length && table.rows?.length) {
    checkPage(20);
    autoTable(doc, {
      startY: y,
      head: [table.columns],
      body: table.rows,
      theme: "striped",
      headStyles: {
        fillColor: [...TABLE_HEAD],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        cellPadding: 2.5,
      },
      bodyStyles: { fontSize: 7.5, cellPadding: 2, textColor: [...BRAND_DARK] },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      styles: { lineColor: [...BORDER], lineWidth: 0.2, overflow: "linebreak" },
      margin: { left: marginL, right: marginR },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ─── SIGNATURE ───
  checkPage(30);
  drawHR(doc, y, marginL, marginR);
  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_DARK);
  doc.text("Josh Mercado", marginL, y);
  y += 3.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("Program Director, No Limits Academy", marginL, y);
  y += 3.5;
  doc.text("joshmercado@nolimitsboxingacademy.org", marginL, y);

  // ─── FOOTER (every page) ───
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(6);
    doc.setTextColor(180, 180, 180);
    doc.text(
      "Figures generated by Corner Coach from live NLA data — verify before external use.",
      pageWidth - marginR,
      pageHeight - 13,
      { align: "right" }
    );
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text(
      `No Limits Academy  •  Page ${p} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 9,
      { align: "center" }
    );
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

export async function downloadCornerCoachReportPdf(
  data: Omit<CornerCoachReportData, "logoBase64">
): Promise<void> {
  const logoBase64 = await loadLogoBase64();
  const doc = generateCornerCoachReportPdf({ ...data, logoBase64 });
  const slug = (data.title || "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  doc.save(`NLA_${slug}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
