import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import SendReceiptFlow from "@/components/admin/SendReceiptFlow";

interface Supporter {
  id: string;
  name: string;
  email: string | null;
  receipt_2026_status: string;
  receipt_2026_sent_at: string | null;
  receipt_2026_last_sent_to: string | null;
}

interface Donation {
  id: string;
  deposit_date: string;
  amount: number;
  method: string;
  reference_id: string | null;
  notes: string | null;
}

const AdminSupporterDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supporter, setSupporter] = useState<Supporter | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptFlowOpen, setReceiptFlowOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [suppRes, donRes] = await Promise.all([
      supabase.from("supporters").select("*").eq("id", id).single(),
      supabase
        .from("donations")
        .select("id, deposit_date, amount, method, reference_id, notes, revenue_type, revenue_description")
        .eq("supporter_id", id)
        .gte("deposit_date", "2026-01-01")
        .lte("deposit_date", "2026-12-31")
        .order("deposit_date", { ascending: true }),
    ]);

    if (suppRes.data) setSupporter(suppRes.data as any);

    const qualifying = (donRes.data || []).filter(
      (d: any) =>
        d.revenue_type === "Donation" ||
        (d.revenue_type === "Fundraising" && d.revenue_description === "Sponsor")
    );
    setDonations(qualifying as Donation[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const total = donations.reduce((sum, d) => sum + Number(d.amount), 0);

  const statusBadge = (status: string) => {
    switch (status) {
      case "Sent":
        return <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Sent</Badge>;
      case "Failed":
        return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">Failed</Badge>;
      default:
        return <Badge className="bg-red-600/20 text-red-400 border-red-600/30">Not Sent</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="bg-black text-white flex items-center justify-center py-24">
        <p className="text-white/50">Loading…</p>
      </div>
    );
  }

  if (!supporter) {
    return (
      <div className="bg-black text-white flex items-center justify-center py-24">
        <p className="text-white/50">Supporter not found.</p>
      </div>
    );
  }

  return (
    <div className="bg-black text-white">
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/50 hover:text-white hover:bg-white/10 px-2"
            onClick={() => navigate("/admin/sales-marketing/supporters")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h2 className="text-base font-semibold text-white">{supporter.name}</h2>
            <p className="text-xs text-white/50">{supporter.email || "No email"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge(supporter.receipt_2026_status)}
          <Button
            className="bg-white text-black hover:bg-white/90"
            onClick={() => {
              if (!supporter.email) {
                toast({ title: "Email required", description: "Add an email to this supporter before sending a receipt.", variant: "destructive" });
                return;
              }
              setReceiptFlowOpen(true);
            }}
          >
            <Send className="w-4 h-4 mr-2" />
            Send 2026 Receipt
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">2026 Qualifying Revenue</h2>
          <p className="text-white/70">Total: <span className="text-white font-bold">{formatUSD(total)}</span></p>
        </div>

        <div className="rounded-lg border border-white/10 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/70">Deposit Date</TableHead>
                <TableHead className="text-white/70">Amount</TableHead>
                <TableHead className="text-white/70">Method</TableHead>
                <TableHead className="text-white/70">Reference ID</TableHead>
                <TableHead className="text-white/70">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {donations.length === 0 ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={5} className="text-center py-12 text-white/50">No qualifying revenue in 2026.</TableCell>
                </TableRow>
              ) : (
                donations.map((d) => (
                  <TableRow key={d.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="text-white">{format(new Date(d.deposit_date + "T00:00:00"), "MM/dd/yyyy")}</TableCell>
                    <TableCell className="text-white">{formatUSD(d.amount)}</TableCell>
                    <TableCell className="text-white">{d.method}</TableCell>
                    <TableCell className="text-white/70">{d.reference_id || "—"}</TableCell>
                    <TableCell className="text-white/70">{d.notes || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {supporter.receipt_2026_sent_at && (
          <p className="text-sm text-white/40 mt-4">
            Last sent to {supporter.receipt_2026_last_sent_to} on{" "}
            {new Date(supporter.receipt_2026_sent_at).toLocaleString()}
          </p>
        )}
      </div>

      <SendReceiptFlow
        open={receiptFlowOpen}
        onOpenChange={setReceiptFlowOpen}
        supporterId={supporter.id}
        supporterName={supporter.name}
        onComplete={fetchData}
      />
    </div>
  );
};

export default AdminSupporterDetail;
