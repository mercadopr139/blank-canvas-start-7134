import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import nlaLogo from "@/assets/nla-logo.png";

type Client = Tables<"clients">;
type ServiceLog = Tables<"service_logs">;

interface LineItem {
  date: string;
  billingMethod: "hourly" | "flat_rate" | "per_day";
  hours: number | null;
  flatAmount: number | null;
  lineTotal: number;
  serviceType: string;
}

interface InvoiceSummary {
  totalHours: number;
  hourlyRate: number;
  hourlyTotal: number;
  flatTotal: number;
  invoiceTotal: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function calculateLineItems(serviceLogs: ServiceLog[]): LineItem[] {
  const sortedLogs = [...serviceLogs].sort(
    (a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
  );

  return sortedLogs.map((log) => ({
    date: log.service_date,
    billingMethod: ((log as any).billing_method || "hourly") as "hourly" | "flat_rate" | "per_day",
    hours: (log as any).hours || null,
    flatAmount: (log as any).flat_amount || null,
    lineTotal: (log as any).line_total || 0,
    serviceType: log.service_type || "Service",
  }));
}

function calculateSummary(lineItems: LineItem[], hourlyRate: number): InvoiceSummary {
  const hourlyItems = lineItems.filter(item => item.billingMethod === "hourly");
  const flatItems = lineItems.filter(item => item.billingMethod === "flat_rate" || item.billingMethod === "per_day");

  const totalHours = hourlyItems.reduce((sum, item) => sum + (item.hours || 0), 0);
  const hourlyTotal = hourlyItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  const effectiveHourlyRate = totalHours > 0 ? hourlyTotal / totalHours : hourlyRate;
  const flatTotal = flatItems.reduce((sum, item) => sum + (item.lineTotal || item.flatAmount || 0), 0);
  const invoiceTotal = hourlyTotal + flatTotal;

  return { totalHours, hourlyRate: effectiveHourlyRate, hourlyTotal, flatTotal, invoiceTotal };
}

export interface InvoicePdfData {
  client: Client;
  serviceLogs: ServiceLog[];
  invoiceNumber: string;
  issueDate: Date;
  month: number;
  year: number;
  logoBase64?: string;
  overrideTotal?: number;
}

// ─── Colors ───
const BRAND_DARK = [17, 24, 39] as const;    // #111827
const BRAND_GRAY = [107, 114, 128] as const; // #6b7280
const LIGHT_BG = [249, 250, 251] as const;   // #f9fafb
const ACCENT = [17, 24, 39] as const;        // #111827 (black)
const TABLE_HEAD = [31, 41, 55] as const;    // #1f2937
const BORDER = [229, 231, 235] as const;     // #e5e7eb

export function generateInvoicePdf(data: InvoicePdfData): jsPDF {
  const { client, serviceLogs, invoiceNumber, issueDate, month, year, logoBase64, overrideTotal } = data;
  const hourlyRate = (client as any).hourly_rate || 0;
  const serviceTime = (client as any).service_time || "";
  const serviceDays = (client as any).service_days || "";
  const programTitle = (client as any).program_title || "Service Total";

  const lineItems = calculateLineItems(serviceLogs);
  let summary = calculateSummary(lineItems, hourlyRate);

  if (overrideTotal && overrideTotal > 0 && summary.invoiceTotal === 0) {
    summary = { ...summary, invoiceTotal: overrideTotal, hourlyTotal: overrideTotal };
  }

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });

  const isPerDayClient = lineItems.some(item => item.billingMethod === "per_day") ||
    (client as any).rate_type === "per_day";

  const formattedDatesList = isPerDayClient && serviceLogs.length > 0
    ? [...serviceLogs]
      .sort((a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime())
      .map(log => format(new Date(log.service_date), "MMM. d"))
      .join(", ")
    : "";

  const hasMultipleServices = new Set(lineItems.map(i => i.serviceType)).size > 1;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();   // 210
  const pageHeight = doc.internal.pageSize.getHeight();  // 297
  const marginL = 18;
  const marginR = 18;
  const contentW = pageWidth - marginL - marginR;

  // ─── Helper: draw horizontal rule ───
  const drawHR = (y: number) => {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(marginL, y, pageWidth - marginR, y);
  };

  // ─── HEADER BAND ───
  // Light background band
  doc.setFillColor(...LIGHT_BG);
  doc.rect(0, 0, pageWidth, 52, "F");

  // Logo
  let logoRightEdge = marginL;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", marginL, 8, 28, 28);
      logoRightEdge = marginL + 32;
    } catch (e) {
      console.error("Failed to add logo to PDF:", e);
    }
  }

  // Title
  doc.setTextColor(...BRAND_DARK);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", logoRightEdge, 22);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("No Limits Academy", logoRightEdge, 29);

  // Right-aligned meta
  const metaX = pageWidth - marginR;
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_GRAY);
  doc.text("Invoice #", metaX - 40, 14);
  doc.text("Issue Date", metaX - 40, 21);
  doc.text("Period", metaX - 40, 28);

  doc.setTextColor(...BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.text(invoiceNumber, metaX, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(format(issueDate, "MMM d, yyyy"), metaX, 21, { align: "right" });
  doc.text(`${monthName} ${year}`, metaX, 28, { align: "right" });

  // Accent stripe under header
  doc.setFillColor(...ACCENT);
  doc.rect(0, 52, pageWidth, 1.2, "F");

  // ─── BILL TO + RATE ───
  let y = 62;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("BILL TO", marginL, y);

  y += 5;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_DARK);
  doc.text(client.client_name, marginL, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);

  if (client.contact_name) { doc.text(client.contact_name, marginL, y); y += 4.5; }
  if (client.billing_email) { doc.text(client.billing_email, marginL, y); y += 4.5; }
  if (client.billing_address) {
    client.billing_address.split("\n").forEach((line) => {
      doc.text(line, marginL, y); y += 4.5;
    });
  }

  // Rate info on right
  if (hourlyRate > 0) {
    doc.setFontSize(9);
    doc.setTextColor(...BRAND_GRAY);
    doc.text("Hourly Rate", metaX - 40, 62);
    doc.setTextColor(...BRAND_DARK);
    doc.setFont("helvetica", "bold");
    doc.text(`${formatCurrency(hourlyRate)} / hr`, metaX, 62, { align: "right" });
    doc.setFont("helvetica", "normal");
  }

  // ─── SERVICE DESCRIPTION ───
  if (client.service_description_default) {
    y += 3;
    drawHR(y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_GRAY);
    doc.text("SERVICE DESCRIPTION", marginL, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND_DARK);
    const descLines = doc.splitTextToSize(client.service_description_default, contentW);
    doc.text(descLines, marginL, y);
    y += descLines.length * 4.5;
  }

  // ─── PER DAY SCHEDULE ───
  if (isPerDayClient && (serviceTime || serviceDays || formattedDatesList)) {
    y += 3;
    drawHR(y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_GRAY);
    doc.text("SCHEDULE", marginL, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...BRAND_DARK);

    if (serviceTime) {
      doc.setFont("helvetica", "bold");
      doc.text("Time:", marginL, y);
      doc.setFont("helvetica", "normal");
      doc.text(serviceTime, marginL + 18, y);
      y += 4.5;
    }
    if (serviceDays) {
      doc.setFont("helvetica", "bold");
      doc.text("Day(s):", marginL, y);
      doc.setFont("helvetica", "normal");
      doc.text(serviceDays, marginL + 18, y);
      y += 4.5;
    }
    if (formattedDatesList) {
      doc.setFont("helvetica", "bold");
      doc.text("Date(s):", marginL, y);
      doc.setFont("helvetica", "normal");
      const splitDates = doc.splitTextToSize(formattedDatesList, contentW - 20);
      doc.text(splitDates, marginL + 18, y);
      y += 4.5 * splitDates.length;
    }
  }

  // ─── LINE ITEMS TABLE ───
  y += 4;
  drawHR(y);
  y += 2;

  const tableHead = hasMultipleServices
    ? [["Date", "Service", "Type", "Hours", "Amount"]]
    : [["Date", "Type", "Hours", "Amount"]];

  const tableData = lineItems.map((item) => {
    const row = [
      format(new Date(item.date), "MMM d, yyyy"),
      ...(hasMultipleServices ? [item.serviceType] : []),
      item.billingMethod === "hourly" ? "Hourly" : item.billingMethod === "per_day" ? "Per Day" : "Flat Rate",
      item.billingMethod === "hourly" ? `${item.hours || 0} hrs` : "—",
      formatCurrency(item.lineTotal),
    ];
    return row;
  });

  if (tableData.length === 0) {
    const cols = hasMultipleServices ? 5 : 4;
    const emptyRow = Array(cols).fill("");
    emptyRow[1] = "No service logs for this period";
    tableData.push(emptyRow);
  }

  const colStyles: Record<number, any> = hasMultipleServices
    ? {
      0: { cellWidth: 30 },
      1: { cellWidth: 38 },
      2: { cellWidth: 28 },
      3: { cellWidth: 24, halign: "center" as const },
      4: { cellWidth: 30, halign: "right" as const },
    }
    : {
      0: { cellWidth: 38 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30, halign: "center" as const },
      3: { cellWidth: 35, halign: "right" as const },
    };

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [...TABLE_HEAD],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: 3.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [...BRAND_DARK],
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    styles: {
      lineColor: [...BORDER],
      lineWidth: 0.2,
    },
    columnStyles: colStyles,
    margin: { left: marginL, right: marginR },
  });

  // Get Y after table
  y = (doc as any).lastAutoTable.finalY + 6;

  // ─── SUMMARY BOX ───
  // Ensure enough space for summary + signature (about 65mm)
  if (y + 65 > pageHeight - 20) {
    doc.addPage();
    y = 20;
  }

  const boxH = summary.totalHours > 0 && summary.flatTotal > 0 ? 42 : 34;
  doc.setFillColor(...LIGHT_BG);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(marginL, y, contentW, boxH, 3, 3, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("INVOICE SUMMARY", marginL + 6, y + 7);

  let sY = y + 14;
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_DARK);

  if (summary.totalHours > 0) {
    doc.setFont("helvetica", "normal");
    doc.text(`Hourly Services: ${summary.totalHours} hrs × ${formatCurrency(summary.hourlyRate)}/hr`, marginL + 6, sY);
    doc.text(formatCurrency(summary.hourlyTotal), pageWidth - marginR - 6, sY, { align: "right" });
    sY += 6;
  }
  if (summary.flatTotal > 0) {
    doc.setFont("helvetica", "normal");
    doc.text(`${programTitle}:`, marginL + 6, sY);
    doc.text(formatCurrency(summary.flatTotal), pageWidth - marginR - 6, sY, { align: "right" });
    sY += 6;
  }

  // Total line
  drawHR(sY - 1);
  sY += 3;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Total Due:", marginL + 6, sY + 1);
  doc.setTextColor(...ACCENT);
  doc.text(formatCurrency(summary.invoiceTotal), pageWidth - marginR - 6, sY + 1, { align: "right" });

  y = y + boxH + 6;

  // ─── PAYMENT TERMS ───
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("Payment Terms: Due within 30 days of invoice date.", marginL, y);
  y += 10;

  // ─── THANK YOU SIGNATURE ───
  if (y + 40 > pageHeight - 15) {
    doc.addPage();
    y = 20;
  }

  drawHR(y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_DARK);
  doc.text("Thank you for your partnership!", marginL, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("We truly appreciate your support and look forward to continuing our work together.", marginL, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_DARK);
  doc.text("Josh Mercado", marginL, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("Program Director, No Limits Academy", marginL, y);
  y += 4;
  doc.text("joshmercado@nolimitsboxingacademy.org", marginL, y);

  // ─── FOOTER ───
  const footerY = pageHeight - 10;
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text("No Limits Academy  •  If you have questions, reply to joshmercado@nolimitsboxingacademy.org", pageWidth / 2, footerY, { align: "center" });

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

export async function downloadInvoicePdf(data: InvoicePdfData): Promise<void> {
  const logoBase64 = await loadLogoBase64();
  const doc = generateInvoicePdf({ ...data, logoBase64 });
  doc.save(`NLA_Invoice_${data.invoiceNumber}.pdf`);
}

export async function getInvoicePdfBase64(data: InvoicePdfData): Promise<string> {
  const logoBase64 = await loadLogoBase64();
  const doc = generateInvoicePdf({ ...data, logoBase64 });
  return doc.output("datauristring").split(",")[1];
}
