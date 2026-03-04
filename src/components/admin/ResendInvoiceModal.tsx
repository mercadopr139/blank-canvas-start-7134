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
import { Send, AlertCircle } from "lucide-react";

interface ResendInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (data: { to: string; subject: string; message: string }) => void;
  clientName: string;
  vendorEmail: string;
  invoiceNumber: string;
  period: string;
  total: number;
  isSending: boolean;
}

const MAX_MESSAGE_LENGTH = 1000;

export default function ResendInvoiceModal({
  open,
  onOpenChange,
  onSend,
  clientName,
  vendorEmail,
  invoiceNumber,
  period,
  total,
  isSending,
}: ResendInvoiceModalProps) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setTo(vendorEmail);
      setSubject(`Friendly Reminder: Invoice ${invoiceNumber} – ${clientName} – ${period}`);
      setMessage(
        `Hi ${clientName.split(" ")[0] || clientName},\n\nJust a friendly reminder about the attached invoice. Please let us know if you have any questions.\n\nThank you!`
      );
    }
  }, [open, vendorEmail, invoiceNumber, clientName, period]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const handleSend = () => {
    onSend({ to: to.trim(), subject: subject.trim(), message: message.trim() });
  };

  const remainingChars = MAX_MESSAGE_LENGTH - message.length;
  const isValid = to.trim().length > 0 && subject.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Resend Invoice
          </DialogTitle>
          <DialogDescription>
            Send a reminder for invoice <strong>{invoiceNumber}</strong> ({formatCurrency(total)})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="resend-to">To</Label>
            <Input
              id="resend-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="vendor@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resend-subject">Subject</Label>
            <Input
              id="resend-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resend-message">Message</Label>
            <Textarea
              id="resend-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              rows={5}
              className="resize-none"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Existing PDF will be attached automatically.
              </span>
              <span className={remainingChars < 100 ? "text-orange-500" : ""}>
                {remainingChars} chars left
              </span>
            </div>
          </div>

          <div className="bg-muted/50 rounded-md p-3 text-sm">
            <span className="text-muted-foreground">Amount:</span>{" "}
            <strong>{formatCurrency(total)}</strong>
            <span className="text-muted-foreground ml-2">(read-only, from stored invoice)</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !isValid}>
            <Send className="w-4 h-4 mr-2" />
            {isSending ? "Sending..." : "Send Reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
