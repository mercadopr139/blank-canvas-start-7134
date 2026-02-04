import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type ServiceLog = Tables<"service_logs">;

interface LineItem {
  date: string;
  billingMethod: "hourly" | "flat_rate" | "per_day";
  hours: number | null;
  flatAmount: number | null;
  lineTotal: number;
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
    billingMethod: ((log as any).billing_method || "hourly") as "hourly" | "flat_rate",
    hours: (log as any).hours || null,
    flatAmount: (log as any).flat_amount || null,
    lineTotal: (log as any).line_total || 0,
  }));
}

function calculateSummary(lineItems: LineItem[], hourlyRate: number): InvoiceSummary {
  const hourlyItems = lineItems.filter(item => item.billingMethod === "hourly");
  const flatItems = lineItems.filter(item => item.billingMethod === "flat_rate" || item.billingMethod === "per_day");

  const totalHours = hourlyItems.reduce((sum, item) => sum + (item.hours || 0), 0);
  const hourlyTotal = totalHours * hourlyRate;
  const flatTotal = flatItems.reduce((sum, item) => sum + (item.lineTotal || item.flatAmount || 0), 0);
  const invoiceTotal = hourlyTotal + flatTotal;

  return {
    totalHours,
    hourlyRate,
    hourlyTotal,
    flatTotal,
    invoiceTotal,
  };
}

export interface InvoicePdfData {
  client: Client;
  serviceLogs: ServiceLog[];
  invoiceNumber: string;
  issueDate: Date;
  month: number;
  year: number;
}

export function generateInvoicePdf(data: InvoicePdfData): jsPDF {
  const { client, serviceLogs, invoiceNumber, issueDate, month, year } = data;
  const hourlyRate = (client as any).hourly_rate || 0;
  const serviceTime = (client as any).service_time || "";
  const serviceDays = (client as any).service_days || "";

  const lineItems = calculateLineItems(serviceLogs);
  const summary = calculateSummary(lineItems, hourlyRate);

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });
  
  // Check if this is a Per Day client
  const isPerDayClient = lineItems.some(item => item.billingMethod === "per_day") || 
                          (client as any).rate_type === "per_day";
  
  // Build formatted dates list for Per Day invoices
  const formattedDatesList = isPerDayClient && serviceLogs.length > 0
    ? [...serviceLogs]
        .sort((a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime())
        .map(log => {
          const date = new Date(log.service_date);
          return format(date, "MMM. d");
        })
        .join(", ")
    : "";

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 20, 30);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("No Limits Academy", 20, 40);
  
  // Invoice details (right side)
  doc.setFontSize(10);
  doc.text(`Invoice #: ${invoiceNumber}`, pageWidth - 70, 30);
  doc.text(`Issue Date: ${format(issueDate, "MMM d, yyyy")}`, pageWidth - 70, 37);
  doc.text(`Period: ${monthName} ${year}`, pageWidth - 70, 44);
  
  // Bill To section
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", 20, 60);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let yPos = 67;
  doc.text(client.client_name, 20, yPos);
  yPos += 6;
  
  if (client.contact_name) {
    doc.text(client.contact_name, 20, yPos);
    yPos += 6;
  }
  if (client.billing_email) {
    doc.text(client.billing_email, 20, yPos);
    yPos += 6;
  }
  if (client.billing_address) {
    const addressLines = client.billing_address.split("\n");
    addressLines.forEach((line) => {
      doc.text(line, 20, yPos);
      yPos += 5;
    });
  }

  // Rate info
  if (hourlyRate > 0) {
    doc.setFontSize(10);
    doc.text(`Hourly Rate: ${formatCurrency(hourlyRate)} / hour`, pageWidth - 70, 60);
  }

  // Service description
  if (client.service_description_default) {
    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Service Description:", 20, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.text(client.service_description_default, 20, yPos);
    yPos += 10;
  } else {
    yPos += 10;
  }

  // Per Day schedule info (Time, Days, Dates)
  if (isPerDayClient) {
    if (serviceTime) {
      doc.setFont("helvetica", "bold");
      doc.text("Time:", 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(serviceTime, 45, yPos);
      yPos += 6;
    }
    if (serviceDays) {
      doc.setFont("helvetica", "bold");
      doc.text("Day(s):", 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(serviceDays, 45, yPos);
      yPos += 6;
    }
    if (formattedDatesList) {
      doc.setFont("helvetica", "bold");
      doc.text("Date(s):", 20, yPos);
      doc.setFont("helvetica", "normal");
      // Handle long date lists by wrapping
      const maxWidth = pageWidth - 65;
      const splitDates = doc.splitTextToSize(formattedDatesList, maxWidth);
      doc.text(splitDates, 45, yPos);
      yPos += 6 * splitDates.length;
    }
    yPos += 4;
  }

  // Summary section
  const summaryStartY = Math.max(yPos, 95);
  doc.setFillColor(245, 245, 245);
  doc.rect(20, summaryStartY, pageWidth - 40, 30, "F");
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice Summary", 25, summaryStartY + 8);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  let summaryY = summaryStartY + 16;
  
  if (summary.totalHours > 0) {
    doc.text(`Hourly Services: ${summary.totalHours} hrs × ${formatCurrency(summary.hourlyRate)}/hr = ${formatCurrency(summary.hourlyTotal)}`, 25, summaryY);
    summaryY += 6;
  }
  if (summary.flatTotal > 0) {
    doc.text(`Flat Rate Services: ${formatCurrency(summary.flatTotal)}`, 25, summaryY);
    summaryY += 6;
  }
  
  doc.setFont("helvetica", "bold");
  doc.text(`Total Due: ${formatCurrency(summary.invoiceTotal)}`, pageWidth - 25, summaryStartY + 20, { align: "right" });

  // Line items table
  const tableStartY = summaryStartY + 40;
  
  const tableData = lineItems.map((item) => [
    format(new Date(item.date), "MMM d, yyyy"),
    item.billingMethod === "hourly" ? "Hourly" : "Flat Rate",
    item.billingMethod === "hourly" ? `${item.hours || 0} hrs` : "—",
    formatCurrency(item.lineTotal),
  ]);

  if (tableData.length === 0) {
    tableData.push(["", "No service logs for this period", "", ""]);
  }

  autoTable(doc, {
    startY: tableStartY,
    head: [["Date", "Type", "Hours", "Amount"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [51, 51, 51],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 40 },
      2: { cellWidth: 30, halign: "center" },
      3: { cellWidth: 40, halign: "right" },
    },
  });

  // Footer
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(128, 128, 128);
  doc.text("Thank you for your business!", 20, doc.internal.pageSize.getHeight() - 20);

  return doc;
}

export function downloadInvoicePdf(data: InvoicePdfData): void {
  const doc = generateInvoicePdf(data);
  doc.save(`NLA_Invoice_${data.invoiceNumber}.pdf`);
}

export function getInvoicePdfBase64(data: InvoicePdfData): string {
  const doc = generateInvoicePdf(data);
  return doc.output("datauristring").split(",")[1];
}
