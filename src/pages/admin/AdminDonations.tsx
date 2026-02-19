import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { formatUSD } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
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
import EditRevenueModal from "@/components/admin/EditRevenueModal";
import SendReceiptFlow from "@/components/admin/SendReceiptFlow";

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
  supporter_id: string | null;
  supporter_receipt_status: string | null;
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
  const [editId, setEditId] = useState<string | null>(null);
  const [receiptPrompt, setReceiptPrompt] = useState<{ supporterId: string; supporterName: string } | null>(null);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("donations")
      .select("id, revenue_type, source_name, donor_name, amount, method, deposit_date, date_received, reference_id, receipt_status, supporter_id, supporters(receipt_2026_status)")
      .order("created_at", { ascending: false });

    const mapped = (data || []).map((d: any) => ({
      ...d,
      supporter_receipt_status: d.supporters?.receipt_2026_status || null,
    }));
    setRows(mapped as Revenue[]);
    setLoading(false);
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    // Find the row to get supporter_id before deleting
    const rowToDelete = rows.find((r) => r.id === deleteId);
    const supporterId = rowToDelete?.supporter_id;

    const { error } = await supabase.from("donations").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // If this donation was linked to a supporter, check remaining qualifying donations
      if (supporterId) {
        const { data: remaining } = await supabase
          .from("donations")
          .select("id, revenue_type, revenue_description")
          .eq("supporter_id", supporterId)
          .gte("deposit_date", "2026-01-01")
          .lte("deposit_date", "2026-12-31");

        const qualifying = (remaining || []).filter(
          (d: any) =>
            d.revenue_type === "Donation" ||
            (d.revenue_type === "Fundraising" && d.revenue_description === "Sponsor")
        );

        if (qualifying.length === 0) {
          // No qualifying donations left — delete the supporter record
          await supabase.from("supporters").delete().eq("id", supporterId);
        }
      }
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

  const receiptBadge = (r: Revenue) => {
    if (r.revenue_type !== "Donation" && r.revenue_type !== "Fundraising") return <span className="text-white/50">—</span>;
    if (!r.supporter_id) return <span className="text-white/50">—</span>;
    const status = r.supporter_receipt_status || "Not Sent";
    switch (status) {
      case "Sent":
        return <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Sent</Badge>;
      case "Failed":
        return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">Failed</Badge>;
      default:
        return <Badge className="bg-red-600/20 text-red-400 border-red-600/30">Not Sent</Badge>;
    }
  };

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
                    <TableCell className="text-white">{formatUSD(r.amount)}</TableCell>
                    <TableCell className="text-white">{r.method}</TableCell>
                    <TableCell className="text-white/70">{r.reference_id ?? "—"}</TableCell>
                    <TableCell>{receiptBadge(r)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white/50 hover:text-white hover:bg-white/10"
                          onClick={() => setEditId(r.id)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-400 hover:bg-white/10"
                          onClick={() => setDeleteId(r.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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

      <EditRevenueModal
        open={!!editId}
        onOpenChange={(isOpen) => { if (!isOpen) setEditId(null); }}
        donationId={editId}
        onSaved={(receiptInfo) => {
          fetchRevenue();
          if (receiptInfo) {
            setReceiptPrompt(receiptInfo);
          }
        }}
      />

      <SendReceiptFlow
        open={!!receiptPrompt}
        onOpenChange={(isOpen) => { if (!isOpen) setReceiptPrompt(null); }}
        supporterId={receiptPrompt?.supporterId || ""}
        supporterName={receiptPrompt?.supporterName || ""}
        onComplete={fetchRevenue}
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
            <AlertDialogCancel className="bg-white text-black border-white/20 hover:bg-white/90 hover:text-black">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDonations;
