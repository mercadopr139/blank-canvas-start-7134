import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, ChevronRight, Star, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface DupeRow {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string;
  registered_on: string; // YYYY-MM-DD
  approved_for_attendance: boolean;
  attendance_count: number;
  first_attendance: string | null;
  last_attendance: string | null;
}

interface MergeResult {
  attendance_moved: number;
  attendance_dropped: number;
  registrations_deleted: number;
}

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MMM d, yyyy"); } catch { return iso; }
};

// Sort key for keeper recommendation: most attendance first, then approved,
// then oldest registration. Matches the explanation given in the planning
// step ("most attendance → approved → oldest").
const keeperRank = (a: DupeRow, b: DupeRow): number => {
  if (b.attendance_count !== a.attendance_count) return b.attendance_count - a.attendance_count;
  if (a.approved_for_attendance !== b.approved_for_attendance) return a.approved_for_attendance ? -1 : 1;
  return a.registered_on.localeCompare(b.registered_on);
};

export default function AdminDuplicateRegistrations() {
  const queryClient = useQueryClient();
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  // Per-group user overrides for which registration is the keeper. Falls
  // back to the recommendation when null.
  const [keeperOverrides, setKeeperOverrides] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [merging, setMerging] = useState(false);
  const [lastResult, setLastResult] = useState<{ name: string; result: MergeResult } | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-duplicate-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_duplicate_registrations");
      if (error) throw error;
      return (data || []) as DupeRow[];
    },
  });

  // Group rows by normalized (first_name, last_name). Each group is one kid.
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; firstName: string; lastName: string; rows: DupeRow[] }>();
    rows.forEach((r) => {
      const key = `${r.child_first_name.trim().toLowerCase()}|${r.child_last_name.trim().toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, { key, firstName: r.child_first_name.trim(), lastName: r.child_last_name.trim(), rows: [] });
      }
      map.get(key)!.rows.push(r);
    });
    // Sort each group's rows by keeper rank — top of list = recommended keeper.
    const arr = [...map.values()];
    arr.forEach((g) => g.rows.sort(keeperRank));
    // Sort groups by impact (rows with attendance first, then by name).
    arr.sort((a, b) => {
      const aTotal = a.rows.reduce((s, r) => s + r.attendance_count, 0);
      const bTotal = b.rows.reduce((s, r) => s + r.attendance_count, 0);
      if (bTotal !== aTotal) return bTotal - aTotal;
      return a.lastName.localeCompare(b.lastName);
    });
    return arr;
  }, [rows]);

  const activeGroup = useMemo(
    () => groups.find((g) => g.key === activeGroupKey) ?? null,
    [groups, activeGroupKey]
  );

  // Resolved keeper for the active group — user override or top of list.
  const activeKeeperId = activeGroup
    ? keeperOverrides[activeGroup.key] || activeGroup.rows[0]?.id
    : null;

  const handleMerge = async () => {
    if (!activeGroup || !activeKeeperId) return;
    const dupeIds = activeGroup.rows.filter((r) => r.id !== activeKeeperId).map((r) => r.id);
    if (dupeIds.length === 0) return;
    setMerging(true);
    const { data, error } = await supabase.rpc("admin_merge_youth_registrations", {
      _keeper_id: activeKeeperId,
      _dupe_ids: dupeIds,
    });
    setMerging(false);
    setConfirmOpen(false);
    if (error) {
      toast.error(error.message || "Merge failed.");
      return;
    }
    const result = (data as MergeResult[] | null)?.[0] ?? null;
    const name = `${activeGroup.firstName} ${activeGroup.lastName}`;
    if (result) {
      setLastResult({ name, result });
      toast.success(
        `${name}: ${result.attendance_moved} record(s) moved, ${result.attendance_dropped} dropped, ${result.registrations_deleted} dupe(s) deleted.`
      );
    } else {
      toast.success(`${name}: merge complete.`);
    }
    setActiveGroupKey(null);
    setKeeperOverrides((prev) => {
      const next = { ...prev };
      delete next[activeGroup.key];
      return next;
    });
    queryClient.invalidateQueries({ queryKey: ["admin-duplicate-registrations"] });
    refetch();
  };

  const totalKids = groups.length;
  const totalDupeRows = rows.length;
  const totalAttendanceAtRisk = rows.reduce((s, r) => s + r.attendance_count, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <Copy className="w-5 h-5 text-purple-400" /> Duplicate Registrations
          </h1>
          <p className="text-white/50 text-sm mt-0.5">
            Find youth registered more than once. Merge safely so their attendance history is preserved.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="border-white/15 text-white/70 bg-transparent hover:bg-white/10"
        >
          Refresh
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-purple-400 tabular-nums">{totalKids}</p>
          <p className="text-white/40 text-[10px] uppercase tracking-wider mt-1">Youth with Dupes</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white tabular-nums">{totalDupeRows}</p>
          <p className="text-white/40 text-[10px] uppercase tracking-wider mt-1">Duplicate Rows</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-emerald-300 tabular-nums">{totalAttendanceAtRisk}</p>
          <p className="text-white/40 text-[10px] uppercase tracking-wider mt-1">Attendance Preserved</p>
        </div>
      </div>

      {/* Groups list */}
      {isLoading ? (
        <p className="text-center text-white/40 py-10">Loading…</p>
      ) : groups.length === 0 ? (
        <Card className="bg-emerald-500/10 border-emerald-400/30 text-white">
          <CardContent className="p-6 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0" />
            <p className="text-sm">
              No duplicate registrations found. Everyone has a single registration row.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white/[0.03] border-white/10 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-white/60">
              Youth with Multiple Registrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {groups.map((g) => {
              const total = g.rows.reduce((s, r) => s + r.attendance_count, 0);
              const program = g.rows[0]?.child_boxing_program;
              return (
                <button
                  key={g.key}
                  onClick={() => setActiveGroupKey(g.key)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.07] hover:border-purple-400/40 transition text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold text-sm truncate flex items-center gap-2">
                      {g.firstName} {g.lastName}
                      <Badge className="bg-purple-500/15 text-purple-300 border-purple-400/30 text-[10px]">
                        {g.rows.length} registrations
                      </Badge>
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {program} · {total} attendance record{total === 1 ? "" : "s"} across all rows
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Last result snapshot */}
      {lastResult && (
        <Card className="bg-emerald-500/[0.06] border-emerald-400/30 text-white">
          <CardContent className="p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">
                {lastResult.name}: merge complete.
              </p>
              <p className="text-white/60 text-xs mt-0.5">
                {lastResult.result.attendance_moved} attendance record(s) moved to the keeper ·{" "}
                {lastResult.result.attendance_dropped} duplicate record(s) dropped ·{" "}
                {lastResult.result.registrations_deleted} duplicate registration(s) deleted.
              </p>
            </div>
            <button
              onClick={() => setLastResult(null)}
              className="text-white/40 hover:text-white/70 ml-auto shrink-0"
              aria-label="Dismiss"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Drill-in dialog */}
      <Dialog open={!!activeGroup} onOpenChange={(open) => { if (!open) setActiveGroupKey(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {activeGroup ? `${activeGroup.firstName} ${activeGroup.lastName}` : ""}
            </DialogTitle>
          </DialogHeader>
          {activeGroup && (
            <div className="space-y-3">
              <p className="text-xs text-white/50">
                Pick which registration to keep. Attendance from the others gets re-pointed to the keeper before the dupes are deleted. The top row is recommended (most attendance, approved, oldest).
              </p>

              <div className="space-y-2">
                {activeGroup.rows.map((r, idx) => {
                  const isKeeper = activeKeeperId === r.id;
                  const isRecommended = idx === 0;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setKeeperOverrides((prev) => ({ ...prev, [activeGroup.key]: r.id }))}
                      className={`w-full text-left p-3 rounded-lg border transition ${
                        isKeeper
                          ? "bg-purple-500/10 border-purple-400/50"
                          : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                            Registration ID
                          </p>
                          <p className="text-xs font-mono text-white/80 truncate">{r.id}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px]">
                            <Badge className="bg-white/[0.06] border-white/10 text-white/70">
                              {r.child_boxing_program}
                            </Badge>
                            <Badge className="bg-white/[0.06] border-white/10 text-white/70">
                              Created {formatDate(r.registered_on)}
                            </Badge>
                            <Badge className={r.approved_for_attendance ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30" : "bg-yellow-500/15 text-yellow-300 border-yellow-400/30"}>
                              {r.approved_for_attendance ? "Approved" : "Not approved"}
                            </Badge>
                          </div>
                          <p className="text-xs text-white/60 mt-2">
                            <span className="font-bold text-emerald-300 tabular-nums">{r.attendance_count}</span>{" "}
                            attendance record{r.attendance_count === 1 ? "" : "s"}
                            {r.first_attendance && (
                              <span className="text-white/40">
                                {" "}· {formatDate(r.first_attendance)} → {formatDate(r.last_attendance)}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {isKeeper && (
                            <span className="flex items-center gap-1 text-xs font-bold text-purple-300">
                              <Star className="w-3.5 h-3.5 fill-purple-300" /> Keeper
                            </span>
                          )}
                          {!isKeeper && isRecommended && (
                            <span className="text-[10px] text-white/40 italic">Recommended</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 justify-end pt-3 mt-2 border-t border-white/10">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-white"
                  onClick={() => setActiveGroupKey(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                >
                  Preview Merge
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!open) setConfirmOpen(false); }}>
        <DialogContent className="bg-zinc-900 border-red-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Merge and Delete Dupes?
            </DialogTitle>
          </DialogHeader>
          {activeGroup && (() => {
            const keeperRow = activeGroup.rows.find((r) => r.id === activeKeeperId);
            const dupeRows = activeGroup.rows.filter((r) => r.id !== activeKeeperId);
            const movedEstimate = dupeRows.reduce((s, r) => s + r.attendance_count, 0);
            const keeperCount = keeperRow?.attendance_count || 0;
            return (
              <div className="space-y-3">
                <p className="text-sm text-white/80">
                  This will merge <span className="font-bold text-white">{activeGroup.firstName} {activeGroup.lastName}</span> into a single registration.
                </p>
                <div className="rounded-lg bg-red-500/[0.08] border border-red-500/30 px-3 py-2.5 text-xs text-white/70 space-y-1">
                  <p className="font-bold text-red-300 mb-1">What happens:</p>
                  <ul className="space-y-0.5 pl-1">
                    <li>• Up to {movedEstimate} attendance record{movedEstimate === 1 ? "" : "s"} moved from {dupeRows.length} duplicate{dupeRows.length === 1 ? "" : "s"} → onto the keeper</li>
                    <li>• Any record that would collide with the keeper on the same date is dropped (it's a true duplicate)</li>
                    <li>• {dupeRows.length} duplicate registration{dupeRows.length === 1 ? "" : "s"} deleted</li>
                    <li>• Keeper ends with between {keeperCount} and {keeperCount + movedEstimate} attendance records</li>
                  </ul>
                </div>
                <p className="text-xs text-yellow-200/80">
                  This runs as a single transaction and <span className="font-bold">cannot be undone</span>.
                </p>
              </div>
            );
          })()}
          <div className="flex gap-2 justify-end pt-3 mt-2 border-t border-white/10">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-white"
              onClick={() => setConfirmOpen(false)}
              disabled={merging}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleMerge}
              disabled={merging}
            >
              {merging ? "Merging…" : "Merge and Delete Dupes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
