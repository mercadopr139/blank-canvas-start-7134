import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FileBarChart, Download, Calendar, AlertTriangle, Trash2, DollarSign } from "lucide-react";
import { format, subDays } from "date-fns";
import PayManagement from "@/components/transport/PayManagement";

interface RunRow {
  id: string;
  run_type: string;
  status: string;
  started_at: string;
  closed_at: string | null;
  driver: { name: string } | null;
  route: { name: string } | null;
}

interface AttendanceRow {
  id: string;
  status: string;
  recorded_at: string;
  run: { id: string; run_type: string; started_at: string } | null;
  youth: { id: string; first_name: string; last_name: string } | null;
}

interface IncidentRow {
  id: string;
  description: string;
  recorded_at: string;
  driver: { name: string } | null;
  youth: { first_name: string; last_name: string } | null;
  run: { run_type: string } | null;
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

export default function TransportReports() {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDeleteRun = async (id: string) => {
    if (!confirm("Delete this run and its attendance records?")) return;
    setDeleting(id);
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

  const fetchData = async () => {
    setLoading(true);
    const from = dateFrom + "T00:00:00";
    const to = dateTo + "T23:59:59";

    const [runsRes, attRes, incRes] = await Promise.all([
      supabase
        .from("runs")
        .select("id, run_type, status, started_at, closed_at, driver:drivers(name), route:routes(name)")
        .gte("started_at", from)
        .lte("started_at", to)
        .order("started_at", { ascending: false }),
      supabase
        .from("transport_attendance")
        .select("id, status, recorded_at, run:runs(id, run_type, started_at), youth:youth_profiles(id, first_name, last_name)")
        .gte("recorded_at", from)
        .lte("recorded_at", to)
        .order("recorded_at", { ascending: false }),
      supabase
        .from("incidents")
        .select("id, description, recorded_at, driver:drivers(name), youth:youth_profiles(first_name, last_name), run:runs(run_type)")
        .gte("recorded_at", from)
        .lte("recorded_at", to)
        .order("recorded_at", { ascending: false }),
    ]);

    if (runsRes.data) setRuns(runsRes.data as unknown as RunRow[]);
    if (attRes.data) setAttendance(attRes.data as unknown as AttendanceRow[]);
    if (incRes.data) setIncidents(incRes.data as unknown as IncidentRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo]);

  // Weekly attendance by youth
  const weeklyAttendance = useMemo(() => {
    const map = new Map<string, { name: string; present: number; noShow: number }>();
    attendance.forEach((a) => {
      if (!a.youth) return;
      const key = a.youth.id;
      const entry = map.get(key) || { name: `${a.youth.first_name} ${a.youth.last_name}`, present: 0, noShow: 0 };
      if (a.status === "present") entry.present++;
      else entry.noShow++;
      map.set(key, entry);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [attendance]);

  const exportRuns = () => {
    const csv = toCsv(
      ["Date", "Type", "Driver", "Route", "Status", "Started", "Closed"],
      runs.map((r) => [
        format(new Date(r.started_at), "MM/dd/yyyy"),
        r.run_type,
        r.driver?.name || "",
        r.route?.name || "",
        r.status,
        format(new Date(r.started_at), "h:mm a"),
        r.closed_at ? format(new Date(r.closed_at), "h:mm a") : "",
      ])
    );
    downloadCsv(`runs_${dateFrom}_${dateTo}.csv`, csv);
  };

  const exportAttendance = () => {
    const csv = toCsv(
      ["Youth", "Present", "No Show", "Total"],
      weeklyAttendance.map((a) => [a.name, String(a.present), String(a.noShow), String(a.present + a.noShow)])
    );
    downloadCsv(`attendance_${dateFrom}_${dateTo}.csv`, csv);
  };

  const exportIncidents = () => {
    const csv = toCsv(
      ["Date", "Driver", "Youth", "Run Type", "Description"],
      incidents.map((i) => [
        format(new Date(i.recorded_at), "MM/dd/yyyy h:mm a"),
        i.driver?.name || "",
        i.youth ? `${i.youth.first_name} ${i.youth.last_name}` : "",
        i.run?.run_type || "",
        i.description,
      ])
    );
    downloadCsv(`incidents_${dateFrom}_${dateTo}.csv`, csv);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <FileBarChart className="w-6 h-6 text-[#8B5CF6]" />
        <h1 className="text-xl font-bold text-white">Reports</h1>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-white/40" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-white/5 border-white/10 text-white w-40"
          />
          <span className="text-white/30">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-white/5 border-white/10 text-white w-40"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-white/40 text-center py-12">Loading...</div>
      ) : (
        <Tabs defaultValue="runs" className="space-y-4">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="runs" className="data-[state=active]:bg-[#DC2626] data-[state=active]:text-white text-white/50">
              Runs ({runs.length})
            </TabsTrigger>
            <TabsTrigger value="attendance" className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white text-white/50">
              Attendance
            </TabsTrigger>
            <TabsTrigger value="incidents" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white text-white/50">
              Incidents ({incidents.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="runs" className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={exportRuns} variant="outline" size="sm" className="gap-2 border-white/10 text-white/60 hover:text-white">
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            </div>
            {runs.length === 0 ? (
              <p className="text-white/40 text-center py-8">No runs in this date range.</p>
            ) : (
              <div className="space-y-2">
                {runs.map((r) => (
                  <div key={r.id} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-white font-medium capitalize">{r.run_type}</span>
                      <span className="text-white/30 mx-2">•</span>
                      <span className="text-white/50 text-sm">{r.driver?.name || "Unknown"}</span>
                      <span className="text-white/30 mx-2">•</span>
                      <span className="text-white/40 text-sm">{r.route?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/30 text-xs">
                        {format(new Date(r.started_at), "MMM d, h:mm a")}
                      </span>
                      <Badge
                        className={
                          r.status === "completed"
                            ? "bg-green-500/20 text-green-400 border-green-500/30 text-[10px]"
                            : "bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]"
                        }
                      >
                        {r.status}
                      </Badge>
                      <button
                        onClick={() => handleDeleteRun(r.id)}
                        className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                        title="Delete run"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="attendance" className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={exportAttendance} variant="outline" size="sm" className="gap-2 border-white/10 text-white/60 hover:text-white">
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            </div>
            {weeklyAttendance.length === 0 ? (
              <p className="text-white/40 text-center py-8">No attendance records in this date range.</p>
            ) : (
              <div className="space-y-2">
                {weeklyAttendance.map((a) => (
                  <div key={a.name} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-center justify-between">
                    <span className="text-white font-medium">{a.name}</span>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                        {a.present} present
                      </Badge>
                      {a.noShow > 0 && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                          {a.noShow} no-show
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="incidents" className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={exportIncidents} variant="outline" size="sm" className="gap-2 border-white/10 text-white/60 hover:text-white">
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            </div>
            {incidents.length === 0 ? (
              <p className="text-white/40 text-center py-8">No incidents reported in this date range.</p>
            ) : (
              <div className="space-y-2">
                {incidents.map((i) => (
                  <div key={i.id} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span className="text-white/30 text-xs">
                        {format(new Date(i.recorded_at), "MMM d, h:mm a")}
                      </span>
                      {i.driver && <span className="text-white/50 text-xs">Driver: {i.driver.name}</span>}
                      {i.youth && (
                        <span className="text-white/50 text-xs">
                          Youth: {i.youth.first_name} {i.youth.last_name}
                        </span>
                      )}
                    </div>
                    <p className="text-white text-sm">{i.description}</p>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleDeleteIncident(i.id)}
                        className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                        title="Delete incident"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
