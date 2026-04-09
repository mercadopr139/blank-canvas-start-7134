import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, CheckCircle, XCircle,
  Download, Calendar, Trash2, DollarSign,
} from "lucide-react";
import { format, endOfMonth, setDate } from "date-fns";

/* ── shared helpers ── */

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getPayRate(routeName: string | undefined): number {
  if (routeName === "Overflow") return 25;
  return 50;
}

type PayPeriod = { label: string; start: string; end: string };

function getPayPeriods(): PayPeriod[] {
  const now = new Date();
  const periods: PayPeriod[] = [];
  for (let offset = 0; offset < 3; offset++) {
    const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const mid = setDate(month, 15);
    const last = endOfMonth(month);
    periods.push({
      label: `${format(month, "MMM yyyy")} 16th–${format(last, "do")}`,
      start: format(setDate(month, 16), "yyyy-MM-dd"),
      end: format(last, "yyyy-MM-dd"),
    });
    periods.push({
      label: `${format(month, "MMM yyyy")} 1st–15th`,
      start: format(month, "yyyy-MM-dd"),
      end: format(mid, "yyyy-MM-dd"),
    });
  }
  return periods;
}

function getCurrentPayPeriod(): PayPeriod {
  const now = new Date();
  const day = now.getDate();
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  if (day <= 15) {
    return {
      label: `${format(month, "MMM yyyy")} 1st–15th`,
      start: format(month, "yyyy-MM-dd"),
      end: format(setDate(month, 15), "yyyy-MM-dd"),
    };
  }
  const last = endOfMonth(month);
  return {
    label: `${format(month, "MMM yyyy")} 16th–${format(last, "do")}`,
    start: format(setDate(month, 16), "yyyy-MM-dd"),
    end: format(last, "yyyy-MM-dd"),
  };
}

/* ── types ── */

interface RunWithDetails {
  id: string;
  run_type: string;
  status: string;
  started_at: string;
  closed_at: string | null;
  driver: { id: string; name: string } | null;
  route: { id: string; name: string } | null;
  attendance: {
    id: string;
    status: string;
    youth: { id: string; first_name: string; last_name: string; pickup_zone: string } | null;
  }[];
}

interface RunApproval {
  id: string;
  run_id: string;
  status: string;
  notes: string | null;
}

interface IncidentRow {
  id: string;
  description: string;
  recorded_at: string;
  driver: { name: string } | null;
  youth: { first_name: string; last_name: string } | null;
  run: { run_type: string } | null;
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function TransportRunsPay() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold text-white">Trips & Pay</h1>
      <Tabs defaultValue="history" className="space-y-4">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="history" className="data-[state=active]:bg-[#DC2626] data-[state=active]:text-white text-white/50">
            History
          </TabsTrigger>
          <TabsTrigger value="pay" className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white text-white/50">
            Pay
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history"><HistoryTab /></TabsContent>
        <TabsContent value="pay"><PayTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── TAB 1: HISTORY ─── */

function HistoryTab() {
  const { toast } = useToast();
  const defaultPeriod = getCurrentPayPeriod();
  const [dateFrom, setDateFrom] = useState(defaultPeriod.start);
  const [dateTo, setDateTo] = useState(defaultPeriod.end);
  const [runs, setRuns] = useState<RunWithDetails[]>([]);
  const [approvals, setApprovals] = useState<RunApproval[]>([]);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [driverFilter, setDriverFilter] = useState("all");
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const fetchData = async () => {
    setLoading(true);
    const from = dateFrom + "T00:00:00";
    const to = dateTo + "T23:59:59";

    const [runsRes, approvalsRes, attRes, incRes] = await Promise.all([
      supabase
        .from("runs")
        .select("id, run_type, status, started_at, closed_at, driver:drivers(id, name), route:routes(id, name)")
        .eq("status", "completed")
        .gte("started_at", from)
        .lte("started_at", to)
        .order("started_at", { ascending: false }),
      supabase.from("run_approvals").select("id, run_id, status, notes"),
      supabase.from("transport_attendance").select("run_id").eq("status", "present").gte("recorded_at", from).lte("recorded_at", to),
      supabase.from("incidents").select("id, description, recorded_at, driver:drivers(name), youth:youth_profiles(first_name, last_name), run:runs(run_type)").gte("recorded_at", from).lte("recorded_at", to).order("recorded_at", { ascending: false }),
    ]);

    if (runsRes.data) setRuns(runsRes.data as unknown as RunWithDetails[]);
    if (approvalsRes.data) setApprovals(approvalsRes.data as unknown as RunApproval[]);
    if (incRes.data) setIncidents(incRes.data as unknown as IncidentRow[]);

    const counts: Record<string, number> = {};
    (attRes.data || []).forEach((a: any) => {
      counts[a.run_id] = (counts[a.run_id] || 0) + 1;
    });
    setAttendanceCounts(counts);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("history-tab")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dateFrom, dateTo]);

  const approvalMap = useMemo(() => {
    const m = new Map<string, RunApproval>();
    approvals.forEach((a) => m.set(a.run_id, a));
    return m;
  }, [approvals]);

  const drivers = useMemo(() => {
    const set = new Map<string, string>();
    runs.forEach((r) => { if (r.driver) set.set(r.driver.id, r.driver.name); });
    return [...set.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [runs]);

  const filteredRuns = useMemo(() => {
    if (driverFilter === "all") return runs;
    return runs.filter((r) => r.driver?.id === driverFilter);
  }, [runs, driverFilter]);

  const handleApprove = async (runId: string) => {
    const existing = approvalMap.get(runId);
    if (existing) {
      await supabase.from("run_approvals").update({ status: "approved", reviewed_at: new Date().toISOString(), notes: null }).eq("id", existing.id);
    } else {
      await supabase.from("run_approvals").insert({ run_id: runId, status: "approved", reviewed_at: new Date().toISOString() });
    }
    toast({ title: "Run approved" });
    fetchData();
  };

  const handleDispute = async (runId: string) => {
    const notes = noteInputs[runId] || "";
    const existing = approvalMap.get(runId);
    if (existing) {
      await supabase.from("run_approvals").update({ status: "disputed", reviewed_at: new Date().toISOString(), notes }).eq("id", existing.id);
    } else {
      await supabase.from("run_approvals").insert({ run_id: runId, status: "disputed", reviewed_at: new Date().toISOString(), notes });
    }
    toast({ title: "Run disputed", variant: "destructive" });
    fetchData();
  };

  const handleDeleteRun = async (id: string) => {
    if (!confirm("Delete this run and its records?")) return;
    setDeleting(id);
    await supabase.from("run_approvals").delete().eq("run_id", id);
    await supabase.from("transport_attendance").delete().eq("run_id", id);
    await supabase.from("incidents").delete().eq("run_id", id);
    await supabase.from("runs").delete().eq("id", id);
    toast({ title: "Run deleted" });
    setDeleting(null);
    fetchData();
  };

  const handleDeleteIncident = async (id: string) => {
    if (!confirm("Delete this incident?")) return;
    setDeleting(id);
    await supabase.from("incidents").delete().eq("id", id);
    toast({ title: "Incident deleted" });
    setDeleting(null);
    fetchData();
  };

  const exportRuns = () => {
    const csv = toCsv(
      ["Date", "Type", "Driver", "Route", "Status", "Pay", "Youth Count", "Approval"],
      filteredRuns.map((r) => [
        format(new Date(r.started_at), "MM/dd/yyyy"),
        r.run_type,
        r.driver?.name || "",
        r.route?.name || "",
        r.status,
        `$${getPayRate(r.route?.name)}`,
        String(attendanceCounts[r.id] || 0),
        approvalMap.get(r.id)?.status || "pending",
      ])
    );
    downloadCsv(`runs_${dateFrom}_${dateTo}.csv`, csv);
  };

  return (
    <div className="space-y-4">
      {/* Date range & driver filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Calendar className="w-4 h-4 text-white/40" />
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-white/5 border-white/10 text-white w-40" />
        <span className="text-white/30">to</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-white/5 border-white/10 text-white w-40" />
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-white/40 text-xs">Driver:</span>
        <button onClick={() => setDriverFilter("all")} className={`px-2 py-1 rounded text-xs ${driverFilter === "all" ? "bg-white/20 text-white" : "bg-white/5 text-white/40"}`}>All</button>
        {drivers.map(([id, name]) => (
          <button key={id} onClick={() => setDriverFilter(id)} className={`px-2 py-1 rounded text-xs ${driverFilter === id ? "bg-white/20 text-white" : "bg-white/5 text-white/40"}`}>{name}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-white/40 text-center py-12">Loading...</div>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={exportRuns} variant="outline" size="sm" className="gap-2 border-white/10 text-white/60 hover:text-white bg-transparent">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>

          {filteredRuns.length === 0 ? (
            <p className="text-white/40 text-center py-8">No completed runs in this date range.</p>
          ) : (
            <div className="space-y-2">
              {filteredRuns.map((r) => {
                const approval = approvalMap.get(r.id);
                const status = approval?.status || "pending";
                const pay = getPayRate(r.route?.name);
                const youthCount = attendanceCounts[r.id] || 0;
                return (
                  <div key={r.id} className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium">{r.driver?.name}</span>
                          <span className="text-white/30">•</span>
                          <span className="text-white/50 text-sm">{r.route?.name}</span>
                          <span className="text-white/30">•</span>
                          <span className="text-white/50 text-sm capitalize">{r.run_type}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/30">
                          <span>{format(new Date(r.started_at), "MMM d, h:mm a")}</span>
                          <span>{youthCount} youth</span>
                          <span className="text-green-400 font-medium">${pay}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={
                          status === "approved" ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : status === "disputed" ? "bg-red-500/20 text-red-400 border-red-500/30"
                            : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                        }>{status}</Badge>
                        <button onClick={() => handleDeleteRun(r.id)} className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors" title="Delete run">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {status === "disputed" && approval?.notes && (
                      <p className="text-red-400/70 text-xs italic">Note: {approval.notes}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" onClick={() => handleApprove(r.id)} className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1" disabled={status === "approved"}>
                        <CheckCircle className="w-3 h-3" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDispute(r.id)} className="text-xs gap-1" disabled={status === "disputed"}>
                        <XCircle className="w-3 h-3" /> Dispute
                      </Button>
                      {status !== "approved" && (
                        <input
                          placeholder="Dispute note..."
                          value={noteInputs[r.id] || ""}
                          onChange={(e) => setNoteInputs((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          className="flex-1 min-w-[120px] bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder:text-white/30"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Incidents */}
          {incidents.length > 0 && (
            <div className="space-y-2 mt-6">
              <h3 className="text-white/60 text-xs uppercase tracking-widest font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" /> Incidents ({incidents.length})
              </h3>
              {incidents.map((i) => (
                <div key={i.id} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white/30 text-xs">{format(new Date(i.recorded_at), "MMM d, h:mm a")}</span>
                    {i.driver && <span className="text-white/50 text-xs">Driver: {i.driver.name}</span>}
                    {i.youth && <span className="text-white/50 text-xs">Youth: {i.youth.first_name} {i.youth.last_name}</span>}
                  </div>
                  <p className="text-white text-sm">{i.description}</p>
                  <div className="flex justify-end">
                    <button onClick={() => handleDeleteIncident(i.id)} className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors" title="Delete incident">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── TAB 3: PAY ─── */

function PayTab() {
  const { toast } = useToast();
  const periods = useMemo(() => getPayPeriods(), []);
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPayPeriod());
  const [runs, setRuns] = useState<RunWithDetails[]>([]);
  const [approvals, setApprovals] = useState<RunApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [paidDrivers, setPaidDrivers] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    const from = selectedPeriod.start + "T00:00:00";
    const to = selectedPeriod.end + "T23:59:59";

    const [runsRes, approvalsRes] = await Promise.all([
      supabase
        .from("runs")
        .select("id, run_type, status, started_at, closed_at, driver:drivers(id, name), route:routes(id, name)")
        .eq("status", "completed")
        .gte("started_at", from)
        .lte("started_at", to),
      supabase.from("run_approvals").select("id, run_id, status, notes"),
    ]);

    if (runsRes.data) setRuns(runsRes.data as unknown as RunWithDetails[]);
    if (approvalsRes.data) setApprovals(approvalsRes.data as unknown as RunApproval[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedPeriod]);

  const approvalMap = useMemo(() => {
    const m = new Map<string, RunApproval>();
    approvals.forEach((a) => m.set(a.run_id, a));
    return m;
  }, [approvals]);

  const driverSummaries = useMemo(() => {
    const map = new Map<string, {
      name: string; approved: number; approvedPay: number; disputed: number; pending: number; total: number;
      routeBreakdown: Record<string, number>;
    }>();
    runs.forEach((r) => {
      if (!r.driver) return;
      const entry = map.get(r.driver.id) || { name: r.driver.name, approved: 0, approvedPay: 0, disputed: 0, pending: 0, total: 0, routeBreakdown: {} };
      const routeName = r.route?.name || "Unknown";
      entry.routeBreakdown[routeName] = (entry.routeBreakdown[routeName] || 0) + 1;
      const pay = getPayRate(r.route?.name);
      const approval = approvalMap.get(r.id);
      const status = approval?.status || "pending";
      if (status === "approved") { entry.approved++; entry.approvedPay += pay; }
      else if (status === "disputed") { entry.disputed++; }
      else { entry.pending++; }
      entry.total++;
      map.set(r.driver.id, entry);
    });
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [runs, approvalMap]);

  const handleMarkPaid = (driverId: string) => {
    setPaidDrivers((prev) => new Set([...prev, driverId]));
    toast({ title: "Marked as paid" });
  };

  const exportPaySummary = () => {
    const csv = toCsv(
      ["Driver", "Approved Runs", "Amount Owed", "Disputed", "Pending", "Status"],
      driverSummaries.map(([id, s]) => [s.name, String(s.approved), `$${s.approvedPay}`, String(s.disputed), String(s.pending), paidDrivers.has(id) ? "Paid" : "Unpaid"])
    );
    downloadCsv(`pay_summary_${selectedPeriod.start}_${selectedPeriod.end}.csv`, csv);
  };

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-2 flex-wrap">
        {periods.slice(0, 4).map((p) => (
          <button key={p.start} onClick={() => setSelectedPeriod(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedPeriod.start === p.start ? "bg-[#DC2626] text-white" : "bg-white/5 text-white/50 hover:text-white border border-white/10"
          }`}>{p.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-white/40 text-center py-12">Loading...</div>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={exportPaySummary} variant="outline" size="sm" className="gap-2 border-white/10 text-white/60 hover:text-white bg-transparent">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>

          {driverSummaries.length === 0 ? (
            <p className="text-white/40 text-center py-8">No runs in this pay period.</p>
          ) : (
            <div className="space-y-3">
              {driverSummaries.map(([driverId, s]) => (
                <div key={driverId} className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold">{s.name}</h3>
                    <Badge className={paidDrivers.has(driverId) ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>
                      {paidDrivers.has(driverId) ? "Paid" : "Unpaid"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/5 rounded p-2">
                      <p className="text-green-400 text-lg font-bold">{s.approved}</p>
                      <p className="text-white/30 text-[10px]">Approved</p>
                    </div>
                    <div className="bg-white/5 rounded p-2">
                      <p className="text-green-400 text-lg font-bold">${s.approvedPay}</p>
                      <p className="text-white/30 text-[10px]">Amount Owed</p>
                    </div>
                    <div className="bg-white/5 rounded p-2">
                      <p className="text-white text-lg font-bold">{s.total}</p>
                      <p className="text-white/30 text-[10px]">Total Runs</p>
                    </div>
                  </div>
                  {/* Route breakdown */}
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(s.routeBreakdown).map(([route, count]) => (
                      <span key={route} className="bg-white/5 text-white/50 text-[10px] px-2 py-1 rounded">{route}: {count}</span>
                    ))}
                  </div>
                  {s.disputed > 0 && (
                    <div className="flex items-center gap-1 text-red-400 text-xs">
                      <AlertTriangle className="w-3 h-3" /> {s.disputed} disputed run{s.disputed > 1 ? "s" : ""}
                    </div>
                  )}
                  {!paidDrivers.has(driverId) && s.approvedPay > 0 && (
                    <Button size="sm" onClick={() => handleMarkPaid(driverId)} className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1 w-full">
                      <DollarSign className="w-3 h-3" /> Mark as Paid
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
