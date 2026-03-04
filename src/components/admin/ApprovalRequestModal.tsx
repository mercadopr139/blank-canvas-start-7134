import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, Clock, Loader2 } from "lucide-react";

interface ApprovalRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  clientName: string;
  onResendApproval: () => Promise<void>;
  approvalStatus: string;
}

export default function ApprovalRequestModal({
  open,
  onOpenChange,
  invoiceNumber,
  clientName,
  onResendApproval,
  approvalStatus,
}: ApprovalRequestModalProps) {
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      await onResendApproval();
    } finally {
      setResending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Approval Requested
          </DialogTitle>
          <DialogDescription>
            Invoice <strong>{invoiceNumber}</strong> for{" "}
            <strong>{clientName}</strong> has been sent to Chrissy for approval.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <CheckCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">Status: Pending Approval</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You'll be notified when Chrissy responds. The invoice cannot be
                sent to the vendor until approved.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="secondary"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Resend Approval Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
