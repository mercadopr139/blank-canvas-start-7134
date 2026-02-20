import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { cn, formatUSD } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, ArrowLeft, Plus, CheckCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface Batch {
  id: string;
  batch_name: string;
  bank_account: string;
  status: string;
  deposit_date: string | null;
  deposited_by: string | null;
  created_by: string | null;
}

interface Donation {
  id: string;
  donor_name: string;
  amount: number;
  method: string;
  date_received: string;
  reference_id: string | null;
}

const AdminDepositDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  // Add donations modal
  const [addOpen, setAddOpen] = useState(false);
  const [unlinked, setUnlinked] = useState<Donation[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addingSaving, setAddingSaving] = useState(false);

  // Mark deposited modal
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositDate, setDepositDate] = useState<Date | undefined>(undefined);
  const [depositedBy, setDepositedBy] = useState("");
  const [depositSaving, setDepositSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [batchRes, donationsRes] = await Promise.all([
      supabase.from("deposit_batches").select("*").eq("id", id).single(),
      supabase.from("donations").select("id, donor_name, amount, method, date_received, reference_id").eq("deposit_batch_id", id).order("date_received", { ascending: false }),
    ]);

    setBatch((batchRes.data as Batch) ?? null);
    setDonations((donationsRes.data as Donation[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalAmount = donations.reduce((s, d) => s + Number(d.amount), 0);

  // Fetch unlinked donations for add modal
  const openAddModal = async () => {
    const { data } = await supabase
      .from("donations")
      .select("id, donor_name, amount, method, date_received, reference_id")
      .is("deposit_batch_id", null)
      .order("date_received", { ascending: false });
    setUnlinked((data as Donation[]) ?? []);
    setSelected(new Set());
    setAddOpen(true);
  };

  const toggleSelect = (donationId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(donationId)) next.delete(donationId);
      else next.add(donationId);
      return next;
    });
  };

  const handleAddDonations = async () => {
    if (selected.size === 0) return;
    setAddingSaving(true);
    const { error } = await supabase
      .from("donations")
      .update({ deposit_batch_id: id } as any)
      .in("id", Array.from(selected));
    setAddingSaving(false);

    if (error) {
      toast({ title: "Failed to add donations.", variant: "destructive" });
      return;
    }
    toast({ title: `${selected.size} donation(s) added to batch.` });
    setAddOpen(false);
    fetchData();
  };

  const handleMarkDeposited = async () => {
    if (!depositDate) {
      toast({ title: "Please select a deposit date.", variant: "destructive" });
      return;
    }
    setDepositSaving(true);
    const { error } = await supabase
      .from("deposit_batches")
      .update({
        status: "Deposited" as any,
        deposit_date: format(depositDate, "yyyy-MM-dd"),
        deposited_by: depositedBy.trim() || null,
      })
      .eq("id", id!);
    setDepositSaving(false);

    if (error) {
      toast({ title: "Failed to mark as deposited.", variant: "destructive" });
      return;
    }
    toast({ title: "Batch marked as deposited." });
    setDepositOpen(false);
    fetchData();
  };

  if (loading) {
    return (
      <div className="bg-black text-white flex items-center justify-center py-24">
        <p className="text-white/50">Loading…</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="bg-black text-white flex items-center justify-center py-24">
        <p className="text-white/50">Batch not found.</p>
      </div>
    );
  }

  return (
    <div className="bg-black text-white">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-base font-semibold text-white">{batch.batch_name}</h2>
        <p className="text-xs text-white/50">Deposit Batch Detail</p>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Batch summary card */}
        <Card className="bg-white/5 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-lg text-white">Batch Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
              <div>
                <p className="text-white/50">Bank Account</p>
                <p className="font-medium">{batch.bank_account}</p>
              </div>
              <div>
                <p className="text-white/50">Status</p>
                <p className="font-medium">{batch.status}</p>
              </div>
              <div>
                <p className="text-white/50">Deposit Date</p>
                <p className="font-medium">
                  {batch.deposit_date
                    ? format(new Date(batch.deposit_date + "T00:00:00"), "MM/dd/yyyy")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-white/50">Total Amount</p>
                <p className="font-medium">{formatUSD(totalAmount)}</p>
              </div>
              <div>
                <p className="text-white/50">Donations</p>
                <p className="font-medium">{donations.length}</p>
              </div>
              <div>
                <p className="text-white/50">Created By</p>
                <p className="font-medium">{batch.created_by ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 justify-end">
          <Button variant="outline" className="border-white/20 text-white bg-transparent hover:bg-white/10 hover:text-white" onClick={openAddModal}>
            <Plus className="w-4 h-4 mr-2" />
            Add Donations to Batch
          </Button>
          {batch.status === "Draft" && (
            <Button className="bg-white text-black hover:bg-white/90" onClick={() => { setDepositDate(undefined); setDepositedBy(""); setDepositOpen(true); }}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark Deposited
            </Button>
          )}
        </div>

        {/* Donations table */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Donations in this batch</h2>
          <div className="rounded-lg border border-white/10 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/70">Date</TableHead>
                  <TableHead className="text-white/70">Donor</TableHead>
                  <TableHead className="text-white/70">Amount</TableHead>
                  <TableHead className="text-white/70">Method</TableHead>
                  <TableHead className="text-white/70">Reference ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donations.length === 0 ? (
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableCell colSpan={5} className="text-center py-12 text-white/50">
                      No donations in this batch yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  donations.map((d) => (
                    <TableRow key={d.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-white">{format(new Date(d.date_received + "T00:00:00"), "MM/dd/yyyy")}</TableCell>
                      <TableCell className="text-white">{d.donor_name}</TableCell>
                      <TableCell className="text-white">{formatUSD(d.amount)}</TableCell>
                      <TableCell className="text-white">{d.method}</TableCell>
                      <TableCell className="text-white/70">{d.reference_id ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Add Donations Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-black border-white/20 text-white max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Add Donations to Batch</DialogTitle>
          </DialogHeader>
          {unlinked.length === 0 ? (
            <p className="text-white/50 py-6 text-center">No unlinked donations available.</p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {unlinked.map((d) => (
                <label
                  key={d.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(d.id)}
                    onCheckedChange={() => toggleSelect(d.id)}
                  />
                  <div className="flex-1 text-sm">
                    <span className="font-medium">{d.donor_name}</span>
                    <span className="text-white/50 ml-2">
                      {formatUSD(d.amount)} · {d.method} · {format(new Date(d.date_received + "T00:00:00"), "MM/dd/yyyy")}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              disabled={selected.size === 0 || addingSaving}
              className="bg-white text-black hover:bg-white/90"
              onClick={handleAddDonations}
            >
              {addingSaving ? "Adding…" : `Add ${selected.size} Donation(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Deposited Modal */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="bg-black border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Mark as Deposited</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label className="text-white/70">Deposit Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-white/5 border-white/20 text-white",
                      !depositDate && "text-white/40"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {depositDate ? format(depositDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-black border-white/20" align="start">
                  <Calendar
                    mode="single"
                    selected={depositDate}
                    onSelect={setDepositDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-white/70">Deposited By</Label>
              <Input
                value={depositedBy}
                onChange={(e) => setDepositedBy(e.target.value)}
                placeholder="Name of person"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              disabled={depositSaving}
              className="bg-white text-black hover:bg-white/90"
              onClick={handleMarkDeposited}
            >
              {depositSaving ? "Saving…" : "Confirm Deposit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDepositDetail;
