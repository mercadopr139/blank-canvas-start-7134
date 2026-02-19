import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
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
import NewRevenueModal from "@/components/admin/NewRevenueModal";

interface Revenue {
  id: string;
  revenue_type: string;
  source_name: string | null;
  donor_name: string;
  amount: number;
  method: string;
  deposit_date: string | null;
  date_received: string;
  reference_id: string | null;
  receipt_status: string;
}

const columns = [
  "Deposit Date",
  "Type",
  "Source",
  "Amount",
  "Method",
  "Reference ID",
  "Receipt Status",
  "",
];

const AdminDonations = () => {
  const navigate = useNavigate();
  const goBack = () => navigate("/admin/sales-marketing");

  const [rows, setRows] = useState<Revenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("donations")
      .select("id, revenue_type, source_name, donor_name, amount, method, deposit_date, date_received, reference_id, receipt_status")
      .order("created_at", { ascending: false });
    setRows((data as Revenue[]) ?? []);
    setLoading(false);
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("donations").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Record deleted" });
      fetchRevenue();
    }
    setDeleteId(null);
  };

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  const displayDate = (r: Revenue) => {
    const d = r.deposit_date || r.date_received;
    if (!d) return "—";
    return format(new Date(d + "T00:00:00"), "MM/dd/yyyy");
  };

  const displaySource = (r: Revenue) => r.source_name || r.donor_name || "—";

  const displayReceipt = (r: Revenue) =>
    r.revenue_type === "Donation" ? r.receipt_status : "—";

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
            <h1 className="text-xl font-bold text-white">Revenue</h1>
            <p className="text-sm text-white/50">
              Track and manage all incoming revenue.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-end mb-6">
          <Button
            className="bg-white text-black hover:bg-white/90"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Revenue
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
              ) : rows.length === 0 ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="text-center py-12 text-white/50">
                    No revenue yet. Click 'New Revenue' to add one.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="text-white">{displayDate(r)}</TableCell>
                    <TableCell className="text-white">{r.revenue_type}</TableCell>
                    <TableCell className="text-white">{displaySource(r)}</TableCell>
                    <TableCell className="text-white">${Number(r.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-white">{r.method}</TableCell>
                    <TableCell className="text-white/70">{r.reference_id ?? "—"}</TableCell>
                    <TableCell className="text-white">{displayReceipt(r)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-400 hover:bg-white/10"
                        onClick={() => setDeleteId(r.id)}
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

      <NewRevenueModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={fetchRevenue}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-black border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Record?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              This will permanently delete this revenue record.
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

export default AdminDonations;
