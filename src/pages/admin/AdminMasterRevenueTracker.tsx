import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const REVENUE_TYPES = ["All", "Donation", "Fundraising", "Fee for Service", "Re-Grant"];
const PAYMENT_METHODS = ["All", "Cash", "Check", "Venmo", "PayPal", "Square", "Other"];

type DrillCategory = "Donations" | "Fundraising" | "Fee for Service" | "Re-Grants";

interface RevenueRow {
  id: string;
  amount: number;
  deposit_date: string | null;
  revenue_type: string;
  method: string;
  donor_name: string | null;
  source_name: string | null;
  vendor_name: string | null;
  partner_name: string | null;
  event_name: string | null;
  revenue_description: string | null;
  reference_id: string | null;
}

/** Resolve a human-readable "name" for modal display by category */
const resolveName = (r: RevenueRow, category: DrillCategory): string => {
  switch (category) {
    case "Donations":
      return r.donor_name || r.source_name || "—";
    case "Fundraising":
      return r.source_name || r.event_name || r.donor_name || "—";
    case "Fee for Service":
      return r.vendor_name || r.source_name || r.donor_name || "—";
    case "Re-Grants":
      return r.partner_name || r.source_name || r.donor_name || "—";
    default:
      return "—";
  }
};

const revenueTypeForCategory = (cat: DrillCategory): string => {
  switch (cat) {
    case "Donations": return "Donation";
    case "Fundraising": return "Fundraising";
    case "Fee for Service": return "Fee for Service";
    case "Re-Grants": return "Re-Grant";
  }
};

const AdminMasterRevenueTracker = () => {
  const navigate = useNavigate();
  const goBack = () => navigate("/admin/sales-marketing");

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [typeFilter, setTypeFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Drill-down state
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillMonth, setDrillMonth] = useState<string>("");
  const [drillCategory, setDrillCategory] = useState<DrillCategory>("Donations");

  useEffect(() => {
    const fetchRevenue = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("donations")
        .select("id, amount, deposit_date, revenue_type, method, donor_name, source_name, vendor_name, partner_name, event_name, revenue_description, reference_id");
      setRows((data as RevenueRow[]) ?? []);
      setLoading(false);
    };
    fetchRevenue();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!r.deposit_date) return false;
      const rYear = r.deposit_date.substring(0, 4);
      if (rYear !== year) return false;
      if (typeFilter !== "All" && r.revenue_type !== typeFilter) return false;
      if (methodFilter !== "All" && r.method !== methodFilter) return false;
      return true;
    });
  }, [rows, year, typeFilter, methodFilter]);

  const monthlyData = useMemo(() => {
    const buckets = Array.from({ length: 12 }, () => ({
      total: 0,
      donation: 0,
      fundraising: 0,
      feeForService: 0,
      reGrant: 0,
    }));

    filtered.forEach((r) => {
      const monthIdx = parseInt(r.deposit_date!.substring(5, 7), 10) - 1;
      if (monthIdx < 0 || monthIdx > 11) return;
      buckets[monthIdx].total += r.amount;
      switch (r.revenue_type) {
        case "Donation": buckets[monthIdx].donation += r.amount; break;
        case "Fundraising": buckets[monthIdx].fundraising += r.amount; break;
        case "Fee for Service": buckets[monthIdx].feeForService += r.amount; break;
        case "Re-Grant": buckets[monthIdx].reGrant += r.amount; break;
      }
    });

    let cumulative = 0;
    return buckets.map((b, i) => {
      cumulative += b.total;
      return { month: MONTHS[i], ...b, cumulative };
    });
  }, [filtered]);

  const today = new Date();
  const currentMonthIdx = today.getMonth();
  const currentDay = today.getDate();

  const monthTotal = useMemo(() => {
    if (String(currentYear) !== year) return monthlyData[11]?.total ?? 0;
    return monthlyData[currentMonthIdx]?.total ?? 0;
  }, [monthlyData, year, currentMonthIdx, currentYear]);

  const ytdTotal = useMemo(() => {
    if (String(currentYear) !== year) return monthlyData[11]?.cumulative ?? 0;
    let sum = 0;
    filtered.forEach((r) => {
      const d = r.deposit_date!;
      const m = parseInt(d.substring(5, 7), 10) - 1;
      const day = parseInt(d.substring(8, 10), 10);
      if (m < currentMonthIdx || (m === currentMonthIdx && day <= currentDay)) {
        sum += r.amount;
      }
    });
    return sum;
  }, [filtered, year, currentMonthIdx, currentDay, currentYear]);

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    years.add(String(currentYear));
    rows.forEach((r) => {
      if (r.deposit_date) years.add(r.deposit_date.substring(0, 4));
    });
    return Array.from(years).sort().reverse();
  }, [rows, currentYear]);

  // Drill-down transactions
  const drillTransactions = useMemo(() => {
    const monthIdx = MONTHS.indexOf(drillMonth);
    if (monthIdx === -1) return [];
    const revType = revenueTypeForCategory(drillCategory);
    return filtered
      .filter((r) => {
        if (!r.deposit_date) return false;
        const m = parseInt(r.deposit_date.substring(5, 7), 10) - 1;
        return m === monthIdx && r.revenue_type === revType;
      })
      .sort((a, b) => (b.deposit_date ?? "").localeCompare(a.deposit_date ?? ""));
  }, [filtered, drillMonth, drillCategory]);

  const drillTotal = useMemo(
    () => drillTransactions.reduce((s, r) => s + r.amount, 0),
    [drillTransactions],
  );

  const openDrill = (month: string, category: DrillCategory) => {
    setDrillMonth(month);
    setDrillCategory(category);
    setDrillOpen(true);
  };

  /** Renders a clickable category cell */
  const CategoryCell = ({ value, month, category }: { value: number; month: string; category: DrillCategory }) => {
    const clickable = value > 0;
    return (
      <TableCell
        className={`text-white/70 text-right ${clickable ? "cursor-pointer hover:text-white hover:underline underline-offset-2 transition-colors" : ""}`}
        onClick={clickable ? () => openDrill(month, category) : undefined}
        title={clickable ? `View ${category} transactions for ${month}` : undefined}
      >
        {formatUSD(value)}
      </TableCell>
    );
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
            <h1 className="text-xl font-bold text-white">Master Revenue Tracker</h1>
            <p className="text-sm text-white/50">
              Monthly totals and year-to-date revenue based on Revenue entries.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <label className="text-xs text-white/50">Year</label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-32 bg-white/5 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 z-50">
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y} className="text-black">{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/50">Revenue Type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44 bg-white/5 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 z-50">
                {REVENUE_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-black">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/50">Payment Method</label>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-36 bg-white/5 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 z-50">
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m} className="text-black">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/50 mb-1">
              {String(currentYear) === year ? `${MONTHS[currentMonthIdx]} Total` : "December Total"}
            </p>
            <p className="text-3xl font-bold text-white">{formatUSD(monthTotal)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-white/50 mb-1">Year-to-Date</p>
            <p className="text-3xl font-bold text-white">{formatUSD(ytdTotal)}</p>
          </div>
        </div>

        {/* Monthly Table */}
        <div className="rounded-lg border border-white/10 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/70">Month</TableHead>
                <TableHead className="text-green-400 text-right font-semibold bg-green-500/10">Total Revenue</TableHead>
                <TableHead className="text-white/70 text-right">Donations</TableHead>
                <TableHead className="text-white/70 text-right">Fundraising</TableHead>
                <TableHead className="text-white/70 text-right">Fee for Service</TableHead>
                <TableHead className="text-white/70 text-right">Re-Grants</TableHead>
                <TableHead className="text-white/70 text-right">Cumulative YTD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={7} className="text-center py-12 text-white/50">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : (
                monthlyData.map((row, i) => (
                  <TableRow key={row.month} className={`border-white/10 hover:bg-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : "bg-white/[0.06]"}`}>
                    <TableCell className="text-white font-medium">{row.month}</TableCell>
                    <TableCell className="text-green-400 text-right font-bold bg-green-500/10">{formatUSD(row.total)}</TableCell>
                    <CategoryCell value={row.donation} month={row.month} category="Donations" />
                    <CategoryCell value={row.fundraising} month={row.month} category="Fundraising" />
                    <CategoryCell value={row.feeForService} month={row.month} category="Fee for Service" />
                    <CategoryCell value={row.reGrant} month={row.month} category="Re-Grants" />
                    <TableCell className="text-white text-right font-semibold">{formatUSD(row.cumulative)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Drill-down Modal */}
      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="bg-black border-white/20 text-white max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">
              {drillMonth} {year} – {drillCategory} Transactions
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 mt-2">
            {drillTransactions.length === 0 ? (
              <p className="text-white/50 text-sm py-8 text-center">No transactions found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/60">Date</TableHead>
                    <TableHead className="text-white/60">Name</TableHead>
                    <TableHead className="text-white/60 text-right">Amount</TableHead>
                    <TableHead className="text-white/60">Method</TableHead>
                    <TableHead className="text-white/60">Ref ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drillTransactions.map((r) => (
                    <TableRow key={r.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-white/80 text-sm">
                        {r.deposit_date ?? "—"}
                      </TableCell>
                      <TableCell className="text-white text-sm font-medium">
                        {resolveName(r, drillCategory)}
                      </TableCell>
                      <TableCell className="text-white text-right text-sm font-semibold">
                        {formatUSD(r.amount)}
                      </TableCell>
                      <TableCell className="text-white/70 text-sm">{r.method}</TableCell>
                      <TableCell className="text-white/50 text-sm font-mono">
                        {r.reference_id ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Total footer */}
          <div className="border-t border-white/10 pt-3 mt-2 flex justify-end items-center gap-3">
            <span className="text-white/50 text-sm">Total</span>
            <span className="text-white font-bold text-lg">{formatUSD(drillTotal)}</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMasterRevenueTracker;
