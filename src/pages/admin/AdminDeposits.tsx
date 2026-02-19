import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
];

const AdminDeposits = () => {
  const navigate = useNavigate();
  const goBack = () => navigate("/admin/dashboard");

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

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
          <Button className="bg-white text-black hover:bg-white/90">
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
                    <TableCell className="text-white">${b.total_amount.toFixed(2)}</TableCell>
                    <TableCell className="text-white">{b.donation_count}</TableCell>
                    <TableCell className="text-white/70">{b.created_by ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default AdminDeposits;
