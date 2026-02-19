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
import NewDonationModal from "@/components/admin/NewDonationModal";

interface Donation {
  id: string;
  donor_name: string;
  amount: number;
  method: string;
  date_received: string;
  reference_id: string | null;
  deposit_batch_id: string | null;
  receipt_status: string;
}

const columns = [
  "Date",
  "Donor",
  "Amount",
  "Method",
  "Reference ID",
  "Deposit Batch",
  "Receipt Status",
];

const AdminDonations = () => {
  const navigate = useNavigate();
  const goBack = () => navigate("/admin/dashboard");

  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchDonations = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("donations")
      .select("id, donor_name, amount, method, date_received, reference_id, deposit_batch_id, receipt_status")
      .order("date_received", { ascending: false });
    setDonations((data as Donation[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDonations();
  }, [fetchDonations]);

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
            <h1 className="text-xl font-bold text-white">Donations</h1>
            <p className="text-sm text-white/50">
              Track and manage all incoming donations.
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
            New Donation
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
              ) : donations.length === 0 ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="text-center py-12 text-white/50">
                    No donations yet. Click 'New Donation' to add one.
                  </TableCell>
                </TableRow>
              ) : (
                donations.map((d) => (
                  <TableRow key={d.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="text-white">
                      {format(new Date(d.date_received + "T00:00:00"), "MM/dd/yyyy")}
                    </TableCell>
                    <TableCell className="text-white">{d.donor_name}</TableCell>
                    <TableCell className="text-white">
                      ${Number(d.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-white">{d.method}</TableCell>
                    <TableCell className="text-white/70">{d.reference_id ?? "—"}</TableCell>
                    <TableCell className="text-white/70">—</TableCell>
                    <TableCell className="text-white">{d.receipt_status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      <NewDonationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={fetchDonations}
      />
    </div>
  );
};

export default AdminDonations;
