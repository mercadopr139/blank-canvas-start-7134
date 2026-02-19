import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supporterId: string;
  supporterName: string;
  onComplete: () => void;
}

const SendReceiptFlow = ({ open, onOpenChange, supporterId, supporterName, onComplete }: Props) => {
  const [step, setStep] = useState<"confirm" | "compose">("confirm");
  const [personalMessage, setPersonalMessage] = useState("");
  const [sending, setSending] = useState(false);

  const reset = () => {
    setStep("confirm");
    setPersonalMessage("");
    setSending(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Not authenticated", variant: "destructive" });
        setSending(false);
        return;
      }

      const res = await supabase.functions.invoke("send-receipt", {
        body: {
          supporter_id: supporterId,
          personal_message: personalMessage.trim() || undefined,
        },
      });

      if (res.error) {
        toast({ title: "Error", description: res.error.message, variant: "destructive" });
      } else if (res.data?.error) {
        toast({
          title: res.data.can_download ? "Sending failed" : "Error",
          description: res.data.error,
          variant: "destructive",
          duration: 8000,
        });
        if (res.data.can_download) {
          // Mark as failed but allow manual override
          toast({
            title: "Receipt generated",
            description: "You can download it or mark as sent from the supporter detail page.",
            duration: 8000,
          });
        }
      } else if (res.data?.success) {
        toast({
          title: "Receipt sent!",
          description: `Emailed to ${res.data.sent_to}`,
          duration: 8000,
        });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSending(false);
    handleClose(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-black border-white/20 text-white max-w-md">
        {step === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">Send 2026 Receipt?</DialogTitle>
            </DialogHeader>
            <p className="text-white/60 text-sm mt-2">
              Generate and send an annual 2026 receipt for <span className="text-white font-medium">{supporterName}</span>?
            </p>
            <div className="flex gap-3 mt-6 justify-end">
              <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10" onClick={() => handleClose(false)}>
                Not now
              </Button>
              <Button className="bg-white text-black hover:bg-white/90" onClick={() => setStep("compose")}>
                Yes
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">Send 2026 Receipt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label className="text-white/70">Personal message (optional)</Label>
                <Textarea
                  value={personalMessage}
                  onChange={(e) => setPersonalMessage(e.target.value)}
                  rows={4}
                  placeholder="Add a personal note…"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
                />
              </div>
              <Button
                className="w-full bg-white text-black hover:bg-white/90"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? "Generating & Sending…" : "Generate & Send"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SendReceiptFlow;
