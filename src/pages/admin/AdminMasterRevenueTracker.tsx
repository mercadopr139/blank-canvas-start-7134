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

const REVENUE_TYPES = ["All", "Donation", "Sponsorship", "Fee for Service", "Re-Grant"];
const PAYMENT_METHODS = ["All", "Cash", "Check", "Zelle", "Stripe", "ACH", "In-Kind"];

type DrillCategory = "Donations" | "Sponsorship" | "Fee for Service" | "Re-Grants";

interface RevenueRow {
  id: string;
  supporter_id: string | null;
  amount: number;
  date: string | null;
  revenue_type: string;
  payment_method: string | null;
  reference_id: string | null;
  supporter_name?: string | null;
}

const revenueTypeForCategory = (cat: DrillCategory): string => {
  switch (cat) {
    case "Donations": return "Donation";
    case "Sponsorship": return "Sponsorship";
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
        .from("revenue")
        .select("id, supporter_id, amount, date, revenue_type, payment_method, reference_id");

      const rawRows = (data as RevenueRow[]) ?? [];

      // Resolve supporter names so the drill-down can show a human name
      const supporterIds = [...new Set(rawRows.map((r) => r.supporter_id).filter(Boolean))] as string[];
      const nameMap: Record<string, string> = {};
      if (supporterIds.length > 0) {
        const { data: sData } = await supabase
          .from("supporters")
          .select("id, name")
          .in("id", supporterIds);
        (sData ?? []).forEach((s: { id: string; name: string | null }) => {
          if (s.name) nameMap[s.id] = s.name;
        });
      }

      setRows(rawRows.map((r) => ({
        ...r,
        supporter_name: r.supporter_id ? nameMap[r.supporter_id] ?? null : null,
      })));
      setLoading(false);
    };
    fetchRevenue();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!r.date) return false;
      const rYear = r.date.substring(0, 4);
      if (rYear !== year) return false;
      if (typeFilter !== "All" && r.revenue_type !== typeFilter) return false;
      if (methodFilter !== "All" && r.payment_method !== methodFilter) return false;
      return true;
    });
  }, [rows, year, typeFilter, methodFilter]);

  const monthlyData = useMemo(() => {
    const buckets = Array.from({ length: 12 }, () => ({
      total: 0,
      donation: 0,
      sponsorship: 0,
      feeForService: 0,
      reGrant: 0,
    }));

    filtered.forEach((r) => {
      const monthIdx = parseInt(r.date!.substring(5, 7), 10) - 1;
      if (monthIdx < 0 || monthIdx > 11) return;
      buckets[monthIdx].total += r.amount;
      switch (r.revenue_type) {
        case "Donation": buckets[monthIdx].donation += r.amount; break;
        case "Sponsorship": buckets[monthIdx].sponsorship += r.amount; break;
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
      const d = r.date!;
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
      if (r.date) years.add(r.date.substring(0, 4));
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
        if (!r.date) return false;
        const m = parseInt(r.date.substring(5, 7), 10) - 1;
        return m === monthIdx && r.revenue_type === revType;
      })
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
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
    <div className="bg-black text-white">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-base font-semibold text-white">Master Revenue Tracker</h2>
        <p className="text-xs text-white/50">Monthly totals and year-to-date revenue based on Revenue entries.</p>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
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
        <div className="rounded-lg border border-white/10 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white bg-green-600">Month</TableHead>
                <TableHead className="text-white bg-green-600 text-right font-semibold">Total Revenue</TableHead>
                <TableHead className="text-white bg-green-600 text-right">Donations</TableHead>
                <TableHead className="text-white bg-green-600 text-right">Sponsorship</TableHead>
                <TableHead className="text-white bg-green-600 text-right">Fee for Service</TableHead>
                <TableHead className="text-white bg-green-600 text-right">Re-Grants</TableHead>
                <TableHead className="text-white bg-green-600 text-right">Cumulative YTD</TableHead>
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
                    <CategoryCell value={row.sponsorship} month={row.month} category="Sponsorship" />
                    <CategoryCell value={row.feeForService} month={row.month} category="Fee for Service" />
                    <CategoryCell value={row.reGrant} month={row.month} category="Re-Grants" />
                    <TableCell className="text-white text-right font-semibold">{formatUSD(row.cumulative)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

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
                     <TableHead className="text-white bg-green-600">Date</TableHead>
                     <TableHead className="text-white bg-green-600">Name</TableHead>
                     <TableHead className="text-white bg-green-600 text-right">Amount</TableHead>
                     <TableHead className="text-white bg-green-600">Method</TableHead>
                     <TableHead className="text-white bg-green-600">Ref ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drillTransactions.map((r) => (
                    <TableRow key={r.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-white/80 text-sm">
                        {r.date ?? "—"}
                      </TableCell>
                      <TableCell className="text-white text-sm font-medium">
                        {r.supporter_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-white text-right text-sm font-semibold">
                        {formatUSD(r.amount)}
                      </TableCell>
                      <TableCell className="text-white/70 text-sm">{r.payment_method ?? "—"}</TableCell>
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
