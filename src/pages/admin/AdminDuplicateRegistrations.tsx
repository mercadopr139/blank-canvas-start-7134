import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Copy, ChevronRight, Star, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface DupeRow {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string;
  child_date_of_birth: string | null;
  parent_first_name: string | null;
  parent_last_name: string | null;
  registered_on: string; // YYYY-MM-DD
  approved_for_attendance: boolean;
  attendance_count: number;
  first_attendance: string | null;
  last_attendance: string | null;
  dup_key: string;
  // 'strong'  = two rows share a birthday (high confidence).
  // 'possible' = same first+last name but the birthday differs/is missing —
  //              likely the same kid with a mistyped DOB, but verify first.
  match_type?: "strong" | "possible";
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

  // Groups an admin has marked "not a duplicate" (e.g. twins). Keyed by the
  // sorted set of registration ids in the group.
  const { data: dismissals = [], refetch: refetchDismissals } = useQuery({
    queryKey: ["duplicate-dismissals"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("duplicate_dismissals" as never) as any)
        .select("group_key");
      if (error) throw error;
      return (data ?? []) as { group_key: string }[];
    },
  });
  const dismissedKeys = useMemo(() => new Set(dismissals.map((d) => d.group_key)), [dismissals]);
  const [showDismissed, setShowDismissed] = useState(false);

  // Canonical key for a group = its member registration ids, sorted + joined.
  const canonicalKey = (groupRows: DupeRow[]) => groupRows.map((r) => r.id).sort().join("|");

  const dismissGroup = async (groupRows: DupeRow[]) => {
    const reg_ids = groupRows.map((r) => r.id).sort();
    const { error } = await (supabase.from("duplicate_dismissals" as never) as any)
      .insert({ group_key: reg_ids.join("|"), reg_ids });
    if (error) { toast.error(error.message || "Couldn't dismiss."); return; }
    toast.success("Marked as not a duplicate.");
    setActiveGroupKey(null);
    refetchDismissals();
    queryClient.invalidateQueries({ queryKey: ["youth-registrations"] }); // refresh inline badges
  };

  const restoreDismissed = async (key: string) => {
    const { error } = await (supabase.from("duplicate_dismissals" as never) as any)
      .delete().eq("group_key", key);
    if (error) { toast.error("Couldn't restore."); return; }
    refetchDismissals();
    queryClient.invalidateQueries({ queryKey: ["youth-registrations"] });
  };

  // Confirm before dismissing, so a mis-tap can't quietly hide a real duplicate.
  const [dismissTarget, setDismissTarget] = useState<DupeRow[] | null>(null);
  const dismissLabel = (groupRows: DupeRow[]) => {
    const names = [...new Set(groupRows.map((r) => `${r.child_first_name} ${r.child_last_name}`.trim()))];
    if (names.length <= 1) return names[0] || "these registrations";
    return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  };

  // Group rows by the DB-provided dup_key (same birthday + last name, or exact
  // name when no birthday). Each group is one kid — even if the first name is
  // spelled differently across their registrations.
  const groups = useMemo(() => {
    const map = new Map<string, DupeRow[]>();
    rows.forEach((r) => {
      if (!map.has(r.dup_key)) map.set(r.dup_key, []);
      map.get(r.dup_key)!.push(r);
    });
    const arr = [...map.entries()].map(([key, groupRows]) => {
      // Top of list (after keeper-rank sort) = the recommended keeper; use its
      // name/DOB/parent as the group's identity.
      const sorted = [...groupRows].sort(keeperRank);
      const top = sorted[0];
      const parentName = `${top.parent_first_name ?? ""} ${top.parent_last_name ?? ""}`.trim();
      // "Possible" = clustered only by matching name, with a differing/missing
      // birthday. These need a closer look before merging.
      const possible = groupRows.some((r) => r.match_type === "possible");
      return { key, ckey: canonicalKey(sorted), firstName: top.child_first_name.trim(), lastName: top.child_last_name.trim(), dob: top.child_date_of_birth, parentName, possible, rows: sorted };
    });
    // Sort groups by impact (rows with attendance first, then by name).
    arr.sort((a, b) => {
      const aTotal = a.rows.reduce((s, r) => s + r.attendance_count, 0);
      const bTotal = b.rows.reduce((s, r) => s + r.attendance_count, 0);
      if (bTotal !== aTotal) return bTotal - aTotal;
      return a.lastName.localeCompare(b.lastName);
    });
    return arr;
  }, [rows]);

  const visibleGroups = useMemo(() => groups.filter((g) => !dismissedKeys.has(g.ckey)), [groups, dismissedKeys]);
  const dismissedGroups = useMemo(() => groups.filter((g) => dismissedKeys.has(g.ckey)), [groups, dismissedKeys]);

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
    const keeperRow = activeGroup.rows.find((r) => r.id === activeKeeperId);
    const dupeRows = activeGroup.rows.filter((r) => r.id !== activeKeeperId);
    const dupeIds = dupeRows.map((r) => r.id);
    if (dupeIds.length === 0) return;
    // Only override the safety guard when a dupe's birthday actually differs
    // from the keeper's — so ordinary same-birthday merges keep the strict check.
    const allowDobMismatch = dupeRows.some(
      (d) => (d.child_date_of_birth || null) !== (keeperRow?.child_date_of_birth || null)
    );
    setMerging(true);
    const { data, error } = await supabase.rpc("admin_merge_youth_registrations", {
      _keeper_id: activeKeeperId,
      _dupe_ids: dupeIds,
      _allow_dob_mismatch: allowDobMismatch,
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

  const totalKids = visibleGroups.length;
  const totalDupeRows = visibleGroups.reduce((s, g) => s + g.rows.length, 0);
  const totalAttendanceAtRisk = visibleGroups.reduce((s, g) => s + g.rows.reduce((t, r) => t + r.attendance_count, 0), 0);

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
      ) : visibleGroups.length === 0 ? (
        <Card className="bg-emerald-500/10 border-emerald-400/30 text-white">
          <CardContent className="p-6 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0" />
            <p className="text-sm">
              No duplicate registrations to review. Everyone has a single registration (or has been marked "not a duplicate").
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
            {visibleGroups.map((g) => {
              const total = g.rows.reduce((s, r) => s + r.attendance_count, 0);
              const program = g.rows[0]?.child_boxing_program;
              return (
                <div
                  key={g.key}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10 hover:border-purple-400/40 transition"
                >
                  <button onClick={() => setActiveGroupKey(g.key)} className="min-w-0 flex-1 text-left">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold text-sm truncate flex items-center gap-2">
                      {g.firstName} {g.lastName}
                      <Badge className="bg-purple-500/15 text-purple-300 border-purple-400/30 text-[10px]">
                        {g.rows.length} registrations
                      </Badge>
                      {g.possible && (
                        <Badge className="bg-amber-500/15 text-amber-300 border-amber-400/30 text-[10px]">
                          Possible · birthday differs
                        </Badge>
                      )}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">
                      Born {formatDate(g.dob)}{g.parentName ? ` · Parent: ${g.parentName}` : ""}
                    </p>
                    <p className="text-white/30 text-[11px] mt-0.5">
                      {program} · {total} attendance record{total === 1 ? "" : "s"} across all rows
                    </p>
                  </div>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setDismissTarget(g.rows)}
                      className="text-[11px] font-medium text-white/40 hover:text-amber-300 border border-white/10 hover:border-amber-400/30 rounded-md px-2 py-1 transition whitespace-nowrap"
                      title="These are different kids (e.g. twins) — hide from this list"
                    >
                      Not a duplicate
                    </button>
                    <button onClick={() => setActiveGroupKey(g.key)} title="Review &amp; merge">
                      <ChevronRight className="w-4 h-4 text-white/40 hover:text-white/70" />
                    </button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Dismissed (marked "not a duplicate") — collapsible, with restore. */}
      {dismissedGroups.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
          <button
            onClick={() => setShowDismissed((v) => !v)}
            className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1.5"
          >
            {showDismissed ? "Hide" : "Show"} {dismissedGroups.length} marked “not a duplicate”
          </button>
          {showDismissed && (
            <div className="mt-2 space-y-1">
              {dismissedGroups.map((g) => (
                <div key={g.key} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/10">
                  <span className="text-xs text-white/60 truncate">
                    {g.firstName} {g.lastName} · Born {formatDate(g.dob)} · {g.rows.length} registrations
                  </span>
                  <button onClick={() => restoreDismissed(g.ckey)} className="text-[11px] text-white/40 hover:text-purple-300 shrink-0">
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
              <p className="text-xs text-amber-200/70">
                First check these are truly the <span className="font-semibold">same child</span> (same birthday + parent). Twins share a birthday and last name — if that's what you're seeing, click <span className="font-semibold">Not a duplicate</span> instead of merging.
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
                          {/* Name shown per-row — within a group the spelling can
                              differ (e.g. Chris vs Christian); the shared birthday
                              is what confirms they're the same kid. */}
                          <p className="text-sm font-semibold text-white truncate">{r.child_first_name} {r.child_last_name}</p>
                          <p className="text-[11px] text-white/50">
                            Born {formatDate(r.child_date_of_birth)}
                            {(r.parent_first_name || r.parent_last_name) ? ` · Parent: ${`${r.parent_first_name ?? ""} ${r.parent_last_name ?? ""}`.trim()}` : ""}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mt-2">
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

              <div className="flex gap-2 items-center justify-between pt-3 mt-2 border-t border-white/10">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-400/30 bg-transparent text-amber-200/80 hover:bg-amber-500/10"
                  onClick={() => activeGroup && setDismissTarget(activeGroup.rows)}
                  title="These are different kids (e.g. twins) — hide from the list"
                >
                  Not a duplicate
                </Button>
                <div className="flex gap-2">
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
            const dobDiffers = dupeRows.some(
              (r) => (r.child_date_of_birth || null) !== (keeperRow?.child_date_of_birth || null)
            );
            return (
              <div className="space-y-3">
                <p className="text-sm text-white/80">
                  This will merge <span className="font-bold text-white">{activeGroup.firstName} {activeGroup.lastName}</span> into a single registration.
                </p>
                {dobDiffers && (
                  <div className="rounded-lg bg-amber-500/[0.1] border border-amber-400/40 px-3 py-2.5 text-xs text-amber-100/90">
                    <p className="font-bold text-amber-200 mb-0.5">⚠ Birthdays don't match</p>
                    These records have different (or missing) birthdays. Only continue if you're
                    sure it's the <span className="font-semibold">same child</span> with a mistyped
                    date of birth — not two different kids who share a name.
                  </div>
                )}
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

      {/* Confirm before marking a group "not a duplicate". */}
      <AlertDialog open={!!dismissTarget} onOpenChange={(o) => { if (!o) setDismissTarget(null); }}>
        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as “not a duplicate”?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {dismissTarget && (
                <>You're confirming that <span className="font-semibold text-white/80">{dismissLabel(dismissTarget)}</span> are different children — not the same kid registered twice. They'll be removed from the duplicate list. You can Restore them later if this was a mistake.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 bg-transparent text-white/80 hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (dismissTarget) dismissGroup(dismissTarget); setDismissTarget(null); }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Yes, not a duplicate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
