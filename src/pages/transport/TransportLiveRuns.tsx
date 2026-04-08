import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Radio, AlertTriangle, CheckCircle2, Clock, User, MapPin } from "lucide-react";

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

export default function TransportLiveRuns() {
  const [runs, setRuns] = useState<RunWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = async () => {
    const { data, error } = await supabase
      .from("runs")
      .select(`
        id, run_type, status, started_at, closed_at,
        driver:drivers(id, name),
        route:routes(id, name),
        attendance:transport_attendance(
          id, status,
          youth:youth_profiles(id, first_name, last_name, pickup_zone)
        )
      `)
      .order("started_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      // Transform data to handle the join result types
      const transformed = (data as unknown as RunWithDetails[]);
      setRuns(transformed);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRuns();

    // Realtime subscription
    const channel = supabase
      .channel("live-runs")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, () => fetchRuns())
      .on("postgres_changes", { event: "*", schema: "public", table: "transport_attendance" }, () => fetchRuns())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const activeRuns = runs.filter((r) => r.status === "in_progress");
  const completedRuns = runs.filter((r) => r.status === "completed");

  // Check if any kid was picked up but not dropped off (exists in a pickup run but not in a matching dropoff)
  const getPickedUpNotDropped = () => {
    const pickedUp = new Set<string>();
    const droppedOff = new Set<string>();
    runs.forEach((r) => {
      r.attendance.forEach((a) => {
        if (a.youth && a.status === "present") {
          if (r.run_type === "pickup") pickedUp.add(a.youth.id);
          if (r.run_type === "dropoff") droppedOff.add(a.youth.id);
        }
      });
    });
    return [...pickedUp].filter((id) => !droppedOff.has(id));
  };

  const flaggedYouth = getPickedUpNotDropped();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Radio className="w-6 h-6 text-green-400" />
        <h1 className="text-xl font-bold text-white">Live Runs</h1>
        {activeRuns.length > 0 && (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 animate-pulse">
            {activeRuns.length} Active
          </Badge>
        )}
      </div>

      {flaggedYouth.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-300 font-medium text-sm">
              {flaggedYouth.length} youth picked up but not yet dropped off
            </p>
            <p className="text-yellow-300/60 text-xs mt-0.5">
              These youth appeared in a pickup run but have no matching dropoff record today.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-white/40 text-center py-12">Loading...</div>
      ) : runs.length === 0 ? (
        <div className="text-white/40 text-center py-12">No runs have been started yet.</div>
      ) : (
        <div className="space-y-6">
          {activeRuns.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-white/60 text-xs uppercase tracking-widest font-semibold">
                In Progress
              </h2>
              {activeRuns.map((run) => (
                <RunCard key={run.id} run={run} flaggedYouth={flaggedYouth} />
              ))}
            </div>
          )}

          {completedRuns.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-white/60 text-xs uppercase tracking-widest font-semibold">
                Completed Today
              </h2>
              {completedRuns.map((run) => (
                <RunCard key={run.id} run={run} flaggedYouth={flaggedYouth} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RunCard({ run, flaggedYouth }: { run: RunWithDetails; flaggedYouth: string[] }) {
  const isActive = run.status === "in_progress";
  const driverName = run.driver?.name || "Unknown";
  const routeName = run.route?.name || "Unknown";

  return (
    <div
      className={`border rounded-xl p-4 space-y-3 ${
        isActive ? "bg-green-500/5 border-green-500/20" : "bg-white/5 border-white/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isActive ? (
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-white/30" />
          )}
          <span className="text-white font-medium capitalize">{run.run_type}</span>
          <Badge variant="outline" className="text-white/50 border-white/20 text-[10px]">
            {routeName}
          </Badge>
        </div>
        <span className="text-white/30 text-xs flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(run.started_at).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>

      <div className="flex items-center gap-2 text-white/50 text-sm">
        <User className="w-3.5 h-3.5" />
        {driverName}
      </div>

      {run.attendance.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {run.attendance.map((a) => {
            const isFlagged = a.youth && flaggedYouth.includes(a.youth.id);
            return (
              <div
                key={a.id}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs ${
                  a.status === "present"
                    ? isFlagged
                      ? "bg-yellow-500/10 text-yellow-300"
                      : "bg-green-500/10 text-green-300"
                    : "bg-red-500/10 text-red-300"
                }`}
              >
                {isFlagged && <AlertTriangle className="w-3 h-3" />}
                <MapPin className="w-3 h-3" />
                <span className="truncate">
                  {a.youth ? `${a.youth.first_name} ${a.youth.last_name[0]}.` : "Unknown"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {run.attendance.length === 0 && (
        <p className="text-white/30 text-xs">No attendance recorded yet</p>
      )}
    </div>
  );
}
