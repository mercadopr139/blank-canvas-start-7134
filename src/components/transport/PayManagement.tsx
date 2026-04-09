import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Download, CheckCircle, XCircle, DollarSign, AlertTriangle } from "lucide-react";
import { format, startOfMonth, endOfMonth, setDate } from "date-fns";

interface RunWithDetails {
  id: string;
  run_type: string;
  status: string;
  started_at: string;
  closed_at: string | null;
  driver: { id: string; name: string } | null;
  route: { name: string } | null;
}

interface RunApproval {
  id: string;
  run_id: string;
  status: string;
  notes: string | null;
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

function getPayRate(routeName: string | undefined): number {
  if (routeName === "Overflow") return 25;
  return 50;
}

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

export default function PayManagement() {
  const { toast } = useToast();
  const periods = useMemo(() => getPayPeriods(), []);
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]);
  const [runs, setRuns] = useState<RunWithDetails[]>([]);
  const [approvals, setApprovals] = useState<RunApproval[]>([]);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [paidDrivers, setPaidDrivers] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    const from = selectedPeriod.start + "T00:00:00";
    const to = selectedPeriod.end + "T23:59:59";

    const [runsRes, approvalsRes, attRes] = await Promise.all([
      supabase
        .from("runs")
        .select("id, run_type, status, started_at, closed_at, driver:drivers(id, name), route:routes(name)")
        .eq("status", "completed")
        .gte("started_at", from)
        .lte("started_at", to)
        .order("started_at", { ascending: false }),
      supabase.from("run_approvals").select("id, run_id, status, notes"),
      supabase
        .from("transport_attendance")
        .select("run_id")
        .eq("status", "present")
        .gte("recorded_at", from)
        .lte("recorded_at", to),
    ]);

    if (runsRes.data) setRuns(runsRes.data as unknown as RunWithDetails[]);
    if (approvalsRes.data) setApprovals(approvalsRes.data as unknown as RunApproval[]);

    // Count youth per run
    const counts: Record<string, number> = {};
    (attRes.data || []).forEach((a: any) => {
      counts[a.run_id] = (counts[a.run_id] || 0) + 1;
    });
    setAttendanceCounts(counts);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  const approvalMap = useMemo(() => {
    const m = new Map<string, RunApproval>();
    approvals.forEach((a) => m.set(a.run_id, a));
    return m;
  }, [approvals]);

  const drivers = useMemo(() => {
    const set = new Map<string, string>();
    runs.forEach((r) => {
      if (r.driver) set.set(r.driver.id, r.driver.name);
    });
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

  // Pay summary per driver
  const driverSummaries = useMemo(() => {
    const map = new Map<string, { name: string; approved: number; approvedPay: number; disputed: number; pending: number; total: number }>();
    runs.forEach((r) => {
      if (!r.driver) return;
      const entry = map.get(r.driver.id) || { name: r.driver.name, approved: 0, approvedPay: 0, disputed: 0, pending: 0, total: 0 };
      const pay = getPayRate(r.route?.name);
      const approval = approvalMap.get(r.id);
      const status = approval?.status || "pending";
      if (status === "approved") {
        entry.approved++;
        entry.approvedPay += pay;
      } else if (status === "disputed") {
        entry.disputed++;
      } else {
        entry.pending++;
      }
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
      driverSummaries.map(([id, s]) => [
        s.name,
        String(s.approved),
        `$${s.approvedPay}`,
        String(s.disputed),
        String(s.pending),
        paidDrivers.has(id) ? "Paid" : "Unpaid",
      ])
    );
    downloadCsv(`pay_summary_${selectedPeriod.start}_${selectedPeriod.end}.csv`, csv);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <DollarSign className="w-5 h-5 text-green-400" />
        <h2 className="text-lg font-bold text-white">Pay Management</h2>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 flex-wrap">
        {periods.slice(0, 4).map((p) => (
          <button
            key={p.start}
            onClick={() => setSelectedPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedPeriod.start === p.start
                ? "bg-[#DC2626] text-white"
                : "bg-white/5 text-white/50 hover:text-white border border-white/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-white/40 text-center py-12">Loading...</div>
      ) : (
        <Tabs defaultValue="review" className="space-y-4">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="review" className="data-[state=active]:bg-[#DC2626] data-[state=active]:text-white text-white/50">
              Run Review
            </TabsTrigger>
            <TabsTrigger value="summary" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-white/50">
              Pay Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review" className="space-y-3">
            {/* Driver filter */}
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-white/40 text-xs">Filter:</span>
              <button
                onClick={() => setDriverFilter("all")}
                className={`px-2 py-1 rounded text-xs ${driverFilter === "all" ? "bg-white/20 text-white" : "bg-white/5 text-white/40"}`}
              >
                All
              </button>
              {drivers.map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => setDriverFilter(id)}
                  className={`px-2 py-1 rounded text-xs ${driverFilter === id ? "bg-white/20 text-white" : "bg-white/5 text-white/40"}`}
                >
                  {name}
                </button>
              ))}
            </div>

            {filteredRuns.length === 0 ? (
              <p className="text-white/40 text-center py-8">No completed runs in this pay period.</p>
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
                          <div className="flex items-center gap-2">
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
                        <Badge
                          className={
                            status === "approved"
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : status === "disputed"
                              ? "bg-red-500/20 text-red-400 border-red-500/30"
                              : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                          }
                        >
                          {status}
                        </Badge>
                      </div>
                      {status === "disputed" && approval?.notes && (
                        <p className="text-red-400/70 text-xs italic">Note: {approval.notes}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(r.id)}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1"
                          disabled={status === "approved"}
                        >
                          <CheckCircle className="w-3 h-3" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDispute(r.id)}
                          className="text-xs gap-1"
                          disabled={status === "disputed"}
                        >
                          <XCircle className="w-3 h-3" /> Dispute
                        </Button>
                        {status !== "approved" && (
                          <input
                            placeholder="Dispute note..."
                            value={noteInputs[r.id] || ""}
                            onChange={(e) => setNoteInputs((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder:text-white/30"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="summary" className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={exportPaySummary} variant="outline" size="sm" className="gap-2 border-white/10 text-white/60 hover:text-white">
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            </div>

            {driverSummaries.length === 0 ? (
              <p className="text-white/40 text-center py-8">No runs in this pay period.</p>
            ) : (
              <div className="space-y-3">
                {driverSummaries.map(([driverId, s]) => (
                  <div key={driverId} className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-bold">{s.name}</h3>
                      <Badge className={paidDrivers.has(driverId) ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>
                        {paidDrivers.has(driverId) ? "Paid" : "Unpaid"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white/5 rounded p-2">
                        <p className="text-green-400 text-lg font-bold">{s.approved}</p>
                        <p className="text-white/30 text-[10px]">Approved Runs</p>
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
                    {s.disputed > 0 && (
                      <div className="flex items-center gap-1 text-red-400 text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        {s.disputed} disputed run{s.disputed > 1 ? "s" : ""}
                      </div>
                    )}
                    {!paidDrivers.has(driverId) && s.approvedPay > 0 && (
                      <Button
                        size="sm"
                        onClick={() => handleMarkPaid(driverId)}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1 w-full"
                      >
                        <DollarSign className="w-3 h-3" /> Mark as Paid
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
