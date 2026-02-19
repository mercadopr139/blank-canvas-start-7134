import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
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

const generateName = (bank: string) => {
  const prefix = bank === "Crest Savings" ? "Crest" : bank;
  return `${prefix} - ${format(new Date(), "yyyy-MM-dd")}`;
};

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
  const manuallyEdited = useRef(false);

  // Auto-fill on open
  useEffect(() => {
    if (open) {
      const defaultBank = "Crest Savings";
      setBankAccount(defaultBank);
      setBatchName(generateName(defaultBank));
      manuallyEdited.current = false;
    }
  }, [open]);

  // Update name when bank changes, unless manually edited
  const handleBankChange = (value: string) => {
    setBankAccount(value);
    if (!manuallyEdited.current) {
      setBatchName(generateName(value));
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBatchName(e.target.value);
    manuallyEdited.current = true;
  };

  const handleGenerate = () => {
    setBatchName(generateName(bankAccount));
    manuallyEdited.current = false;
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
            <div className="flex gap-2">
              <Input
                value={batchName}
                onChange={handleNameChange}
                maxLength={200}
                placeholder='e.g. "Crest - 2026-02-19"'
                className="bg-white/5 border-white/20 text-white placeholder:text-white/30 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleGenerate}
                className="border-white/20 text-white bg-transparent hover:bg-white/10 hover:text-white shrink-0"
                title="Generate default name"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-white/70">Bank Account</Label>
            <Select value={bankAccount} onValueChange={handleBankChange}>
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
