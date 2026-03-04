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

interface SendInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (note: string, recipientEmail: string) => void;
  clientName: string;
  billingEmail: string;
  invoiceNumber: string;
  month: number;
  year: number;
  total: number;
  existingNote?: string | null;
  isSending: boolean;
  /** "initial" or "resend" */
  mode?: "initial" | "resend";
}

const MAX_NOTE_LENGTH = 1000;

const LOGO_URL = "https://qnjpurehimuqppyrfxui.supabase.co/storage/v1/object/public/email-assets/nla-logo.png";

function buildPreviewHtml({
  mode,
  invoiceNumber,
  periodLabel,
  total,
  note,
}: {
  mode: "initial" | "resend";
  invoiceNumber: string;
  periodLabel: string;
  total: string;
  note?: string;
}): string {
  const titleLine = mode === "resend"
    ? `Reminder: Invoice ${invoiceNumber}`
    : `Invoice ${invoiceNumber}`;

  const trimmedNote = note?.trim();
  const noteHtml = trimmedNote
    ? `<div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 16px 18px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #1e3a5f; white-space: pre-wrap;">${trimmedNote.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      </div>`
    : "";

  return `<div style="background-color: #f3f4f6; padding: 24px 12px; font-family: Arial, Helvetica, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="padding: 28px 28px 18px; border-bottom: 2px solid #e5e7eb; text-align: center;">
      <img src="${LOGO_URL}" alt="No Limits Academy" style="max-height: 48px;" />
      <p style="margin: 10px 0 0; font-size: 16px; font-weight: 700; color: #111827;">No Limits Academy</p>
    </div>
    <div style="padding: 28px;">
      <h1 style="margin: 0 0 20px; font-size: 22px; font-weight: 700; color: #111827;">${titleLine}</h1>
      ${noteHtml}
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 22px; text-align: center; margin-bottom: 20px;">
        <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Amount Due</p>
        <p style="margin: 0 0 12px; font-size: 30px; font-weight: 800; color: #111827;">${total}</p>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">Payment Terms: Due within 30 days of invoice date</p>
      </div>
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #374151;">Please find attached your invoice for services rendered during <strong>${periodLabel}</strong>.</p>
    </div>
    <div style="padding: 18px 28px; border-top: 1px solid #e5e7eb; background: #fafafa;">
      <p style="margin: 0; font-size: 13px; color: #9ca3af;">If you have questions, reply to this email.</p>
    </div>
  </div>
</div>`;
}

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

  const handleSend = () => {
    onSend(note.trim(), toEmail.trim());
  };

  const remainingChars = MAX_NOTE_LENGTH - note.length;
  const isResend = mode === "resend";

  const subject = isResend
    ? `Friendly Reminder: Invoice ${invoiceNumber} – ${clientName} – ${periodLabel}`
    : `Invoice ${invoiceNumber} – No Limits Academy`;

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
              <div
                dangerouslySetInnerHTML={{
                  __html: buildPreviewHtml({
                    mode,
                    invoiceNumber,
                    periodLabel,
                    total: formattedTotal,
                    note,
                  }),
                }}
              />
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
