import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Download, Mail, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { downloadInvoicePdf, getInvoicePdfBase64 } from "@/lib/generateInvoicePdf";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type ServiceLog = Tables<"service_logs">;
type Invoice = Tables<"invoices">;

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

interface InvoicePreviewProps {
  client: Client;
  serviceLogs: ServiceLog[];
  invoiceNumber: string;
  issueDate: Date;
  month: number;
  year: number;
  existingInvoice?: Invoice | null;
  onSaveDraft: (subtotal: number, total: number) => void;
  onMarkSent: () => void;
  onMarkPaid: () => void;
  onInvoiceUpdated?: () => void;
  isLoading: boolean;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-600",
  paid: "bg-green-500/10 text-green-600",
};

export default function InvoicePreview({
  client,
  serviceLogs,
  invoiceNumber,
  issueDate,
  month,
  year,
  existingInvoice,
  onSaveDraft,
  onMarkSent,
  onMarkPaid,
  onInvoiceUpdated,
  isLoading,
}: InvoicePreviewProps) {
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const hourlyRate = (client as any).hourly_rate || 0;

  // Calculate line items from service logs
  const calculateLineItems = (): LineItem[] => {
    const sortedLogs = [...serviceLogs].sort(
      (a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime()
    );

    return sortedLogs.map((log) => ({
      date: log.service_date,
      billingMethod: ((log as any).billing_method || "hourly") as "hourly" | "flat_rate" | "per_day",
      hours: (log as any).hours || null,
      flatAmount: (log as any).flat_amount || null,
      lineTotal: (log as any).line_total || 0,
    }));
  };

  const lineItems = calculateLineItems();

  // Calculate summary
  const calculateSummary = (): InvoiceSummary => {
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
  };

  const summary = calculateSummary();
  const subtotal = summary.invoiceTotal;
  const total = subtotal;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });
  const status = existingInvoice?.status || "draft";

  const pdfData = {
    client,
    serviceLogs,
    invoiceNumber: existingInvoice?.invoice_number || invoiceNumber,
    issueDate,
    month,
    year,
  };

  const handleDownloadPdf = () => {
    try {
      downloadInvoicePdf(pdfData);
      toast({ title: "PDF downloaded successfully" });
    } catch (error: any) {
      toast({ title: "Error generating PDF", description: error.message, variant: "destructive" });
    }
  };

  const handleSendInvoice = async () => {
    if (!existingInvoice) {
      toast({ title: "Please save the invoice first", variant: "destructive" });
      return;
    }

    if (!client.billing_email) {
      toast({ title: "Client has no billing email", description: "Please add a billing email to the client record.", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      const pdfBase64 = getInvoicePdfBase64(pdfData);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("send-invoice", {
        body: {
          invoiceId: existingInvoice.id,
          invoiceNumber: existingInvoice.invoice_number,
          clientName: client.client_name,
          billingEmail: client.billing_email,
          month,
          year,
          total,
          pdfBase64,
        },
      });

      if (error) throw error;

      toast({ title: "Invoice sent successfully", description: `Sent to ${client.billing_email}` });
      onInvoiceUpdated?.();
    } catch (error: any) {
      console.error("Error sending invoice:", error);
      toast({ title: "Error sending invoice", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const generateEmailDraft = () => {
    const formattedTotal = formatCurrency(total);
    return {
      subject: `Invoice ${existingInvoice?.invoice_number || invoiceNumber} – No Limits Academy`,
      body: `Dear ${client.client_name},

Please find attached your invoice for services rendered during ${monthName} ${year}.

Amount Due: ${formattedTotal}
Payment Terms: Due within 30 days of invoice date

If you have any questions regarding this invoice, please don't hesitate to contact us.

Thank you for your continued support of No Limits Academy.

Best regards,
No Limits Academy`,
    };
  };

  const handleCopyEmailDraft = () => {
    const draft = generateEmailDraft();
    const fullText = `Subject: ${draft.subject}\n\n${draft.body}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast({ title: "Email draft copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-2xl">Invoice</CardTitle>
          <p className="text-muted-foreground mt-1">
            {monthName} {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColors[status]}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invoice Header Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2">Bill To:</h3>
            <p className="font-medium">{client.client_name}</p>
            {client.contact_name && <p className="text-muted-foreground">{client.contact_name}</p>}
            {client.billing_email && <p className="text-muted-foreground">{client.billing_email}</p>}
            {client.billing_address && (
              <p className="text-muted-foreground whitespace-pre-line">{client.billing_address}</p>
            )}
          </div>
          <div className="md:text-right space-y-1">
            <p>
              <span className="text-muted-foreground">Invoice #:</span>{" "}
              <span className="font-medium">{existingInvoice?.invoice_number || invoiceNumber}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Issue Date:</span>{" "}
              <span className="font-medium">{format(issueDate, "MMM d, yyyy")}</span>
            </p>
            {hourlyRate > 0 && (
              <p>
                <span className="text-muted-foreground">Hourly Rate:</span>{" "}
                <span className="font-medium">{formatCurrency(hourlyRate)} / hour</span>
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Service Description */}
        {client.service_description_default && (
          <div>
            <h3 className="font-semibold mb-2">Service Description:</h3>
            <p className="text-muted-foreground">{client.service_description_default}</p>
          </div>
        )}

        {/* Summary Section */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold mb-3">Invoice Summary</h3>
          {summary.totalHours > 0 && (
            <div className="flex justify-between text-sm">
              <span>Hourly Services:</span>
              <span>{summary.totalHours} hrs × {formatCurrency(summary.hourlyRate)}/hr = <strong>{formatCurrency(summary.hourlyTotal)}</strong></span>
            </div>
          )}
          {summary.flatTotal > 0 && (
            <div className="flex justify-between text-sm">
              <span>Flat Rate Services:</span>
              <span><strong>{formatCurrency(summary.flatTotal)}</strong></span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold text-lg">
            <span>Total Due:</span>
            <span className="text-primary">{formatCurrency(summary.invoiceTotal)}</span>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Hours</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No service days logged yet. Add days to generate an invoice.
                  </td>
                </tr>
              ) : (
                lineItems.map((item, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-4 py-3 text-sm">
                      {format(new Date(item.date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.billingMethod === "hourly" ? "Hourly" : item.billingMethod === "per_day" ? "Per Day" : "Flat Rate"}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {item.billingMethod === "hourly" ? `${item.hours || 0} hrs` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <Separator />
        <div className="flex flex-wrap gap-3 justify-between items-center">
          {/* Left side: PDF actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadPdf} disabled={isLoading}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={handleCopyEmailDraft}>
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied!" : "Copy Email Draft"}
            </Button>
          </div>

          {/* Right side: Status actions */}
          <div className="flex flex-wrap gap-3">
            {!existingInvoice && (
              <Button onClick={() => onSaveDraft(subtotal, total)} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save as Draft"}
              </Button>
            )}
            {existingInvoice && existingInvoice.status === "draft" && (
              <>
                <Button variant="outline" onClick={() => onSaveDraft(subtotal, total)} disabled={isLoading}>
                  Update Draft
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={handleSendInvoice} 
                  disabled={isLoading || isSending || !client.billing_email}
                  title={!client.billing_email ? "Client has no billing email" : ""}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {isSending ? "Sending..." : "Send Invoice"}
                </Button>
                <Button onClick={onMarkSent} disabled={isLoading}>
                  {isLoading ? "Updating..." : "Mark as Sent"}
                </Button>
              </>
            )}
            {existingInvoice && existingInvoice.status === "sent" && (
              <Button onClick={onMarkPaid} disabled={isLoading}>
                {isLoading ? "Updating..." : "Mark as Paid"}
              </Button>
            )}
            {existingInvoice && existingInvoice.status === "paid" && (
              <p className="text-primary font-medium">✓ Invoice Paid</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
