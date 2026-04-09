import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, CheckCircle, XCircle,
  Download, ChevronLeft, ChevronRight, DollarSign, Trash2, Pencil,
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
function getPayRate(routeName: string | undefined): number { return routeName === "Overflow" ? 25 : 50; }

type PayPeriod = { label: string; start: string; end: string };
function getPayPeriods(): PayPeriod[] {
  const now = new Date(); const periods: PayPeriod[] = [];
  for (let offset = 0; offset < 3; offset++) {
    const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const mid = setDate(month, 15); const last = endOfMonth(month);
    periods.push({ label: `${format(month, "MMM yyyy")} 16th–${format(last, "do")}`, start: format(setDate(month, 16), "yyyy-MM-dd"), end: format(last, "yyyy-MM-dd") });
    periods.push({ label: `${format(month, "MMM yyyy")} 1st–15th`, start: format(month, "yyyy-MM-dd"), end: format(mid, "yyyy-MM-dd") });
  }
  return periods;
}
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
  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-bold text-white">Trips & Pay</h1>
      <Tabs defaultValue="history" className="space-y-4">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="history" className="data-[state=active]:bg-[#DC2626] data-[state=active]:text-white text-white/50">History</TabsTrigger>
          <TabsTrigger value="pay" className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white text-white/50">Pay</TabsTrigger>
        </TabsList>
        <TabsContent value="history"><HistoryCalendarTab /></TabsContent>
        <TabsContent value="pay"><PayTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function HistoryCalendarTab() {
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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const fetchData = async () => {
    setLoading(true);
    const from = format(monthStart, "yyyy-MM-dd") + "T00:00:00";
    const to = format(monthEnd, "yyyy-MM-dd") + "T23:59:59";
    const [runsRes, approvalsRes, attRes, routesRes] = await Promise.all([
      supabase.from("runs").select("id, run_type, status, started_at, closed_at, driver:drivers(id, name), route:routes(id, name)").eq("status", "completed").gte("started_at", from).lte("started_at", to).order("started_at", { ascending: false }),
      supabase.from("run_approvals").select("id, run_id, status, notes"),
      supabase.from("transport_attendance").select("run_id").eq("status", "present").gte("recorded_at", from).lte("recorded_at", to),
      supabase.from("routes").select("id, name"),
    ]);
    if (runsRes.data) setRuns(runsRes.data as unknown as RunWithDetails[]);
    if (approvalsRes.data) setApprovals(approvalsRes.data as unknown as RunApproval[]);
    if (routesRes.data) setRoutes(routesRes.data as unknown as { id: string; name: string }[]);
    const counts: Record<string, number> = {};
    (attRes.data || []).forEach((a: { run_id: string }) => { counts[a.run_id] = (counts[a.run_id] || 0) + 1; });
    setAttendanceCounts(counts);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel("history-calendar")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "run_approvals" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentMonth]);

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
    let totalTrips = 0, approved = 0, pending = 0, totalPay = 0;
    runs.forEach((r) => { totalTrips++; const s = approvalMap.get(r.id)?.status || "pending"; const pay = getPayRate(r.route?.name); if (s === "approved") { approved++; totalPay += pay; } else if (s === "pending") pending++; });
    return { totalTrips, approved, pending, totalPay };
  }, [runs, approvalMap]);

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
    setEditForm({
      route: r.route?.id || "",
      runType: r.run_type,
      date: format(new Date(r.started_at), "yyyy-MM-dd"),
      time: format(new Date(r.started_at), "HH:mm"),
    });
  };
  const handleSaveEdit = async () => {
    if (!editingRunId) return;
    const newStartedAt = new Date(`${editForm.date}T${editForm.time}:00`).toISOString();
    await supabase.from("runs").update({
      route_id: editForm.route,
      run_type: editForm.runType as "pickup" | "dropoff",
      started_at: newStartedAt,
    }).eq("id", editingRunId);
    setEditingRunId(null);
    toast({ title: "Trip updated" }); fetchData();
  };
  const exportMonth = () => {
    const csv = toCsv(["Date","Type","Driver","Route","Status","Pay","Youth Count","Approval"], runs.map((r) => [format(new Date(r.started_at), "MM/dd/yyyy"), r.run_type, r.driver?.name || "", r.route?.name || "", r.status, `$${getPayRate(r.route?.name)}`, String(attendanceCounts[r.id] || 0), approvalMap.get(r.id)?.status || "pending"]));
    downloadCsv(`trips_${format(currentMonth, "yyyy-MM")}.csv`, csv);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="text-white font-bold text-lg min-w-[160px] text-center">{format(currentMonth, "MMMM yyyy")}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <Button onClick={exportMonth} variant="outline" size="sm" className="gap-2 border-white/10 text-white/60 hover:text-white bg-transparent"><Download className="w-4 h-4" /> Export CSV</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[{ label: "Total Trips", value: monthStats.totalTrips, color: "text-white" }, { label: "Approved", value: monthStats.approved, color: "text-green-400" }, { label: "Pending", value: monthStats.pending, color: "text-yellow-400" }, { label: "Pay Owed", value: `$${monthStats.totalPay}`, color: "text-green-400" }].map((s) => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-white/40 text-[10px] uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
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

      <Dialog open={panelOpen} onOpenChange={(open) => { setPanelOpen(open); if (!open) { setEditingRunId(null); setDeleteConfirmId(null); } }}>
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
                      <div className="flex items-center gap-3 text-xs text-white/30"><span>{format(new Date(r.started_at), "h:mm a")}</span><span>{youthCount} youth</span><span className="text-green-400 font-medium">${pay}</span></div>
                    </div>
                    <Badge className={status === "approved" ? "bg-green-500/20 text-green-400 border-green-500/30" : status === "disputed" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>{status}</Badge>
                  </div>
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
    </div>
  );
}
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
    const from = selectedPeriod.start + "T00:00:00"; const to = selectedPeriod.end + "T23:59:59";
    const [runsRes, approvalsRes] = await Promise.all([
      supabase.from("runs").select("id, run_type, status, started_at, closed_at, driver:drivers(id, name), route:routes(id, name)").eq("status", "completed").gte("started_at", from).lte("started_at", to),
      supabase.from("run_approvals").select("id, run_id, status, notes"),
    ]);
    if (runsRes.data) setRuns(runsRes.data as unknown as RunWithDetails[]);
    if (approvalsRes.data) setApprovals(approvalsRes.data as unknown as RunApproval[]);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, [selectedPeriod]);

  const approvalMap = useMemo(() => { const m = new Map<string, RunApproval>(); approvals.forEach((a) => m.set(a.run_id, a)); return m; }, [approvals]);
  const driverSummaries = useMemo(() => {
    const map = new Map<string, { name: string; approved: number; approvedPay: number; disputed: number; pending: number; total: number; routeBreakdown: Record<string, number> }>();
    runs.forEach((r) => {
      if (!r.driver) return;
      const entry = map.get(r.driver.id) || { name: r.driver.name, approved: 0, approvedPay: 0, disputed: 0, pending: 0, total: 0, routeBreakdown: {} };
      const routeName = r.route?.name || "Unknown";
      entry.routeBreakdown[routeName] = (entry.routeBreakdown[routeName] || 0) + 1;
      const pay = getPayRate(r.route?.name); const approval = approvalMap.get(r.id); const status = approval?.status || "pending";
      if (status === "approved") { entry.approved++; entry.approvedPay += pay; } else if (status === "disputed") entry.disputed++; else entry.pending++;
      entry.total++; map.set(r.driver.id, entry);
    });
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [runs, approvalMap]);

  const handleMarkPaid = (driverId: string) => { setPaidDrivers((prev) => new Set([...prev, driverId])); toast({ title: "Marked as paid" }); };
  const exportPaySummary = () => {
    const csv = toCsv(["Driver","Approved Runs","Amount Owed","Disputed","Pending","Status"], driverSummaries.map(([id, s]) => [s.name, String(s.approved), `$${s.approvedPay}`, String(s.disputed), String(s.pending), paidDrivers.has(id) ? "Paid" : "Unpaid"]));
    downloadCsv(`pay_summary_${selectedPeriod.start}_${selectedPeriod.end}.csv`, csv);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {periods.slice(0, 4).map((p) => (
          <button key={p.start} onClick={() => setSelectedPeriod(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedPeriod.start === p.start ? "bg-[#DC2626] text-white" : "bg-white/5 text-white/50 hover:text-white border border-white/10"}`}>{p.label}</button>
        ))}
      </div>
      {loading ? <div className="text-white/40 text-center py-12">Loading...</div> : (
        <>
          <div className="flex justify-end">
            <Button onClick={exportPaySummary} variant="outline" size="sm" className="gap-2 border-white/10 text-white/60 hover:text-white bg-transparent"><Download className="w-4 h-4" /> Export CSV</Button>
          </div>
          {driverSummaries.length === 0 ? <p className="text-white/40 text-center py-8">No runs in this pay period.</p> : (
            <div className="space-y-3">
              {driverSummaries.map(([driverId, s]) => (
                <div key={driverId} className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold">{s.name}</h3>
                    <Badge className={paidDrivers.has(driverId) ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>{paidDrivers.has(driverId) ? "Paid" : "Unpaid"}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/5 rounded p-2"><p className="text-green-400 text-lg font-bold">{s.approved}</p><p className="text-white/30 text-[10px]">Approved</p></div>
                    <div className="bg-white/5 rounded p-2"><p className="text-green-400 text-lg font-bold">${s.approvedPay}</p><p className="text-white/30 text-[10px]">Amount Owed</p></div>
                    <div className="bg-white/5 rounded p-2"><p className="text-white text-lg font-bold">{s.total}</p><p className="text-white/30 text-[10px]">Total Runs</p></div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(s.routeBreakdown).map(([route, count]) => (<span key={route} className="bg-white/5 text-white/50 text-[10px] px-2 py-1 rounded">{route}: {count}</span>))}
                  </div>
                  {s.disputed > 0 && <div className="flex items-center gap-1 text-red-400 text-xs"><AlertTriangle className="w-3 h-3" /> {s.disputed} disputed run{s.disputed > 1 ? "s" : ""}</div>}
                  {!paidDrivers.has(driverId) && s.approvedPay > 0 && (
                    <Button size="sm" onClick={() => handleMarkPaid(driverId)} className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1 w-full"><DollarSign className="w-3 h-3" /> Mark as Paid</Button>
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
