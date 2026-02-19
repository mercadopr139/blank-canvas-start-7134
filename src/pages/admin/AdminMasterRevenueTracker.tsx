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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const REVENUE_TYPES = ["All", "Donation", "Fundraising", "Fee for Service", "Re-Grant"];
const PAYMENT_METHODS = ["All", "Cash", "Check", "Venmo", "PayPal", "Square", "Other"];

interface RevenueRow {
  amount: number;
  deposit_date: string | null;
  revenue_type: string;
  method: string;
}

const AdminMasterRevenueTracker = () => {
  const navigate = useNavigate();
  const goBack = () =>
    window.history.state?.idx > 0 ? navigate(-1) : navigate("/admin/sales-marketing");

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [typeFilter, setTypeFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRevenue = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("donations")
        .select("amount, deposit_date, revenue_type, method");
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
    if (String(currentYear) !== year) {
      // If viewing a past year, show December total
      return monthlyData[11]?.total ?? 0;
    }
    return monthlyData[currentMonthIdx]?.total ?? 0;
  }, [monthlyData, year, currentMonthIdx, currentYear]);

  const ytdTotal = useMemo(() => {
    if (String(currentYear) !== year) {
      // Full year
      return monthlyData[11]?.cumulative ?? 0;
    }
    // Sum all months up to current, but for current month only count entries up to today
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
                    <TableCell className="text-white/70 text-right">{formatUSD(row.donation)}</TableCell>
                    <TableCell className="text-white/70 text-right">{formatUSD(row.fundraising)}</TableCell>
                    <TableCell className="text-white/70 text-right">{formatUSD(row.feeForService)}</TableCell>
                    <TableCell className="text-white/70 text-right">{formatUSD(row.reGrant)}</TableCell>
                    <TableCell className="text-white text-right font-semibold">{formatUSD(row.cumulative)}</TableCell>
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

export default AdminMasterRevenueTracker;
