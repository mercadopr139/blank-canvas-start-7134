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
  serviceType: string;
  quantity: number;
  rate: number;
  lineTotal: number;
  isIncluded?: boolean;
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

const rateTypeLabels: Record<string, string> = {
  per_day: "Per Day",
  per_session: "Per Session",
  per_hour: "Per Hour",
  flat_monthly: "Flat Monthly",
};

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
  
  const rateType = client.rate_type;
  const rateAmount = client.rate_amount || 0;

  // Calculate line items based on rate type
  const calculateLineItems = (): LineItem[] => {
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
  };

  const lineItems = calculateLineItems();

  const calculateSubtotal = (): number => {
    if (rateType === "flat_monthly") {
      return rateAmount;
    }
    return lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  };

  const subtotal = calculateSubtotal();
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
            <p>
              <span className="text-muted-foreground">Rate:</span>{" "}
              <span className="font-medium">
                {formatCurrency(rateAmount)} {rateType && rateTypeLabels[rateType]}
              </span>
            </p>
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

        {/* Line Items Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Service Type</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Qty</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Rate</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No service logs for this period
                  </td>
                </tr>
              ) : (
                lineItems.map((item, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-4 py-3 text-sm">
                      {format(new Date(item.date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-sm">{item.serviceType}</td>
                    <td className="px-4 py-3 text-sm text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      {item.isIncluded ? "—" : formatCurrency(item.rate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {item.isIncluded ? (
                        <span className="text-muted-foreground italic">Included</span>
                      ) : (
                        formatCurrency(item.lineTotal)
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold text-lg">
              <span>Total:</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
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
