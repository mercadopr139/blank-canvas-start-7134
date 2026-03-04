import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, FileText, AlertCircle } from "lucide-react";

import nlaLogo from "@/assets/nla-logo.png";

interface ApprovalData {
  approval: {
    id: string;
    invoice_id: string;
    status: string;
    approver_email: string;
    notes: string | null;
    responded_at: string | null;
  };
  invoice: {
    id: string;
    invoice_number: string;
    invoice_month: number;
    invoice_year: number;
    total: number;
    status: string;
    approval_status: string;
  };
  clientName: string;
}

export default function InvoiceApproval() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<"approved" | "rejected" | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchApproval();
  }, [token]);

  const fetchApproval = async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/handle-invoice-approval?token=${token}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to load approval");
      }

      const approvalData = await response.json();
      setData(approvalData);

      // If already responded, show the result
      if (approvalData.approval.status !== "pending") {
        setSubmitted(approvalData.approval.status as "approved" | "rejected");
        setNotes(approvalData.approval.notes || "");
      }
    } catch (err: any) {
      setError(err.message || "Invalid or expired approval link");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: "approve" | "reject") => {
    if (!token) return;
    setSubmitting(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/handle-invoice-approval`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ token, action, notes: notes.trim() || null }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to submit response");
      }

      setSubmitted(action === "approve" ? "approved" : "rejected");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const getMonthName = (month: number, year: number) =>
    new Date(year, month - 1).toLocaleString("default", { month: "long" });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Unable to Load Approval</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { invoice, clientName } = data;

  // Already submitted
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            {submitted === "approved" ? (
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            ) : (
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
            )}
            <h2 className="text-xl font-semibold">
              {submitted === "approved" ? "Invoice Approved" : "Invoice Rejected"}
            </h2>
            <p className="text-muted-foreground">
              {submitted === "approved"
                ? "Thanks — your approval has been recorded. Josh can now send this invoice to the vendor."
                : "Thanks — your response has been recorded. Josh will review your notes and make corrections."}
            </p>
            {notes && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-left mt-4">
                <p className="font-medium mb-1">Your notes:</p>
                <p className="text-muted-foreground">{notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <img src={nlaLogo} alt="No Limits Academy" className="h-16 w-auto mx-auto" />
          <h1 className="text-2xl font-bold">Invoice Approval</h1>
          <p className="text-muted-foreground">Please review and approve or reject this invoice</p>
        </div>

        {/* Invoice Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5" />
              {invoice.invoice_number}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="font-medium">{clientName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Period</p>
                <p className="font-medium">
                  {getMonthName(invoice.invoice_month, invoice.invoice_year)} {invoice.invoice_year}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-2xl font-bold">{formatCurrency(invoice.total || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="outline" className="mt-1">Pending Approval</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes + Actions */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes or feedback…"
                rows={3}
                className="resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-3">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleAction("approve")}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Approve
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleAction("reject")}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
