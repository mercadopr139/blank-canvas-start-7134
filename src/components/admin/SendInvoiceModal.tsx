import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { Mail, AlertCircle } from "lucide-react";

interface SendInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (note: string) => void;
  clientName: string;
  billingEmail: string;
  invoiceNumber: string;
  existingNote?: string | null;
  isSending: boolean;
}

const MAX_NOTE_LENGTH = 1000;

export default function SendInvoiceModal({
  open,
  onOpenChange,
  onSend,
  clientName,
  billingEmail,
  invoiceNumber,
  existingNote,
  isSending,
}: SendInvoiceModalProps) {
  const [note, setNote] = useState("");

  // Pre-fill with existing note when modal opens
  useEffect(() => {
    if (open) {
      setNote(existingNote || "");
    }
  }, [open, existingNote]);

  const handleSend = () => {
    onSend(note.trim());
  };

  const remainingChars = MAX_NOTE_LENGTH - note.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send Invoice
          </DialogTitle>
          <DialogDescription>
            Send invoice <strong>{invoiceNumber}</strong> to{" "}
            <strong>{clientName}</strong> at <strong>{billingEmail}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email-note">Note to client (optional)</Label>
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
                    This note will be included in your email.
                  </span>
                )}
              </span>
              <span className={remainingChars < 100 ? "text-orange-500" : ""}>
                {remainingChars} characters remaining
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            <Mail className="w-4 h-4 mr-2" />
            {isSending ? "Sending..." : "Send Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
