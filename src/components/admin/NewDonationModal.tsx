import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const METHODS = ["Check", "PayPal", "Cash", "Other"] as const;
const RECEIPT_STATUSES = ["Pending", "Sent", "Not Needed"] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const NewDonationModal = ({ open, onOpenChange, onCreated }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("");
  const [dateReceived, setDateReceived] = useState<Date | undefined>(undefined);
  const [referenceId, setReferenceId] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptStatus, setReceiptStatus] = useState<string>("Pending");

  const reset = () => {
    setDonorName("");
    setDonorEmail("");
    setAmount("");
    setMethod("");
    setDateReceived(undefined);
    setReferenceId("");
    setNotes("");
    setReceiptStatus("Pending");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorName.trim() || !amount || !method || !dateReceived) {
      toast({ title: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: "Amount must be a positive number.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("donations").insert({
      donor_name: donorName.trim(),
      donor_email: donorEmail.trim() || null,
      amount: parsedAmount,
      method: method as any,
      date_received: format(dateReceived, "yyyy-MM-dd"),
      reference_id: referenceId.trim() || null,
      notes: notes.trim() || null,
      receipt_status: receiptStatus as any,
    });
    setSaving(false);

    if (error) {
      toast({ title: "Failed to save donation.", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Donation saved." });
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black border-white/20 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">New Donation</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Donor Name */}
          <div className="space-y-1">
            <Label className="text-white/70">Donor Name *</Label>
            <Input
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              maxLength={200}
              className="bg-white/5 border-white/20 text-white"
            />
          </div>

          {/* Donor Email */}
          <div className="space-y-1">
            <Label className="text-white/70">Donor Email</Label>
            <Input
              type="email"
              value={donorEmail}
              onChange={(e) => setDonorEmail(e.target.value)}
              className="bg-white/5 border-white/20 text-white"
            />
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <Label className="text-white/70">Amount *</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-white/5 border-white/20 text-white"
            />
          </div>

          {/* Method */}
          <div className="space-y-1">
            <Label className="text-white/70">Method *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent className="bg-black border-white/20">
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m} className="text-white">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Received */}
          <div className="space-y-1">
            <Label className="text-white/70">Date Received *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-white/5 border-white/20 text-white",
                    !dateReceived && "text-white/40"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateReceived ? format(dateReceived, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-black border-white/20" align="start">
                <Calendar
                  mode="single"
                  selected={dateReceived}
                  onSelect={setDateReceived}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Reference ID */}
          <div className="space-y-1">
            <Label className="text-white/70">Reference ID</Label>
            <Input
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              maxLength={200}
              placeholder="Check # or transaction ID"
              className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
            />
          </div>

          {/* Receipt Status */}
          <div className="space-y-1">
            <Label className="text-white/70">Receipt Status</Label>
            <Select value={receiptStatus} onValueChange={setReceiptStatus}>
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black border-white/20">
                {RECEIPT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-white">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-white/70">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="bg-white/5 border-white/20 text-white"
            />
          </div>

          <Button type="submit" disabled={saving} className="w-full bg-white text-black hover:bg-white/90">
            {saving ? "Saving…" : "Save Donation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewDonationModal;
