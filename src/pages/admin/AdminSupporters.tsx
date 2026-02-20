import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { formatUSD } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupporterRow {
  id: string;
  name: string;
  email: string | null;
  receipt_2026_status: string;
  receipt_2026_sent_at: string | null;
  total_2026: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

const AdminSupporters = () => {
  const navigate = useNavigate();

  const [rows, setRows] = useState<SupporterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: supporters } = await supabase
      .from("supporters")
      .select("id, name, email, receipt_2026_status, receipt_2026_sent_at")
      .order("name");

    if (!supporters) { setLoading(false); return; }

    const { data: donations } = await supabase
      .from("donations")
      .select("supporter_id, amount, revenue_type, revenue_description, deposit_date")
      .gte("deposit_date", "2026-01-01")
      .lte("deposit_date", "2026-12-31");

    const totals: Record<string, number> = {};
    (donations || []).forEach((d: any) => {
      if (
        d.supporter_id && (
          d.revenue_type === "Donation" ||
          (d.revenue_type === "Fundraising" && d.revenue_description === "Sponsor")
        )
      ) {
        totals[d.supporter_id] = (totals[d.supporter_id] || 0) + Number(d.amount);
      }
    });

    setRows(
      supporters
        .map((s: any) => ({ ...s, total_2026: totals[s.id] || 0 }))
        .filter((s) => s.total_2026 > 0)  // Only show supporters with qualifying donations
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.email && r.email.toLowerCase().includes(search.toLowerCase()))
  );

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

  return (
    <div className="bg-black text-white">
      {/* Page header */}
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-base font-semibold text-white">Donor/Sponsor History</h2>
        <p className="text-xs text-white/50">View supporters and 2026 receipt status</p>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/20 text-white placeholder:text-white/30"
            />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/70">Supporter Name</TableHead>
                <TableHead className="text-white/70">Email</TableHead>
                <TableHead className="text-white/70">2026 Total</TableHead>
                <TableHead className="text-white/70">Receipt Status</TableHead>
                <TableHead className="text-white/70">Last Sent</TableHead>
                <TableHead className="text-white/70"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={6} className="text-center py-12 text-white/50">Loading…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={6} className="text-center py-12 text-white/50">No supporters found.</TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="text-white font-medium">{s.name}</TableCell>
                    <TableCell className="text-white/70">{s.email || "—"}</TableCell>
                    <TableCell className="text-white">{formatUSD(s.total_2026)}</TableCell>
                    <TableCell>{statusBadge(s.receipt_2026_status)}</TableCell>
                    <TableCell className="text-white/70">
                      {s.receipt_2026_sent_at
                        ? new Date(s.receipt_2026_sent_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-sky-300 hover:text-sky-200 hover:bg-white/10"
                        onClick={() => navigate(`/admin/sales-marketing/supporters/${s.id}`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default AdminSupporters;
