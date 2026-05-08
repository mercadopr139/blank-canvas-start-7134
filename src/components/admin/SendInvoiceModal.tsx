import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Send, AlertCircle, Eye } from "lucide-react";
import {
  renderInvoiceEmailHtml,
  buildInvoiceEmailSubject,
  type InvoiceEmailMode,
} from "@/lib/invoiceEmailTemplate";

interface SendInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (note: string, recipientEmail: string, html: string, subject: string) => void;
  clientName: string;
  billingEmail: string;
  invoiceNumber: string;
  month: number;
  year: number;
  total: number;
  existingNote?: string | null;
  isSending: boolean;
  /** "initial" or "resend" */
  mode?: InvoiceEmailMode;
}

const MAX_NOTE_LENGTH = 1000;

export default function SendInvoiceModal({
  open,
  onOpenChange,
  onSend,
  clientName,
  billingEmail,
  invoiceNumber,
  month,
  year,
  total,
  existingNote,
  isSending,
  mode = "initial",
}: SendInvoiceModalProps) {
  const [note, setNote] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });
  const periodLabel = `${monthName} ${year}`;
  const formattedTotal = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total);

  useEffect(() => {
    if (open) {
      setNote(existingNote || "");
      setToEmail(billingEmail);
      setShowPreview(false);
    }
  }, [open, existingNote, billingEmail]);

  const isResend = mode === "resend";
  const remainingChars = MAX_NOTE_LENGTH - note.length;

  const subject = buildInvoiceEmailSubject({ mode, invoiceNumber, clientName, periodLabel });

  const previewHtml = renderInvoiceEmailHtml({
    mode,
    invoiceNumber,
    clientName,
    periodLabel,
    total: formattedTotal,
    note,
  });

  const handleSend = () => {
    onSend(note.trim(), toEmail.trim(), previewHtml, subject);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isResend ? <Send className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
            {isResend ? "Resend Invoice" : "Send Invoice"}
          </DialogTitle>
          <DialogDescription>
            {isResend ? "Send a reminder" : "Send invoice"} <strong>{invoiceNumber}</strong> to{" "}
            <strong>{clientName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* To field */}
          <div className="space-y-2">
            <Label htmlFor="send-to">To</Label>
            <Input
              id="send-to"
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="vendor@example.com"
            />
          </div>

          {/* Subject (read-only display) */}
          <div className="space-y-2">
            <Label>Subject</Label>
            <div className="px-3 py-2 rounded-md border bg-muted/50 text-sm text-muted-foreground">
              {subject}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="email-note">Message / Note (optional)</Label>
            <Textarea
              id="email-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
              placeholder="Add a short message that will appear in the email…"
              rows={4}
              className="resize-none"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {note.length > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    This note will appear in a highlighted box in the email.
                  </span>
                )}
              </span>
              <span className={remainingChars < 100 ? "text-orange-500" : ""}>
                {remainingChars} characters remaining
              </span>
            </div>
          </div>

          {/* Amount (read-only) */}
          <div className="bg-muted/50 rounded-md p-3 text-sm flex items-center gap-2">
            <span className="text-muted-foreground">Amount:</span>
            <strong>{formattedTotal}</strong>
            <span className="text-muted-foreground text-xs">(from stored invoice)</span>
          </div>

          {/* Preview toggle */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowPreview(!showPreview)}
            type="button"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? "Hide Preview" : "Preview Email"}
          </Button>

          {showPreview && (
            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !toEmail.trim()}>
            {isResend ? <Send className="w-4 h-4 mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
            {isSending ? "Sending..." : isResend ? "Send Reminder" : "Send Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
