import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  LogOut,
  Archive,
  Undo2,
  Trash2,
  Search,
  Target,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays, isAfter } from "date-fns";

const PILLARS = ["Operations", "Sales & Marketing", "Finance", "Vision", "Personal"] as const;

const PILLAR_COLORS: Record<string, string> = {
  Operations: "bg-[#bf0f3e]/20 text-[#bf0f3e] border-[#bf0f3e]/40",
  "Sales & Marketing": "bg-green-500/20 text-green-400 border-green-500/40",
  Finance: "bg-sky-300/20 text-sky-300 border-sky-300/40",
  Vision: "bg-amber-400/20 text-amber-400 border-amber-400/40",
  Personal: "bg-purple-400/20 text-purple-400 border-purple-400/40",
};

type Signal = {
  id: string;
  title: string | null;
  pillar: string | null;
  status: string;
  archived_at: string | null;
  source: string | null;
};

type FocusArea = {
  key: string;
  title: string;
  accent_color: string;
  sort_order: number;
};

type Bucket = "week" | "month" | "all";

// Map a signal's stored `source` to a human focus-area label. Generalized
// over manager types: PD uses the legacy null/raw convention, every other
// manager uses the "<KEY>:<area>" prefix.
const sourceToFocusAreaTitle = (source: string | null, managerType: string): string => {
  if (managerType === "PD") {
    if (source === null || source === "NLA") return "NLA";
    if (source.includes(":")) return "Unknown"; // belongs to another manager
    return source;
  }
  const prefix = `${managerType}:`;
  if (!source?.startsWith(prefix)) return "Unknown";
  return source.slice(prefix.length);
};

const AdminSignalsArchive = ({ managerType = "PD" }: { managerType?: string }) => {
  const navigate = useNavigate();
  // focusArea is preserved only so the back arrow returns the user to the
  // kanban they came from. The archive view itself is cross-focus-area.
  const { focusArea = "nla" } = useParams<{ focusArea: string }>();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  // Legacy routes only exist for PD and PC; new managers use the
  // polymorphic /admin/task-manager/:managerType/signals/:focusArea path.
  const signalsBasePath =
    managerType === "PD"
      ? "/admin/signals"
      : managerType === "PC"
      ? "/admin/pc-signals"
      : `/admin/task-manager/${managerType}/signals`;

  const [bucket, setBucket] = useState<Bucket>("week");
  const [drilldown, setDrilldown] = useState<
    { kind: "focus" | "pillar"; key: string; label: string } | null
  >(null);
  const [drilldownSearch, setDrilldownSearch] = useState("");
  const [trashTarget, setTrashTarget] = useState<string | null>(null);

  // Fetch all archived signals for this manager type, across every focus area.
  // Filter by source prefix client-side because PostgREST not.like with the
  // colon character in the value is brittle.
  const { data: allArchived = [], isLoading } = useQuery({
    queryKey: ["archive-summary", managerType],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("signals")
        .select("id, title, pillar, status, archived_at, source") as any)
        .eq("is_archived", true)
        .eq("is_trashed", false)
        .order("archived_at", { ascending: false });
      if (error) throw error;
      const result = (data || []) as Signal[];
      // Manager-scope filter: PD owns null + raw-title sources (legacy);
      // every other manager owns "<KEY>:..." sources.
      return result.filter((s) => {
        if (managerType === "PD") return !s.source || !s.source.includes(":");
        return s.source?.startsWith(`${managerType}:`) ?? false;
      });
    },
  });

  const { data: focusAreas = [] } = useQuery({
    queryKey: ["focus-areas", managerType],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("focus_areas")
        .select("key, title, accent_color, sort_order") as any)
        .eq("manager_type", managerType)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as FocusArea[];
    },
  });

  // Time-bucket filter
  const filtered = useMemo(() => {
    if (bucket === "all") return allArchived;
    const cutoff = subDays(new Date(), bucket === "week" ? 7 : 30);
    return allArchived.filter(
      (s) => s.archived_at && isAfter(new Date(s.archived_at), cutoff)
    );
  }, [allArchived, bucket]);

  // Group by focus area, ordered by the focus area's sort_order so the bars
  // line up with how the user sees their workbench.
  const byFocusArea = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of filtered) {
      const title = sourceToFocusAreaTitle(s.source, managerType);
      counts[title] = (counts[title] || 0) + 1;
    }
    return focusAreas
      .map((fa) => ({
        key: fa.key,
        title: fa.title,
        accent: fa.accent_color,
        count: counts[fa.title] || 0,
      }))
      .filter((f) => f.count > 0);
  }, [filtered, focusAreas, managerType]);

  // Group by pillar
  const byPillar = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of filtered) {
      if (!s.pillar) continue;
      counts[s.pillar] = (counts[s.pillar] || 0) + 1;
    }
    return PILLARS.map((p) => ({ pillar: p, count: counts[p] || 0 })).filter(
      (p) => p.count > 0
    );
  }, [filtered]);

  // Drilldown signal list — feeds the side sheet.
  const drilldownSignals = useMemo(() => {
    if (!drilldown) return [];
    let results: Signal[];
    if (drilldown.kind === "focus") {
      results = filtered.filter(
        (s) => sourceToFocusAreaTitle(s.source, managerType) === drilldown.key
      );
    } else {
      results = filtered.filter((s) => s.pillar === drilldown.key);
    }
    if (drilldownSearch) {
      const q = drilldownSearch.toLowerCase();
      results = results.filter((s) => (s.title || "").toLowerCase().includes(q));
    }
    return results;
  }, [drilldown, filtered, drilldownSearch, managerType]);

  const totalForRange = filtered.length;
  const maxFocusCount = Math.max(...byFocusArea.map((f) => f.count), 1);
  const maxPillarCount = Math.max(...byPillar.map((p) => p.count), 1);

  // Restore: clear is_archived so the signal goes back to active. Reopen
  // tracking from the old design is intentionally dropped — completing
  // signals is the goal, not gamifying the archive.
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("signals")
        .update({ is_archived: false, archived_at: null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archive-summary"] });
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      toast.success("Signal restored");
    },
    onError: () => toast.error("Couldn't restore"),
  });

  const trashMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("signals")
        .update({
          is_trashed: true,
          trashed_at: new Date().toISOString(),
          trashed_by: user?.id || null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archive-summary"] });
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      setTrashTarget(null);
      toast.success("Moved to trash");
    },
    onError: () => toast.error("Couldn't move to trash"),
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <header className="border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`${signalsBasePath}/${focusArea}`)}
              aria-label="Back"
              className="text-zinc-400 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Archive</h1>
              <p className="text-xs text-zinc-500 font-medium">
                Completed signals across all focus areas
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5 hover:text-white text-xs h-9"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Log out
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Time bucket — Week / Month / All Time */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5">
            {(["week", "month", "all"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBucket(b)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  bucket === b ? "bg-white text-black" : "text-white/50 hover:text-white/80"
                }`}
              >
                {b === "week" ? "This Week" : b === "month" ? "This Month" : "All Time"}
              </button>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl border border-white/10 bg-white/[0.03]">
            <Archive className="w-5 h-5 text-white/40" />
            <div className="text-left">
              <div className="text-3xl font-extrabold text-white">{totalForRange}</div>
              <div className="text-[11px] uppercase tracking-wider text-white/40 font-medium">
                {bucket === "week"
                  ? "completed this week"
                  : bucket === "month"
                  ? "completed this month"
                  : "completed all time"}
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-white/40 py-12">Loading…</p>
        ) : totalForRange === 0 ? (
          <p className="text-center text-white/40 py-12">
            No completed signals in this range yet.
          </p>
        ) : (
          <>
            {/* By Focus Area */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-white/40" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">
                  By Focus Area
                </h2>
              </div>
              <div className="space-y-2">
                {byFocusArea.map((f) => (
                  <button
                    key={f.key}
                    onClick={() =>
                      setDrilldown({ kind: "focus", key: f.title, label: f.title })
                    }
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: f.accent }}
                    />
                    <span className="text-sm font-medium text-white flex-1 text-left">
                      {f.title}
                    </span>
                    <div className="w-32 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(f.count / maxFocusCount) * 100}%`,
                          background: f.accent,
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold text-white/80 w-8 text-right">
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* By Pillar */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-white/40" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">
                  By Pillar
                </h2>
              </div>
              <div className="space-y-2">
                {byPillar.map((p) => (
                  <button
                    key={p.pillar}
                    onClick={() =>
                      setDrilldown({ kind: "pillar", key: p.pillar, label: p.pillar })
                    }
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-colors"
                  >
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PILLAR_COLORS[p.pillar]} shrink-0`}
                    >
                      {p.pillar}
                    </span>
                    <span className="flex-1" />
                    <div className="w-32 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white/40 transition-all"
                        style={{ width: `${(p.count / maxPillarCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-white/80 w-8 text-right">
                      {p.count}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Drilldown side sheet — list of signals matching the clicked group. */}
      <Sheet
        open={!!drilldown}
        onOpenChange={(open) => {
          if (!open) {
            setDrilldown(null);
            setDrilldownSearch("");
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-zinc-950 border-white/10 text-white overflow-y-auto"
        >
          <SheetHeader className="mb-4">
            <SheetTitle className="text-white">
              {drilldown?.kind === "focus" ? "Focus Area" : "Pillar"}: {drilldown?.label}
            </SheetTitle>
            <p className="text-xs text-white/40">
              {drilldownSignals.length} signal
              {drilldownSignals.length === 1 ? "" : "s"}
            </p>
          </SheetHeader>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input
              value={drilldownSearch}
              onChange={(e) => setDrilldownSearch(e.target.value)}
              placeholder="Search…"
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm"
            />
          </div>

          <div className="space-y-2">
            {drilldownSignals.length === 0 ? (
              <p className="text-center text-white/30 py-8 text-sm">No signals match.</p>
            ) : (
              drilldownSignals.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2"
                >
                  <p className="text-sm text-white">{s.title || "Untitled"}</p>
                  <div className="flex items-center gap-2 flex-wrap text-[10px] text-white/40">
                    {s.pillar && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full border ${PILLAR_COLORS[s.pillar]}`}
                      >
                        {s.pillar}
                      </span>
                    )}
                    <span>{sourceToFocusAreaTitle(s.source, managerType)}</span>
                    {s.archived_at && (
                      <span>· {format(new Date(s.archived_at), "MMM d, yyyy")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreMutation.mutate(s.id)}
                      disabled={restoreMutation.isPending}
                      className="text-[10px] h-6 px-2 gap-1 border-white/20 text-white/60 bg-transparent hover:bg-white/10 hover:text-white"
                    >
                      <Undo2 className="w-3 h-3" />
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTrashTarget(s.id)}
                      className="text-[10px] h-6 px-2 gap-1 border-red-500/30 text-red-400 bg-transparent hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3 h-3" />
                      Trash
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!trashTarget}
        onOpenChange={(open) => {
          if (!open) setTrashTarget(null);
        }}
      >
        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Move to trash?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              The signal will move to the Trash where you can permanently delete it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white/60 hover:bg-white/5 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => trashTarget && trashMutation.mutate(trashTarget)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Move to trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSignalsArchive;
