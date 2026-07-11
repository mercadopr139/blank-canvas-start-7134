// PDF generator for ad-hoc Quotes and one-off Invoices created via
// the Invoice/Quote Generator. Mirrors generateInvoicePdf.ts so the
// branding (logo, color palette, footer) reads as the same document
// family — only the header title and meta labels differ.
//
// Why a separate generator?
//   - generateInvoicePdf.ts is tightly coupled to the clients +
//     service_logs schema (looks up hourly_rate, billing_method,
//     service_days, etc.). Ad-hoc docs have no such backing data —
//     the line items come straight from a form-typed table.
//   - Sharing rendering helpers would mean threading a dozen optional
//     props through generateInvoicePdf. Cleaner to keep the two
//     surfaces parallel and resist the urge to unify prematurely.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import nlaLogo from "@/assets/nla-logo.png";

export type AdHocDocType = "quote" | "invoice";

export interface AdHocLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface AdHocDocData {
  docType: AdHocDocType;
  docNumber: string;
  recipientName: string;
  recipientEmail?: string | null;
  recipientAddress?: string | null;
  issueDate: Date;
  // Valid Until (quote) / Due Date (invoice). Either or null.
  expiryDate?: Date | null;
  lineItems: AdHocLineItem[];
  subtotal: number;
  total: number;
  notes?: string | null;
  // Free-text clause printed in its own "NOTE TO RECIPIENT" section
  // below TERMS. Lets the admin spell out per-doc conditions ("If no
  // late bus is provided by the school, NLA will provide transport
  // for students in need") without mixing them into the dates block.
  noteToRecipient?: string | null;
  logoBase64?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// ─── Colors — mirror generateInvoicePdf so the docs read as siblings ───
const BRAND_DARK = [17, 24, 39] as const;
const BRAND_GRAY = [107, 114, 128] as const;
const LIGHT_BG = [249, 250, 251] as const;
const ACCENT = [17, 24, 39] as const;
const TABLE_HEAD = [31, 41, 55] as const;
const BORDER = [229, 231, 235] as const;

export function generateAdHocDocPdf(data: AdHocDocData): jsPDF {
  const {
    docType,
    docNumber,
    recipientName,
    recipientEmail,
    recipientAddress,
    issueDate,
    expiryDate,
    lineItems,
    subtotal,
    total,
    notes,
    noteToRecipient,
    logoBase64,
  } = data;

  const isQuote = docType === "quote";
  const title = isQuote ? "QUOTE" : "INVOICE";
  const expiryLabel = isQuote ? "Valid Until" : "Due Date";
  const totalLabel = isQuote ? "Total" : "Total Due";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginL = 14;
  const marginR = 14;
  const contentW = pageWidth - marginL - marginR;

  const drawHR = (yy: number) => {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(marginL, yy, pageWidth - marginR, yy);
  };

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
  doc.text(title, logoRightEdge, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("No Limits Academy", logoRightEdge, 24);

  // Right-aligned meta block
  const metaX = pageWidth - marginR;
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_GRAY);
  const docLabel = isQuote ? "Quote #" : "Invoice #";
  doc.text(docLabel, metaX - 38, 12);
  doc.text("Issue Date", metaX - 38, 18);
  if (expiryDate) doc.text(expiryLabel, metaX - 38, 24);

  doc.setTextColor(...BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.text(docNumber, metaX, 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(format(issueDate, "MMM d, yyyy"), metaX, 18, { align: "right" });
  if (expiryDate) {
    doc.text(format(expiryDate, "MMM d, yyyy"), metaX, 24, { align: "right" });
  }

  // Accent stripe under header
  doc.setFillColor(...ACCENT);
  doc.rect(0, 44, pageWidth, 0.8, "F");

  // ─── RECIPIENT (BILL TO / PREPARED FOR) ───
  let y = 50;
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_GRAY);
  doc.text(isQuote ? "PREPARED FOR" : "BILL TO", marginL, y);

  y += 4;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_DARK);
  doc.text(recipientName, marginL, y);
  y += 4;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);

  if (recipientEmail) {
    doc.text(recipientEmail, marginL, y);
    y += 3.5;
  }
  if (recipientAddress) {
    recipientAddress.split("\n").forEach((line) => {
      if (line.trim()) {
        doc.text(line, marginL, y);
        y += 3.5;
      }
    });
  }

  // ─── LINE ITEMS TABLE ───
  y += 4;
  drawHR(y);
  y += 1;

  const tableHead = [["Description", "Qty", "Rate", "Amount"]];
  const tableData = lineItems.length > 0
    ? lineItems.map((item) => [
      item.description || "—",
      String(item.quantity),
      formatCurrency(item.rate),
      formatCurrency(item.amount),
    ])
    : [["No line items", "", "", ""]];

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [...TABLE_HEAD],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [...BRAND_DARK],
    },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    styles: {
      lineColor: [...BORDER],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: contentW - 90 },
      1: { cellWidth: 18, halign: "center" as const },
      2: { cellWidth: 32, halign: "right" as const },
      3: { cellWidth: 40, halign: "right" as const },
    },
    margin: { left: marginL, right: marginR },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ─── TOTAL BOX ───
  const boxH = 22;
  doc.setFillColor(...LIGHT_BG);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(marginL, y, contentW, boxH, 3, 3, "FD");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_GRAY);
  doc.text(isQuote ? "QUOTE SUMMARY" : "INVOICE SUMMARY", marginL + 6, y + 7);

  let sY = y + 11;
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", marginL + 6, sY);
  doc.text(formatCurrency(subtotal), pageWidth - marginR - 6, sY, { align: "right" });
  sY += 4;

  drawHR(sY - 1);
  sY += 3;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`${totalLabel}:`, marginL + 6, sY + 1);
  doc.setTextColor(...ACCENT);
  doc.text(formatCurrency(total), pageWidth - marginR - 6, sY + 1, { align: "right" });

  y = y + boxH + 6;

  // ─── NOTES / TERMS ───
  if (notes && notes.trim()) {
    drawHR(y);
    y += 5;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_GRAY);
    doc.text(isQuote ? "TERMS" : "PAYMENT TERMS / NOTES", marginL, y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND_DARK);
    const noteLines = doc.splitTextToSize(notes.trim(), contentW);
    doc.text(noteLines, marginL, y);
    y += noteLines.length * 3.5 + 4;
  } else if (!isQuote) {
    // Default payment-terms boilerplate when no custom notes — matches
    // the existing monthly Invoice template so the doc family stays
    // consistent for recipients.
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND_GRAY);
    doc.text("Payment Terms: Due within 30 days of invoice date.", marginL, y);
    y += 6;
  }

  // ─── NOTE TO RECIPIENT ───
  // Per-doc clause (e.g. transportation contingency). Sits below TERMS
  // so the recipient reads dates first, then the conditions attached.
  if (noteToRecipient && noteToRecipient.trim()) {
    drawHR(y);
    y += 5;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_GRAY);
    doc.text("NOTE TO RECIPIENT", marginL, y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND_DARK);
    const lines = doc.splitTextToSize(noteToRecipient.trim(), contentW);
    doc.text(lines, marginL, y);
    y += lines.length * 3.5 + 4;
  }

  // ─── THANK YOU / SIGNATURE BLOCK ───
  drawHR(y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_DARK);
  doc.text(
    isQuote
      ? "Thank you for considering No Limits Academy!"
      : "Thank you for your partnership!",
    marginL,
    y,
  );
  y += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);
  doc.text(
    isQuote
      ? "Please reach out with any questions or to confirm acceptance."
      : "We truly appreciate your support and look forward to continuing our work together.",
    marginL,
    y,
  );
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_DARK);
  doc.text("Josh Mercado", marginL, y);
  y += 3.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("Program Director, No Limits Academy", marginL, y);
  y += 3.5;
  doc.text("joshmercado@nolimitsboxingacademy.org", marginL, y);

  // ─── FOOTER ───
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text(
    "www.nolimitsboxingacademy.org   •   Facebook @nolimitsboxingacademy   •   Instagram @nolimitsboxingacademy",
    pageWidth / 2,
    pageHeight - 13,
    { align: "center" },
  );
  doc.text(
    "No Limits Academy   •   Questions? Reply to joshmercado@nolimitsboxingacademy.org",
    pageWidth / 2,
    pageHeight - 9,
    { align: "center" },
  );

  return doc;
}

// Helper to load logo as base64
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

export async function downloadAdHocDocPdf(data: AdHocDocData): Promise<void> {
  const logoBase64 = await loadLogoBase64();
  const doc = generateAdHocDocPdf({ ...data, logoBase64 });
  const filenamePrefix = data.docType === "quote" ? "NLA_Quote" : "NLA_Invoice";
  doc.save(`${filenamePrefix}_${data.docNumber}.pdf`);
}

export async function getAdHocDocPdfBase64(data: AdHocDocData): Promise<string> {
  const logoBase64 = await loadLogoBase64();
  const doc = generateAdHocDocPdf({ ...data, logoBase64 });
  return doc.output("datauristring").split(",")[1];
}
