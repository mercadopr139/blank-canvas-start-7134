import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const BANK_ACCOUNTS = ["Crest Savings", "Other"] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const NewBatchModal = ({ open, onOpenChange, onCreated }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [bankAccount, setBankAccount] = useState<string>("Crest Savings");

  const reset = () => {
    setBatchName("");
    setBankAccount("Crest Savings");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchName.trim()) return;

    setSaving(true);
    const { error } = await supabase.from("deposit_batches").insert({
      batch_name: batchName.trim(),
      bank_account: bankAccount as any,
      status: "Draft" as any,
      created_by: user?.email ?? "Unknown",
    });
    setSaving(false);

    if (error) {
      toast({ title: "Failed to create batch.", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Batch created." });
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black border-white/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">New Deposit Batch</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label className="text-white/70">Batch Name *</Label>
            <Input
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              maxLength={200}
              placeholder='e.g. "Crest Deposit - Feb 18, 2026"'
              className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-white/70">Bank Account</Label>
            <Select value={bankAccount} onValueChange={setBankAccount}>
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black border-white/20">
                {BANK_ACCOUNTS.map((a) => (
                  <SelectItem key={a} value={a} className="text-white">{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={!batchName.trim() || saving}
            className="w-full bg-white text-black hover:bg-white/90"
          >
            {saving ? "Creating…" : "Create Batch"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewBatchModal;
