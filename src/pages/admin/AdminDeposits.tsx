import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { formatUSD } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import NewBatchModal from "@/components/admin/NewBatchModal";

interface Batch {
  id: string;
  batch_name: string;
  bank_account: string;
  status: string;
  deposit_date: string | null;
  created_by: string | null;
  donation_count: number;
  total_amount: number;
}

const columns = [
  "Batch Name",
  "Bank Account",
  "Status",
  "Deposit Date",
  "Total Amount",
  "Donations",
  "Created By",
  "",
];

const AdminDeposits = () => {
  const navigate = useNavigate();
  const goBack = () => navigate("/admin/sales-marketing");

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    const { data: batchRows } = await supabase
      .from("deposit_batches")
      .select("id, batch_name, bank_account, status, deposit_date, created_by")
      .order("created_at", { ascending: false });

    if (!batchRows || batchRows.length === 0) {
      setBatches([]);
      setLoading(false);
      return;
    }

    // Fetch donation aggregates per batch
    const batchIds = batchRows.map((b: any) => b.id);
    const { data: donations } = await supabase
      .from("donations")
      .select("deposit_batch_id, amount")
      .in("deposit_batch_id", batchIds);

    const aggregates: Record<string, { count: number; total: number }> = {};
    (donations ?? []).forEach((d: any) => {
      if (!aggregates[d.deposit_batch_id]) aggregates[d.deposit_batch_id] = { count: 0, total: 0 };
      aggregates[d.deposit_batch_id].count++;
      aggregates[d.deposit_batch_id].total += Number(d.amount);
    });

    setBatches(
      batchRows.map((b: any) => ({
        ...b,
        donation_count: aggregates[b.id]?.count ?? 0,
        total_amount: aggregates[b.id]?.total ?? 0,
      }))
    );
    setLoading(false);
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    // Unlink donations first, then delete batch
    await supabase.from("donations").update({ deposit_batch_id: null }).eq("deposit_batch_id", deleteId);
    const { error } = await supabase.from("deposit_batches").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Batch deleted" });
      fetchBatches();
    }
    setDeleteId(null);
  };

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-black border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">Deposit Batches</h1>
            <p className="text-sm text-white/50">
              Group donations into bank deposits and mark them as deposited.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-end mb-6">
          <Button className="bg-white text-black hover:bg-white/90" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Batch
          </Button>
        </div>

        <div className="rounded-lg border border-white/10 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead key={col} className="text-white/70">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="text-center py-12 text-white/50">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : batches.length === 0 ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="text-center py-12 text-white/50">
                    No deposit batches yet. Click 'New Batch' to start a deposit.
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((b) => (
                  <TableRow
                    key={b.id}
                    className="border-white/10 hover:bg-white/5 cursor-pointer"
                    onClick={() => navigate(`/admin/finance/deposits/${b.id}`)}
                  >
                    <TableCell className="text-white font-medium">{b.batch_name}</TableCell>
                    <TableCell className="text-white">{b.bank_account}</TableCell>
                    <TableCell className="text-white">{b.status}</TableCell>
                    <TableCell className="text-white">
                      {b.deposit_date
                        ? format(new Date(b.deposit_date + "T00:00:00"), "MM/dd/yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-white">{formatUSD(b.total_amount)}</TableCell>
                    <TableCell className="text-white">{b.donation_count}</TableCell>
                    <TableCell className="text-white/70">{b.created_by ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-400 hover:bg-white/10"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(b.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      <NewBatchModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={fetchBatches}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-black border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Batch?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              This will unlink all donations from this batch and permanently delete it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 text-white hover:bg-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDeposits;
