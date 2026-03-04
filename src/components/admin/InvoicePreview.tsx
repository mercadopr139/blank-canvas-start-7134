import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Download, Mail, Copy, Check, ShieldCheck, Clock, XCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { downloadInvoicePdf, getInvoicePdfBase64 } from "@/lib/generateInvoicePdf";
import type { Tables } from "@/integrations/supabase/types";
import SendInvoiceModal from "./SendInvoiceModal";
import ApprovalRequestModal from "./ApprovalRequestModal";
import nlaLogo from "@/assets/nla-logo.png";

type Client = Tables<"clients">;
type ServiceLog = Tables<"service_logs">;
type Invoice = Tables<"invoices">;

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

interface ServiceGroup {
  serviceName: string;
  items: LineItem[];
  subtotal: number;
}
interface InvoicePreviewProps {
  client: Client;
  serviceLogs: ServiceLog[];
  invoiceNumber: string;
  issueDate: Date;
  month: number;
  year: number;
  existingInvoice?: Invoice | null;
  onSaveDraft: (subtotal: number, total: number, pdfBase64: string) => void;
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
  const [showSendModal, setShowSendModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const { toast } = useToast();
  
  // Get rate info - for display purposes, we derive from line items if client rate is 0
  const clientHourlyRate = (client as any).hourly_rate || 0;

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
      serviceType: log.service_type || "Service",
    }));
  };

  const lineItems = calculateLineItems();

  // Group line items by service type
  const serviceGroups: ServiceGroup[] = useMemo(() => {
    const groups: Record<string, LineItem[]> = {};
    
    lineItems.forEach((item) => {
      const key = item.serviceType;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });

    return Object.entries(groups).map(([serviceName, items]) => ({
      serviceName,
      items,
      subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
    }));
  }, [lineItems]);

  const hasMultipleServices = serviceGroups.length > 1;
  // Calculate summary
  const calculateSummary = (): InvoiceSummary => {
    const hourlyItems = lineItems.filter(item => item.billingMethod === "hourly");
    const flatItems = lineItems.filter(item => item.billingMethod === "flat_rate" || item.billingMethod === "per_day");

    const totalHours = hourlyItems.reduce((sum, item) => sum + (item.hours || 0), 0);
    const hourlyTotal = hourlyItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
    const effectiveHourlyRate = totalHours > 0 ? hourlyTotal / totalHours : clientHourlyRate;
    const flatTotal = flatItems.reduce((sum, item) => sum + (item.lineTotal || item.flatAmount || 0), 0);
    const invoiceTotal = hourlyTotal + flatTotal;

    return {
      totalHours,
      hourlyRate: effectiveHourlyRate,
      hourlyTotal,
      flatTotal,
      invoiceTotal,
    };
  };

  const summary = calculateSummary();
  // When service logs have been cleared but invoice exists with a saved total, use the DB value
  const hasNoLogs = lineItems.length === 0;
  const storedTotal = existingInvoice?.total ? Number(existingInvoice.total) : 0;
  const storedSubtotal = existingInvoice?.subtotal ? Number(existingInvoice.subtotal) : 0;
  const subtotal = hasNoLogs && storedSubtotal > 0 ? storedSubtotal : summary.invoiceTotal;
  const total = hasNoLogs && storedTotal > 0 ? storedTotal : subtotal;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });
  const approvalStatus = (existingInvoice as any)?.approval_status || "draft";
  const status = existingInvoice?.status || "draft";

  const pdfData = {
    client,
    serviceLogs,
    invoiceNumber: existingInvoice?.invoice_number || invoiceNumber,
    issueDate,
    month,
    year,
    overrideTotal: total,
  };

  const handleDownloadPdf = async () => {
    try {
      await downloadInvoicePdf(pdfData);
      toast({ title: "PDF downloaded successfully" });
    } catch (error: any) {
      toast({ title: "Error generating PDF", description: error.message, variant: "destructive" });
    }
  };

  /** Generate PDF and save draft with locked-in total + PDF */
  const handleSaveDraftWithPdf = async () => {
    setIsSavingDraft(true);
    try {
      const pdfBase64 = await getInvoicePdfBase64(pdfData);
      onSaveDraft(subtotal, total, pdfBase64);
    } catch (error: any) {
      toast({ title: "Error generating PDF", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!existingInvoice) {
      toast({ title: "Please save the invoice first", variant: "destructive" });
      return;
    }

    // Ensure we have a stored PDF before submitting
    const storedPdf = (existingInvoice as any).pdf_base64;
    if (!storedPdf || storedTotal <= 0) {
      // Regenerate and store PDF first
      setIsSavingDraft(true);
      try {
        const pdfBase64 = await getInvoicePdfBase64(pdfData);
        const { error: saveError } = await supabase
          .from("invoices")
          .update({
            subtotal,
            total,
            pdf_base64: pdfBase64,
            pdf_generated_at: new Date().toISOString(),
          })
          .eq("id", existingInvoice.id);
        if (saveError) throw saveError;
      } catch (error: any) {
        toast({ title: "Error saving PDF", description: error.message, variant: "destructive" });
        setIsSavingDraft(false);
        return;
      }
      setIsSavingDraft(false);
    }

    setIsSubmittingApproval(true);
    try {
      // Update invoice approval status
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          approval_status: "pending_approval",
          approval_request_sent_at: new Date().toISOString(),
        })
        .eq("id", existingInvoice.id);

      if (updateError) throw updateError;

      // Create approval record
      const { data: approvalData, error: approvalError } = await supabase
        .from("invoice_approvals")
        .insert({
          invoice_id: existingInvoice.id,
          requested_by_user_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (approvalError) throw approvalError;

      // Send approval email
      await supabase.functions.invoke("send-approval-request", {
        body: {
          invoiceId: existingInvoice.id,
          invoiceNumber: existingInvoice.invoice_number,
          clientName: client.client_name,
          month,
          year,
          total,
          approvalToken: approvalData.token,
        },
      });

      setShowApprovalModal(true);
      toast({ title: "Approval request sent to Chrissy" });
      onInvoiceUpdated?.();
    } catch (error: any) {
      toast({ title: "Error submitting for approval", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleResendApproval = async () => {
    if (!existingInvoice) return;
    
    const { data: approval } = await supabase
      .from("invoice_approvals")
      .select("token")
      .eq("invoice_id", existingInvoice.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!approval) {
      await handleSubmitForApproval();
      return;
    }

    await supabase.functions.invoke("send-approval-request", {
      body: {
        invoiceId: existingInvoice.id,
        invoiceNumber: existingInvoice.invoice_number,
        clientName: client.client_name,
        month,
        year,
        total,
        approvalToken: approval.token,
      },
    });

    toast({ title: "Approval request resent to Chrissy" });
  };

  const handleOpenSendModal = () => {
    if (!existingInvoice) {
      toast({ title: "Please save the invoice first", variant: "destructive" });
      return;
    }

    // For invoices that haven't been sent yet, require approval
    // For already-sent invoices (resend), skip approval check
    const alreadySent = existingInvoice.status === "sent" || existingInvoice.status === "paid";
    if (!alreadySent && approvalStatus !== "approved") {
      if (approvalStatus === "pending_approval") {
        toast({ title: "Waiting for approval from Chrissy", description: "Invoice cannot be sent until approved.", variant: "destructive" });
      } else if (approvalStatus === "rejected") {
        toast({ title: "Invoice was rejected", description: "Cannot send until corrected and re-submitted for approval.", variant: "destructive" });
      } else {
        toast({ title: "Submit for approval first", description: "Invoice must be approved before sending.", variant: "destructive" });
      }
      return;
    }

    // Hard block: must have stored PDF and valid total
    const storedPdf = (existingInvoice as any).pdf_base64;
    const invoiceTotal = existingInvoice.total ? Number(existingInvoice.total) : 0;

    if (!storedPdf || invoiceTotal <= 0) {
      toast({ 
        title: "Cannot send: invoice PDF or total is missing", 
        description: "Please regenerate the invoice by clicking 'Regenerate PDF' first.",
        variant: "destructive" 
      });
      return;
    }

    if (!client.billing_email) {
      toast({ title: "Client has no billing email", description: "Please add a billing email to the client record.", variant: "destructive" });
      return;
    }

    setShowSendModal(true);
  };

  /** Send invoice using STORED PDF and STORED total — never regenerate */
  const handleSendInvoice = async (emailNote: string) => {
    if (!existingInvoice) return;

    const storedPdf = (existingInvoice as any).pdf_base64 as string | null;
    const invoiceTotal = existingInvoice.total ? Number(existingInvoice.total) : 0;

    if (!storedPdf || invoiceTotal <= 0) {
      toast({ 
        title: "Cannot send: invoice PDF or total is missing", 
        description: "Please regenerate the invoice by clicking 'Update Draft' first.",
        variant: "destructive" 
      });
      return;
    }

    setIsSending(true);
    try {
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
          total: invoiceTotal, // USE STORED TOTAL
          pdfBase64: storedPdf, // USE STORED PDF
          emailNote: emailNote || null,
        },
      });

      if (error) throw error;

      setShowSendModal(false);
      const sentTime = new Date().toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      toast({ 
        title: "✓ Invoice sent successfully", 
        description: (
          <div className="mt-1 space-y-1 text-sm">
            <p><span className="text-muted-foreground">To:</span> {client.billing_email}</p>
            <p><span className="text-muted-foreground">Invoice:</span> {existingInvoice.invoice_number}</p>
            <p><span className="text-muted-foreground">Amount:</span> {formatCurrency(invoiceTotal)}</p>
            <p><span className="text-muted-foreground">Sent:</span> {sentTime}</p>
          </div>
        ),
        duration: 8000,
      });
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

  // Check if stored PDF exists
  const hasPdf = !!(existingInvoice as any)?.pdf_base64;
  const pdfGeneratedAt = (existingInvoice as any)?.pdf_generated_at;

  return (
    <>
    <SendInvoiceModal
      open={showSendModal}
      onOpenChange={setShowSendModal}
      onSend={handleSendInvoice}
      clientName={client.client_name}
      billingEmail={client.billing_email || ""}
      invoiceNumber={existingInvoice?.invoice_number || invoiceNumber}
      existingNote={(existingInvoice as any)?.email_note}
      isSending={isSending}
    />
    <ApprovalRequestModal
      open={showApprovalModal}
      onOpenChange={setShowApprovalModal}
      invoiceNumber={existingInvoice?.invoice_number || invoiceNumber}
      clientName={client.client_name}
      onResendApproval={handleResendApproval}
      approvalStatus={approvalStatus}
    />
    <Card className="w-full">
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="flex items-start gap-4">
          <img src={nlaLogo} alt="No Limits Academy" className="h-16 w-auto" />
          <div>
            <CardTitle className="text-2xl">Invoice</CardTitle>
            <p className="text-muted-foreground mt-1">
              {monthName} {year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColors[status]}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
          {approvalStatus === "pending_approval" && (
            <Badge className="bg-amber-500/10 text-amber-600">
              <Clock className="w-3 h-3 mr-1" />
              Pending Approval
            </Badge>
          )}
          {approvalStatus === "approved" && (
            <Badge className="bg-green-500/10 text-green-600">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Approved
            </Badge>
          )}
          {approvalStatus === "rejected" && (
            <Badge className="bg-red-500/10 text-red-600">
              <XCircle className="w-3 h-3 mr-1" />
              Rejected
            </Badge>
          )}
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
            {summary.hourlyRate > 0 && (
              <p>
                <span className="text-muted-foreground">Hourly Rate:</span>{" "}
                <span className="font-medium">{formatCurrency(summary.hourlyRate)} / hour</span>
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
          {hasMultipleServices ? (
            serviceGroups.map((group) => (
              <div key={group.serviceName} className="flex justify-between text-sm">
                <span>{group.serviceName}:</span>
                <span><strong>{formatCurrency(group.subtotal)}</strong></span>
              </div>
            ))
          ) : (
            <>
              {summary.totalHours > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Hourly Services:</span>
                  <span>{summary.totalHours} hrs × {formatCurrency(summary.hourlyRate)}/hr = <strong>{formatCurrency(summary.hourlyTotal)}</strong></span>
                </div>
              )}
              {summary.flatTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span>{(client as any).program_title || "Service Total"}:</span>
                  <span><strong>{formatCurrency(summary.flatTotal)}</strong></span>
                </div>
              )}
            </>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold text-lg">
            <span>Total Due:</span>
            <span className="text-primary">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* PDF Status Indicator */}
        {existingInvoice && (
          <div className={`flex items-center gap-2 text-xs ${hasPdf ? 'text-green-600' : 'text-amber-600'}`}>
            {hasPdf ? (
              <>
                <Check className="w-3 h-3" />
                <span>PDF locked{pdfGeneratedAt ? ` on ${format(new Date(pdfGeneratedAt), "MMM d, yyyy 'at' h:mm a")}` : ''}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3" />
                <span>PDF not yet generated — save/update draft to lock the PDF</span>
              </>
            )}
          </div>
        )}

        {/* Line Items Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                {hasMultipleServices && (
                  <th className="px-4 py-3 text-left text-sm font-medium">Service</th>
                )}
                <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Hours</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={hasMultipleServices ? 5 : 4} className="px-4 py-8 text-center text-muted-foreground">
                    {storedTotal > 0 
                      ? `Service days cleared. Stored total: ${formatCurrency(storedTotal)}`
                      : "No service days logged yet. Add days to generate an invoice."}
                  </td>
                </tr>
              ) : (
                lineItems.map((item, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-4 py-3 text-sm">
                      {format(new Date(item.date), "MMM d, yyyy")}
                    </td>
                    {hasMultipleServices && (
                      <td className="px-4 py-3 text-sm">
                        {item.serviceType}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm">
                      {item.billingMethod === "hourly" ? "Hourly" : item.billingMethod === "per_day" ? "Per Day" : "Monthly Program Cost"}
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

        {/* Approval Status Banner */}
        {existingInvoice && approvalStatus === "pending_approval" && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Clock className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Waiting for approval from Chrissy</p>
              <p className="text-xs text-muted-foreground">Invoice cannot be sent to vendor until approved.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowApprovalModal(true)}>
              View Status
            </Button>
          </div>
        )}
        {existingInvoice && approvalStatus === "rejected" && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <XCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Invoice rejected by Chrissy</p>
              {(existingInvoice as any)?.approval_notes && (
                <p className="text-xs text-muted-foreground mt-1">
                  Notes: {(existingInvoice as any).approval_notes}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleSubmitForApproval} disabled={isSubmittingApproval}>
              Re-submit for Approval
            </Button>
          </div>
        )}
        {existingInvoice && approvalStatus === "approved" && existingInvoice.status === "draft" && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <ShieldCheck className="w-5 h-5 text-green-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Approved by Chrissy — ready to send!</p>
            </div>
            <Button size="sm" onClick={handleOpenSendModal} disabled={isLoading || !client.billing_email}>
              <Mail className="w-4 h-4 mr-2" />
              Send to Vendor
            </Button>
          </div>
        )}

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
            {/* Save / Regenerate PDF — always available */}
            {!existingInvoice && (
              <Button onClick={handleSaveDraftWithPdf} disabled={isLoading || isSavingDraft}>
                {isSavingDraft ? "Generating PDF..." : "Save as Draft"}
              </Button>
            )}
            {existingInvoice && (
              <Button variant="outline" onClick={handleSaveDraftWithPdf} disabled={isLoading || isSavingDraft}>
                {isSavingDraft ? "Generating PDF..." : hasPdf ? "Regenerate PDF" : "Generate & Lock PDF"}
              </Button>
            )}

            {/* Submit for Approval — available when not yet submitted or after rejection */}
            {existingInvoice && (approvalStatus === "draft" || approvalStatus === "rejected") && (
              <Button 
                variant="secondary" 
                onClick={handleSubmitForApproval} 
                disabled={isLoading || isSubmittingApproval}
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                {isSubmittingApproval ? "Submitting..." : approvalStatus === "rejected" ? "Re-submit for Approval" : "Submit for Approval"}
              </Button>
            )}

            {/* Send to Vendor — available when approved */}
            {existingInvoice && approvalStatus === "approved" && (
              <Button 
                variant="secondary" 
                onClick={handleOpenSendModal} 
                disabled={isLoading || !client.billing_email}
                title={!client.billing_email ? "Client has no billing email" : ""}
              >
                <Mail className="w-4 h-4 mr-2" />
                {status === "sent" || status === "paid" ? "Resend Invoice" : "Send Invoice"}
              </Button>
            )}

            {/* Status progression */}
            {existingInvoice && status === "draft" && (
              <Button onClick={onMarkSent} disabled={isLoading}>
                {isLoading ? "Updating..." : "Mark as Sent"}
              </Button>
            )}
            {existingInvoice && status === "sent" && (
              <Button onClick={onMarkPaid} disabled={isLoading}>
                {isLoading ? "Updating..." : "Mark as Paid"}
              </Button>
            )}
            {existingInvoice && status === "paid" && (
              <p className="text-primary font-medium">✓ Invoice Paid</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
