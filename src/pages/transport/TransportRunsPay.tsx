import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, CheckCircle, XCircle,
  Download, ChevronLeft, ChevronRight, DollarSign, Trash2, Pencil, ChevronDown, ChevronUp, User, Users,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, setDate,
} from "date-fns";

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function getPayRate(routeName: string | undefined): number { return (routeName === "Overflow" || routeName === "Both") ? 25 : 50; }

type PayPeriod = { label: string; start: string; end: string };
function getCurrentPayPeriod(): PayPeriod {
  const now = new Date(); const day = now.getDate();
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  if (day <= 15) return { label: `${format(month, "MMM yyyy")} 1st–15th`, start: format(month, "yyyy-MM-dd"), end: format(setDate(month, 15), "yyyy-MM-dd") };
  const last = endOfMonth(month);
  return { label: `${format(month, "MMM yyyy")} 16th–${format(last, "do")}`, start: format(setDate(month, 16), "yyyy-MM-dd"), end: format(last, "yyyy-MM-dd") };
}

interface RunWithDetails { id: string; run_type: string; status: string; started_at: string; closed_at: string | null; driver: { id: string; name: string } | null; route: { id: string; name: string } | null; }
interface RunApproval { id: string; run_id: string; status: string; notes: string | null; }

export default function TransportRunsPay() {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [runs, setRuns] = useState<RunWithDetails[]>([]);
  const [approvals, setApprovals] = useState<RunApproval[]>([]);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [selectedDriver, setSelectedDriver] = useState<{ id: string; name: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ route: string; runType: string; date: string; time: string }>({ route: "", runType: "", date: "", time: "" });
  const [routes, setRoutes] = useState<{ id: string; name: string }[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedRosters, setExpandedRosters] = useState<Set<string>>(new Set());
  const [rosterData, setRosterData] = useState<Record<string, { youth_id: string; status: string; first_name: string; last_name: string; photo_url: string | null; pickup_zone: string }[]>>({});

  const currentPayPeriod = useMemo(() => getCurrentPayPeriod(), []);
  const [payPeriodRuns, setPayPeriodRuns] = useState<RunWithDetails[]>([]);
  const [yearRuns, setYearRuns] = useState<RunWithDetails[]>([]);
  const [paidDrivers, setPaidDrivers] = useState<Set<string>>(new Set());
  const [undoConfirmDriverId, setUndoConfirmDriverId] = useState<string | null>(null);

  // Driver history modal
  const [historyDriverId, setHistoryDriverId] = useState<string | null>(null);
  const [historyDriverName, setHistoryDriverName] = useState("");
  const [allDriverRuns, setAllDriverRuns] = useState<RunWithDetails[]>([]);
  const [allDriverApprovals, setAllDriverApprovals] = useState<RunApproval[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Load paid status from driver_pay_periods
  const loadPaidStatus = useCallback(async () => {
    const { data } = await supabase
      .from("driver_pay_periods")
      .select("driver_id, status")
      .eq("period_start", currentPayPeriod.start)
      .eq("period_end", currentPayPeriod.end);
    if (data) {
      const paid = new Set<string>();
      data.forEach((d) => { if (d.status === "paid") paid.add(d.driver_id); });
      setPaidDrivers(paid);
    }
  }, [currentPayPeriod]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const from = new Date(format(monthStart, "yyyy-MM-dd") + "T00:00:00").toISOString();
    const to = new Date(format(monthEnd, "yyyy-MM-dd") + "T23:59:59").toISOString();
    // Use local-time boundaries (matches the calendar which renders started_at in local time)
    const ppFrom = new Date(`${currentPayPeriod.start}T00:00:00`).toISOString();
    const ppTo = new Date(`${currentPayPeriod.end}T23:59:59`).toISOString();
    const yearStart = new Date(`${new Date().getFullYear()}-01-01T00:00:00`).toISOString();
    const yearEnd = new Date(`${new Date().getFullYear()}-12-31T23:59:59`).toISOString();

    const [runsRes, approvalsRes, attRes, routesRes, ppRunsRes, yearRunsRes] = await Promise.all([
      supabase.from("runs").select("id, run_type, status, started_at, closed_at, driver:drivers(id, name), route:routes(id, name)").eq("status", "completed").gte("started_at", from).lte("started_at", to).order("started_at", { ascending: false }),
      supabase.from("run_approvals").select("id, run_id, status, notes"),
      supabase.from("transport_attendance").select("run_id").gte("recorded_at", from).lte("recorded_at", to),
      supabase.from("routes").select("id, name"),
      supabase.from("runs").select("id, run_type, status, started_at, closed_at, driver:drivers(id, name), route:routes(id, name)").eq("status", "completed").gte("started_at", ppFrom).lte("started_at", ppTo),
      supabase.from("runs").select("id, run_type, status, started_at, closed_at, driver:drivers(id, name), route:routes(id, name)").eq("status", "completed").gte("started_at", yearStart).lte("started_at", yearEnd),
    ]);
    if (runsRes.data) setRuns(runsRes.data as unknown as RunWithDetails[]);
    if (approvalsRes.data) setApprovals(approvalsRes.data as unknown as RunApproval[]);
    if (routesRes.data) setRoutes(routesRes.data as unknown as { id: string; name: string }[]);
    if (ppRunsRes.data) setPayPeriodRuns(ppRunsRes.data as unknown as RunWithDetails[]);
    if (yearRunsRes.data) setYearRuns(yearRunsRes.data as unknown as RunWithDetails[]);
    const counts: Record<string, number> = {};
    (attRes.data || []).forEach((a: { run_id: string }) => { counts[a.run_id] = (counts[a.run_id] || 0) + 1; });
    setAttendanceCounts(counts);
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => {
    fetchData();
    loadPaidStatus();
    const channel = supabase.channel("trips-pay-unified")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "run_approvals" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_pay_periods" }, () => loadPaidStatus())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, loadPaidStatus]);

  const approvalMap = useMemo(() => { const m = new Map<string, RunApproval>(); approvals.forEach((a) => m.set(a.run_id, a)); return m; }, [approvals]);

  const runsByDateDriver = useMemo(() => {
    const map = new Map<string, Map<string, { driverName: string; runs: RunWithDetails[]; worstStatus: string }>>();
    runs.forEach((r) => {
      if (!r.driver) return;
      const dateKey = format(new Date(r.started_at), "yyyy-MM-dd");
      if (!map.has(dateKey)) map.set(dateKey, new Map());
      const dateMap = map.get(dateKey)!;
      if (!dateMap.has(r.driver.id)) dateMap.set(r.driver.id, { driverName: r.driver.name, runs: [], worstStatus: "approved" });
      const entry = dateMap.get(r.driver.id)!;
      entry.runs.push(r);
      const status = approvalMap.get(r.id)?.status || "pending";
      if (status === "disputed") entry.worstStatus = "disputed";
      else if (status === "pending" && entry.worstStatus !== "disputed") entry.worstStatus = "pending";
    });
    return map;
  }, [runs, approvalMap]);

  const monthStats = useMemo(() => {
    let totalTrips = 0, approved = 0, pending = 0;
    runs.forEach((r) => { totalTrips++; const s = approvalMap.get(r.id)?.status || "pending"; if (s === "approved") approved++; else if (s === "pending") pending++; });
    return { totalTrips, approved, pending };
  }, [runs, approvalMap]);

  const payPeriodOwed = useMemo(() => {
    return payPeriodRuns.reduce((sum, r) => sum + getPayRate(r.route?.name), 0);
  }, [payPeriodRuns]);

  const driverPayData = useMemo(() => {
    const map = new Map<string, { name: string; payPeriodEarnings: number; monthEarnings: number; yearEarnings: number; payPeriodTrips: number; monthTrips: number; yearTrips: number }>();
    const ensure = (id: string, name: string) => {
      if (!map.has(id)) map.set(id, { name, payPeriodEarnings: 0, monthEarnings: 0, yearEarnings: 0, payPeriodTrips: 0, monthTrips: 0, yearTrips: 0 });
      return map.get(id)!;
    };
    runs.forEach((r) => { if (!r.driver) return; const e = ensure(r.driver.id, r.driver.name); e.monthEarnings += getPayRate(r.route?.name); e.monthTrips++; });
    payPeriodRuns.forEach((r) => { if (!r.driver) return; const e = ensure(r.driver.id, r.driver.name); e.payPeriodEarnings += getPayRate(r.route?.name); e.payPeriodTrips++; });
    yearRuns.forEach((r) => { if (!r.driver) return; const e = ensure(r.driver.id, r.driver.name); e.yearEarnings += getPayRate(r.route?.name); e.yearTrips++; });
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [runs, payPeriodRuns, yearRuns]);

  const calendarDays = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const blanks = Array.from({ length: getDay(monthStart) }, (_, i) => ({ blank: true as const, key: `b${i}` }));
    const filled = days.map((d) => ({ blank: false as const, date: d, key: format(d, "yyyy-MM-dd") }));
    return [...blanks, ...filled];
  }, [currentMonth]);

  const handleApprove = async (runId: string) => {
    const existing = approvalMap.get(runId);
    if (existing) await supabase.from("run_approvals").update({ status: "approved", reviewed_at: new Date().toISOString(), notes: null }).eq("id", existing.id);
    else await supabase.from("run_approvals").insert({ run_id: runId, status: "approved", reviewed_at: new Date().toISOString() });
    toast({ title: "Trip approved" }); fetchData();
  };
  const handleDispute = async (runId: string) => {
    const notes = noteInputs[runId] || "";
    const existing = approvalMap.get(runId);
    if (existing) await supabase.from("run_approvals").update({ status: "disputed", reviewed_at: new Date().toISOString(), notes }).eq("id", existing.id);
    else await supabase.from("run_approvals").insert({ run_id: runId, status: "disputed", reviewed_at: new Date().toISOString(), notes });
    toast({ title: "Trip disputed", variant: "destructive" }); fetchData();
  };
  const handleDeleteRun = async (id: string) => {
    await supabase.from("run_approvals").delete().eq("run_id", id);
    await supabase.from("transport_attendance").delete().eq("run_id", id);
    await supabase.from("incidents").delete().eq("run_id", id);
    await supabase.from("runs").delete().eq("id", id);
    setDeleteConfirmId(null);
    toast({ title: "Trip deleted" }); fetchData();
  };
  const startEdit = (r: RunWithDetails) => {
    setEditingRunId(r.id);
    setEditForm({ route: r.route?.id || "", runType: r.run_type, date: format(new Date(r.started_at), "yyyy-MM-dd"), time: format(new Date(r.started_at), "HH:mm") });
  };
  const handleSaveEdit = async () => {
    if (!editingRunId) return;
    const newStartedAt = new Date(`${editForm.date}T${editForm.time}:00`).toISOString();
    await supabase.from("runs").update({ route_id: editForm.route, run_type: editForm.runType as "pickup" | "dropoff", started_at: newStartedAt }).eq("id", editingRunId);
    setEditingRunId(null);
    toast({ title: "Trip updated" }); fetchData();
  };
  const exportMonth = () => {
    const allMonthRuns = runs;
    const driverPayRows = driverPayData.map(([driverId, d]) => [
      d.name, String(d.monthTrips), `$${d.monthEarnings}`, `$${d.payPeriodEarnings}`, `$${d.yearEarnings}`, paidDrivers.has(driverId) ? "Paid" : "Unpaid"
    ]);
    const tripRows = allMonthRuns.map((r) => [
      format(new Date(r.started_at), "MM/dd/yyyy"), r.run_type, r.driver?.name || "", r.route?.name || "", r.status, `$${getPayRate(r.route?.name)}`, String(attendanceCounts[r.id] || 0), approvalMap.get(r.id)?.status || "pending"
    ]);
    const csv = toCsv(
      ["Date","Type","Driver","Route","Status","Pay","Youth Count","Approval"],
      tripRows
    ) + "\n\n" + toCsv(
      ["Driver","Month Trips","Month $","Period $","Year $","Pay Status"],
      driverPayRows
    );
    downloadCsv(`trips_pay_${format(currentMonth, "yyyy-MM")}.csv`, csv);
  };

  const handleMarkPaid = async (driverId: string) => {
    // Check if a record already exists
    const { data: existing } = await supabase
      .from("driver_pay_periods")
      .select("id")
      .eq("driver_id", driverId)
      .eq("period_start", currentPayPeriod.start)
      .eq("period_end", currentPayPeriod.end)
      .maybeSingle();

    const driverData = driverPayData.find(([id]) => id === driverId);
    const totalAmount = driverData ? driverData[1].payPeriodEarnings : 0;

    if (existing) {
      await supabase.from("driver_pay_periods").update({ status: "paid", total_amount: totalAmount, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("driver_pay_periods").insert({
        driver_id: driverId,
        period_start: currentPayPeriod.start,
        period_end: currentPayPeriod.end,
        status: "paid",
        total_amount: totalAmount,
      });
    }
    setPaidDrivers((prev) => new Set([...prev, driverId]));
    toast({ title: "Marked as paid — saved to database" });
  };

  const handleMarkUnpaid = async (driverId: string) => {
    const { data: existing } = await supabase
      .from("driver_pay_periods")
      .select("id")
      .eq("driver_id", driverId)
      .eq("period_start", currentPayPeriod.start)
      .eq("period_end", currentPayPeriod.end)
      .maybeSingle();

    if (existing) {
      await supabase.from("driver_pay_periods").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", existing.id);
    }
    setPaidDrivers((prev) => { const s = new Set(prev); s.delete(driverId); return s; });
    setUndoConfirmDriverId(null);
    toast({ title: "Payment status reverted to unpaid" });
  };

  const toggleRoster = async (runId: string) => {
    setExpandedRosters((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) { next.delete(runId); return next; }
      next.add(runId);
      return next;
    });
    if (rosterData[runId]) return;
    const { data } = await supabase
      .from("transport_attendance")
      .select("youth_id, status, youth:youth_profiles(first_name, last_name, photo_url, pickup_zone)")
      .eq("run_id", runId);
    if (data) {
      // Resolve signed URLs in parallel for any non-http photo paths (private buckets)
      const rows = await Promise.all(
        data.map(async (d: any) => {
          const raw: string | null = d.youth?.photo_url || null;
          let resolved: string | null = null;
          if (raw) {
            if (raw.startsWith("http")) {
              resolved = raw;
            } else {
              // Try youth-photos bucket first, fall back to registration-signatures
              const buckets = ["youth-photos", "registration-signatures"];
              for (const bucket of buckets) {
                const { data: signed } = await supabase.storage
                  .from(bucket)
                  .createSignedUrl(raw, 3600);
                if (signed?.signedUrl) {
                  resolved = signed.signedUrl;
                  break;
                }
              }
            }
          }
          return {
            youth_id: d.youth_id,
            status: d.status,
            first_name: d.youth?.first_name || "Unknown",
            last_name: d.youth?.last_name || "",
            photo_url: resolved,
            pickup_zone: d.youth?.pickup_zone || "",
          };
        })
      );
      setRosterData((prev) => ({ ...prev, [runId]: rows }));
    }
  };

  // Driver history modal
  const openDriverHistory = async (driverId: string, driverName: string) => {
    setHistoryDriverId(driverId);
    setHistoryDriverName(driverName);
    setHistoryLoading(true);
    setExpandedMonths(new Set());
    const [runsRes, approvalsRes] = await Promise.all([
      supabase.from("runs").select("id, run_type, status, started_at, closed_at, driver:drivers(id, name), route:routes(id, name)").eq("status", "completed").eq("driver_id", driverId).order("started_at", { ascending: false }).limit(500),
      supabase.from("run_approvals").select("id, run_id, status, notes"),
    ]);
    if (runsRes.data) setAllDriverRuns(runsRes.data as unknown as RunWithDetails[]);
    if (approvalsRes.data) setAllDriverApprovals(approvalsRes.data as unknown as RunApproval[]);
    setHistoryLoading(false);
  };

  const driverHistoryByMonth = useMemo(() => {
    const approvalM = new Map<string, RunApproval>();
    allDriverApprovals.forEach((a) => approvalM.set(a.run_id, a));
    const map = new Map<string, { trips: RunWithDetails[]; total: number; approved: number; pending: number; routeBreakdown: Record<string, number> }>();
    allDriverRuns.forEach((r) => {
      const monthKey = format(new Date(r.started_at), "yyyy-MM");
      if (!map.has(monthKey)) map.set(monthKey, { trips: [], total: 0, approved: 0, pending: 0, routeBreakdown: {} });
      const entry = map.get(monthKey)!;
      entry.trips.push(r);
      const routeName = r.route?.name || "Unknown";
      entry.routeBreakdown[routeName] = (entry.routeBreakdown[routeName] || 0) + 1;
      const pay = getPayRate(r.route?.name);
      entry.total += pay;
      const status = approvalM.get(r.id)?.status || "pending";
      if (status === "approved") entry.approved++;
      else entry.pending++;
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [allDriverRuns, allDriverApprovals]);

  const driverYearTotal = useMemo(() => driverHistoryByMonth.reduce((sum, [, d]) => sum + d.total, 0), [driverHistoryByMonth]);

  const exportDriverHistory = () => {
    const approvalM = new Map<string, RunApproval>();
    allDriverApprovals.forEach((a) => approvalM.set(a.run_id, a));
    const csv = toCsv(
      ["Date", "Route", "Type", "Pay", "Status"],
      allDriverRuns.map((r) => [
        format(new Date(r.started_at), "MM/dd/yyyy"),
        r.route?.name || "",
        r.run_type,
        `$${getPayRate(r.route?.name)}`,
        approvalM.get(r.id)?.status || "pending",
      ])
    );
    downloadCsv(`${historyDriverName.replace(/\s+/g, "_")}_pay_history.csv`, csv);
  };

  const panelRuns = useMemo(() => {
    if (!selectedDriver || !selectedDate) return [];
    return runs.filter((r) => r.driver?.id === selectedDriver.id && format(new Date(r.started_at), "yyyy-MM-dd") === selectedDate).sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  }, [runs, selectedDriver, selectedDate]);
  const panelTotal = useMemo(() => panelRuns.reduce((sum, r) => sum + getPayRate(r.route?.name), 0), [panelRuns]);

  const statusDot = (s: string) => s === "approved" ? "bg-green-400" : s === "disputed" ? "bg-red-400" : "bg-yellow-400";
  const getEditPayRate = (routeId: string) => {
    const route = routes.find((rt) => rt.id === routeId);
    return getPayRate(route?.name);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page header + export */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-white">Trips & Pay</h1>
        <Button onClick={exportMonth} variant="outline" size="sm" className="gap-2 border-white/10 text-white/60 hover:text-white bg-transparent"><Download className="w-4 h-4" /> Export CSV</Button>
      </div>

      {/* Section 1 — Summary Boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-white">{monthStats.totalTrips}</p>
          <p className="text-white/40 text-[10px] uppercase tracking-wider">Total Trips</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-green-400">{monthStats.approved}</p>
          <p className="text-white/40 text-[10px] uppercase tracking-wider">Approved</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-yellow-400">{monthStats.pending}</p>
          <p className="text-white/40 text-[10px] uppercase tracking-wider">Pending</p>
        </div>
        <div className="bg-white/5 border border-[#DC2626]/30 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-[#DC2626]">${payPeriodOwed}</p>
          <p className="text-white/40 text-[10px] uppercase tracking-wider">Pay Period Owed</p>
          <p className="text-white/20 text-[8px] mt-0.5">{currentPayPeriod.label}</p>
        </div>
      </div>

      {/* Section 2 — Calendar */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 justify-center">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="text-white font-bold text-lg min-w-[160px] text-center">{format(currentMonth, "MMMM yyyy")}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"><ChevronRight className="w-5 h-5" /></button>
        </div>

        {loading ? <div className="text-white/40 text-center py-12">Loading...</div> : (
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <div className="grid grid-cols-7 bg-white/5">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                <div key={d} className="text-center text-white/40 text-[10px] uppercase tracking-wider py-2 font-medium">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((cell) => {
                if (cell.blank) return <div key={cell.key} className="min-h-[80px] border-t border-r border-white/5 bg-white/[0.01]" />;
                const nonBlank = cell as { blank: false; date: Date; key: string };
                const dateKey = nonBlank.key;
                const dayDrivers = runsByDateDriver.get(dateKey);
                const isToday = format(new Date(), "yyyy-MM-dd") === dateKey;
                return (
                  <div key={nonBlank.key} className={`min-h-[80px] border-t border-r border-white/5 p-1.5 ${isToday ? "bg-[#DC2626]/5 border-t-2 border-t-[#DC2626]/40" : ""}`}>
                    <p className={`text-[11px] font-medium mb-1 ${isToday ? "text-[#DC2626]" : "text-white/40"}`}>{format(nonBlank.date, "d")}</p>
                    {dayDrivers && <div className="space-y-0.5">
                      {[...dayDrivers.entries()].map(([driverId, entry]) => (
                        <button key={driverId} onClick={() => { setSelectedDriver({ id: driverId, name: entry.driverName }); setSelectedDate(dateKey); setPanelOpen(true); setEditingRunId(null); setDeleteConfirmId(null); }} className="w-full flex items-center gap-1 px-1 py-0.5 rounded hover:bg-white/10 transition-colors text-left group">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(entry.worstStatus)}`} />
                          <span className="text-[10px] text-white/70 group-hover:text-white truncate leading-tight">{entry.driverName.split(" ")[0]}</span>
                          <span className="text-[9px] text-white/30 ml-auto flex-shrink-0">{entry.runs.length}</span>
                        </button>
                      ))}
                    </div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Section 3 — Driver Pay Summary */}
      {!loading && driverPayData.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-white font-bold text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-400" /> Driver Pay — {currentPayPeriod.label}</h3>
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 bg-white/5 px-3 py-2 text-[10px] text-white/40 uppercase tracking-wider font-medium">
              <span>Driver</span>
              <span className="text-right w-20">Period $</span>
              <span className="text-right w-20">Month $</span>
              <span className="text-right w-20">Year $</span>
              <span className="text-center w-16">Status</span>
              <span className="w-20" />
            </div>
            {driverPayData.map(([driverId, d]) => (
              <div key={driverId} className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 items-center px-3 py-2.5 border-t border-white/5 hover:bg-white/[0.02]">
                <button onClick={() => openDriverHistory(driverId, d.name)} className="text-left text-white font-medium text-sm hover:text-[#DC2626] transition-colors flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-white/30" />{d.name}
                </button>
                <span className="text-green-400 font-bold text-sm text-right w-20">${d.payPeriodEarnings}</span>
                <span className="text-white/50 text-sm text-right w-20">${d.monthEarnings}</span>
                <button onClick={() => openDriverHistory(driverId, d.name)} className="text-right w-20 text-blue-400 font-bold text-sm underline underline-offset-2 hover:text-blue-300 transition-colors cursor-pointer">${d.yearEarnings}</button>
                <span className="text-center w-16">
                  <Badge className={paidDrivers.has(driverId) ? "bg-green-500/20 text-green-400 border-green-500/30 text-[10px]" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]"}>
                    {paidDrivers.has(driverId) ? "Paid" : "Unpaid"}
                  </Badge>
                </span>
                <span className="w-24 text-right">
                  {paidDrivers.has(driverId) ? (
                    undoConfirmDriverId === driverId ? (
                      <div className="flex items-center gap-1">
                        <Button size="sm" onClick={() => setUndoConfirmDriverId(null)} variant="outline" className="text-[9px] h-5 px-1.5 border-white/20 text-white/50 bg-transparent hover:bg-white/10">Cancel</Button>
                        <Button size="sm" onClick={() => handleMarkUnpaid(driverId)} className="bg-red-600 hover:bg-red-700 text-white text-[9px] h-5 px-1.5">Confirm</Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => setUndoConfirmDriverId(driverId)} variant="outline" className="text-[10px] h-6 px-2 gap-1 border-white/20 text-white/40 bg-transparent hover:bg-white/10 hover:text-white">Undo</Button>
                    )
                  ) : d.payPeriodEarnings > 0 ? (
                    <Button size="sm" onClick={() => handleMarkPaid(driverId)} className="bg-green-600 hover:bg-green-700 text-white text-[10px] h-6 px-2 gap-1"><DollarSign className="w-3 h-3" />Paid</Button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trip Detail Dialog */}
      <Dialog open={panelOpen} onOpenChange={(open) => { setPanelOpen(open); if (!open) { setEditingRunId(null); setDeleteConfirmId(null); setExpandedRosters(new Set()); } }}>
        <DialogContent className="bg-[#111827] border-white/10 text-white max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white">{selectedDriver?.name} — {selectedDate ? format(new Date(selectedDate + "T12:00:00"), "MMM d, yyyy") : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            {panelRuns.length === 0 ? <p className="text-white/40 text-sm text-center py-4">No trips found.</p> : panelRuns.map((r) => {
              const approval = approvalMap.get(r.id); const status = approval?.status || "pending"; const pay = getPayRate(r.route?.name); const youthCount = attendanceCounts[r.id] || 0;
              const isEditing = editingRunId === r.id;
              const isDeleting = deleteConfirmId === r.id;

              if (isDeleting) {
                return (
                  <div key={r.id} className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-3">
                    <p className="text-white text-sm font-medium">Are you sure you want to delete this trip? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDeleteConfirmId(null)} className="text-xs border-white/20 text-white bg-transparent hover:bg-white/10">Cancel</Button>
                      <Button size="sm" onClick={() => handleDeleteRun(r.id)} className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1"><Trash2 className="w-3 h-3" /> Delete</Button>
                    </div>
                  </div>
                );
              }

              if (isEditing) {
                return (
                  <div key={r.id} className="bg-white/5 border border-blue-500/30 rounded-lg p-3 space-y-3">
                    <p className="text-white text-sm font-medium">Edit Trip</p>
                    <div className="space-y-2">
                      <div>
                        <label className="text-white/40 text-[10px] uppercase">Route</label>
                        <select value={editForm.route} onChange={(e) => setEditForm((f) => ({ ...f, route: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white">
                          {routes.map((rt) => <option key={rt.id} value={rt.id} className="bg-[#111827]">{rt.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-white/40 text-[10px] uppercase">Run Type</label>
                        <select value={editForm.runType} onChange={(e) => setEditForm((f) => ({ ...f, runType: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white">
                          <option value="pickup" className="bg-[#111827]">Pickup</option>
                          <option value="dropoff" className="bg-[#111827]">Dropoff</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-white/40 text-[10px] uppercase">Date</label>
                          <input type="date" value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-white/40 text-[10px] uppercase">Time</label>
                          <input type="time" value={editForm.time} onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white" />
                        </div>
                      </div>
                      <p className="text-green-400 text-xs">Pay: ${getEditPayRate(editForm.route)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingRunId(null)} className="text-xs border-white/20 text-white bg-transparent hover:bg-white/10">Cancel</Button>
                      <Button size="sm" onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700 text-white text-xs">Save</Button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={r.id} className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap"><span className="text-white font-medium text-sm">{r.route?.name}</span><span className="text-white/30">•</span><span className="text-white/50 text-sm capitalize">{r.run_type}</span></div>
                      <div className="flex items-center gap-3 text-xs text-white/30">
                        <span>{format(new Date(r.started_at), "h:mm a")}</span>
                        <button onClick={() => toggleRoster(r.id)} className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors font-medium">
                          <Users className="w-3 h-3" />
                          {youthCount} youth
                          {expandedRosters.has(r.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        <span className="text-green-400 font-medium">${pay}</span>
                      </div>
                    </div>
                    <Badge className={status === "approved" ? "bg-green-500/20 text-green-400 border-green-500/30" : status === "disputed" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>{status}</Badge>
                  </div>

                  {/* Youth Roster */}
                  {expandedRosters.has(r.id) && (
                    <div className="bg-black/20 border border-white/5 rounded-lg p-2 space-y-1.5">
                      {!rosterData[r.id] ? (
                        <p className="text-white/30 text-xs text-center py-2">Loading...</p>
                      ) : rosterData[r.id].length === 0 ? (
                        <p className="text-white/30 text-xs text-center py-2">No youth recorded for this trip</p>
                      ) : (
                        rosterData[r.id].map((y) => {
                          const photoUrl = y.photo_url ? (y.photo_url.startsWith("http") ? y.photo_url : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/registration-signatures/${y.photo_url}`) : null;
                          const statusLabel = y.status === "picked_up" ? "Pick-Up" : y.status === "dropped_off" ? "Drop-Off" : y.status === "both" ? "Both" : y.status;
                          const statusColor = y.status === "picked_up" ? "text-red-400" : y.status === "dropped_off" ? "text-green-400" : y.status === "both" ? "text-blue-400" : "text-white/40";
                          return (
                            <div key={y.youth_id} className="flex items-center gap-2.5 py-1">
                              <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                                {photoUrl ? (
                                  <img src={photoUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                ) : (
                                  <span className="text-white/30 text-[9px] font-bold">{y.first_name[0]}{y.last_name[0]}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-xs font-medium truncate">{y.first_name} {y.last_name}</p>
                                <p className="text-white/30 text-[10px]">{y.pickup_zone}</p>
                              </div>
                              <span className={`text-[10px] font-semibold ${statusColor}`}>{statusLabel}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                  {status === "disputed" && approval?.notes && <p className="text-red-400/70 text-xs italic">Note: {approval.notes}</p>}
                  {status !== "approved" && (
                    <input placeholder="Dispute note..." value={noteInputs[r.id] || ""} onChange={(e) => setNoteInputs((prev) => ({ ...prev, [r.id]: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder:text-white/30" />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" onClick={() => handleApprove(r.id)} className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1 h-7 px-2" disabled={status === "approved"}><CheckCircle className="w-3 h-3" /> Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDispute(r.id)} className="text-xs gap-1 h-7 px-2" disabled={status === "disputed"}><XCircle className="w-3 h-3" /> Dispute</Button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => startEdit(r)} className="p-1.5 rounded hover:bg-blue-500/20 text-white/40 hover:text-blue-400 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteConfirmId(r.id)} className="p-1.5 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
            {panelRuns.length > 0 && (
              <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-lg p-3 flex items-center justify-between">
                <span className="text-white/70 text-sm font-medium">Day Total</span>
                <span className="text-white font-bold text-lg">${panelTotal}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Driver Pay History Modal */}
      <Dialog open={!!historyDriverId} onOpenChange={(open) => { if (!open) setHistoryDriverId(null); }}>
        <DialogContent className="bg-[#111827] border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2"><User className="w-5 h-5" /> {historyDriverName} — Pay History</DialogTitle>
          </DialogHeader>
          {historyLoading ? <div className="text-white/40 text-center py-8">Loading...</div> : (
            <div className="space-y-3 mt-2">
              <div className="flex justify-end">
                <Button onClick={exportDriverHistory} variant="outline" size="sm" className="gap-2 border-white/10 text-white/60 hover:text-white bg-transparent"><Download className="w-4 h-4" /> Export CSV</Button>
              </div>

              {driverHistoryByMonth.length === 0 ? <p className="text-white/40 text-center py-4">No trip history found.</p> : driverHistoryByMonth.map(([monthKey, data]) => {
                const isExpanded = expandedMonths.has(monthKey);
                const monthLabel = format(new Date(monthKey + "-01"), "MMMM yyyy");
                return (
                  <div key={monthKey} className="border border-white/10 rounded-lg overflow-hidden">
                    <button onClick={() => setExpandedMonths((prev) => { const s = new Set(prev); if (s.has(monthKey)) s.delete(monthKey); else s.add(monthKey); return s; })} className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium text-sm">{monthLabel}</span>
                        <span className="text-white/30 text-xs">{data.trips.length} trips</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-green-400 font-bold text-sm">${data.total}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-4 py-2 space-y-2 bg-white/[0.02]">
                        <div className="flex gap-2 flex-wrap pb-1.5 border-b border-white/5">
                          {Object.entries(data.routeBreakdown).map(([route, count]) => (
                            <span key={route} className="bg-white/5 text-white/50 text-[10px] px-2 py-0.5 rounded">{route}: {count}</span>
                          ))}
                        </div>
                        {data.trips.map((r) => {
                          const approvalM = new Map<string, RunApproval>();
                          allDriverApprovals.forEach((a) => approvalM.set(a.run_id, a));
                          const status = approvalM.get(r.id)?.status || "pending";
                          return (
                            <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-white/50">{format(new Date(r.started_at), "MMM d")}</span>
                                <span className="text-white/70">{r.route?.name}</span>
                                <span className="text-white/30 capitalize">{r.run_type}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-400 text-xs font-medium">${getPayRate(r.route?.name)}</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${status === "approved" ? "bg-green-400" : status === "disputed" ? "bg-red-400" : "bg-yellow-400"}`} />
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between pt-1.5 text-xs">
                          <span className="text-white/40 font-medium">Month Subtotal</span>
                          <span className="text-green-400 font-bold">${data.total}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {driverHistoryByMonth.length > 0 && (
                <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 rounded-lg p-4 flex items-center justify-between">
                  <span className="text-white font-bold text-sm">{new Date().getFullYear()} Year Total</span>
                  <span className="text-white font-bold text-xl">${driverYearTotal}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
