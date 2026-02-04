import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type ServiceLog = Tables<"service_logs">;

interface LineItem {
  date: string;
  serviceType: string;
  quantity: number;
  rate: number;
  lineTotal: number;
  isIncluded?: boolean;
}

const rateTypeLabels: Record<string, string> = {
  per_day: "Per Day",
  per_session: "Per Session",
  per_hour: "Per Hour",
  flat_monthly: "Flat Monthly",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function calculateLineItems(
  serviceLogs: ServiceLog[],
  rateType: string | null,
  rateAmount: number
): LineItem[] {
  if (!rateType) return [];

  const sortedLogs = [...serviceLogs].sort(
    (a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
  );

  if (rateType === "flat_monthly") {
    return sortedLogs.map((log) => ({
      date: log.service_date,
      serviceType: log.service_type || "Fee for Service",
      quantity: log.quantity || 1,
      rate: 0,
      lineTotal: 0,
      isIncluded: true,
    }));
  }

  if (rateType === "per_day") {
    return sortedLogs.map((log) => ({
      date: log.service_date,
      serviceType: log.service_type || "Fee for Service",
      quantity: 1,
      rate: rateAmount,
      lineTotal: rateAmount,
    }));
  }

  return sortedLogs.map((log) => ({
    date: log.service_date,
    serviceType: log.service_type || "Fee for Service",
    quantity: log.quantity || 1,
    rate: rateAmount,
    lineTotal: (log.quantity || 1) * rateAmount,
  }));
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
  const rateType = client.rate_type;
  const rateAmount = client.rate_amount || 0;

  const lineItems = calculateLineItems(serviceLogs, rateType, rateAmount);
  
  const subtotal = rateType === "flat_monthly" 
    ? rateAmount 
    : lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = subtotal;

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });

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
  if (rateType) {
    doc.setFontSize(10);
    doc.text(
      `Rate: ${formatCurrency(rateAmount)} ${rateTypeLabels[rateType]}`,
      pageWidth - 70,
      60
    );
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

  // Line items table
  const tableStartY = Math.max(yPos, 95);
  
  const tableData = lineItems.map((item) => [
    format(new Date(item.date), "MMM d, yyyy"),
    item.serviceType,
    item.quantity.toString(),
    item.isIncluded ? "—" : formatCurrency(item.rate),
    item.isIncluded ? "Included" : formatCurrency(item.lineTotal),
  ]);

  if (tableData.length === 0) {
    tableData.push(["", "No service logs for this period", "", "", ""]);
  }

  autoTable(doc, {
    startY: tableStartY,
    head: [["Date", "Service Type", "Qty", "Rate", "Amount"]],
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
      0: { cellWidth: 35 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 35, halign: "right" },
    },
  });

  // Get table end position
  const finalY = (doc as any).lastAutoTable.finalY || tableStartY + 50;

  // Totals
  const totalsX = pageWidth - 70;
  doc.setFontSize(10);
  doc.text("Subtotal:", totalsX, finalY + 15);
  doc.text(formatCurrency(subtotal), pageWidth - 20, finalY + 15, { align: "right" });
  
  doc.setLineWidth(0.5);
  doc.line(totalsX, finalY + 20, pageWidth - 20, finalY + 20);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Total Due:", totalsX, finalY + 28);
  doc.text(formatCurrency(total), pageWidth - 20, finalY + 28, { align: "right" });

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
