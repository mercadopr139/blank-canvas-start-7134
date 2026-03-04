import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Mail, CheckCircle, Clock, Send } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"invoices">;

interface SentInvoice extends Invoice {
  client_name?: string;
}

interface SendHistoryItem {
  id: string;
  invoice_id: string;
  sent_to: string;
  subject: string;
  message: string | null;
  sent_at: string;
  type: string;
  status: string;
  error: string | null;
}

interface SentInvoicesTableProps {
  invoices: SentInvoice[];
  sendHistory: SendHistoryItem[];
}

export default function SentInvoicesTable({ invoices, sendHistory }: SentInvoicesTableProps) {
  const sentInvoices = invoices.filter(inv => inv.status === "sent" || inv.status === "paid");

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a");
  };

  // Build a combined view: use send history if available, fall back to invoice records
  const historyWithInvoiceInfo = sendHistory.map(h => {
    const inv = invoices.find(i => i.id === h.invoice_id);
    return { ...h, invoice_number: inv?.invoice_number || "—", client_name: (inv as any)?.client_name || "—" };
  });

  const hasHistory = historyWithInvoiceInfo.length > 0;

  if (!hasHistory && sentInvoices.length === 0) {
    return (
      <div className="p-12 text-center">
        <Mail className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-lg mb-1">No sent invoices yet</h3>
        <p className="text-muted-foreground text-sm">
          When you send invoices via email, they'll appear here for easy tracking.
        </p>
      </div>
    );
  }

  // If we have send history, show the detailed view
  if (hasHistory) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Partner</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Sent To</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Date/Time</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {historyWithInvoiceInfo.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.invoice_number}</TableCell>
              <TableCell>{item.client_name}</TableCell>
              <TableCell>
                {item.type === "resend" ? (
                  <Badge className="bg-sky-500/10 text-sky-600">
                    <Send className="w-3 h-3 mr-1" />
                    Resend
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500/10 text-blue-600">
                    <Mail className="w-3 h-3 mr-1" />
                    Initial
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm">{item.sent_to}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm truncate max-w-[200px] block">{item.subject}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm">{formatDateTime(item.sent_at)}</span>
              </TableCell>
              <TableCell>
                {item.status === "success" ? (
                  <Badge className="bg-green-500/10 text-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Sent
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-600">
                    Failed
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // Fallback: show old-style sent invoices
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice #</TableHead>
          <TableHead>Partner</TableHead>
          <TableHead>Sent To</TableHead>
          <TableHead>Sent At</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sentInvoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
            <TableCell>{invoice.client_name || "—"}</TableCell>
            <TableCell>
              <span className="text-sm">{invoice.sent_to || "—"}</span>
            </TableCell>
            <TableCell>
              <span className="text-sm">{formatDateTime(invoice.sent_at)}</span>
            </TableCell>
            <TableCell>
              {invoice.status === "paid" ? (
                <Badge className="bg-green-500/10 text-green-600">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Paid
                </Badge>
              ) : invoice.sent_at ? (
                <Badge className="bg-blue-500/10 text-blue-600">
                  <Mail className="w-3 h-3 mr-1" />
                  Email Sent
                </Badge>
              ) : (
                <Badge className="bg-amber-500/10 text-amber-600">
                  <Clock className="w-3 h-3 mr-1" />
                  Marked Sent
                </Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
