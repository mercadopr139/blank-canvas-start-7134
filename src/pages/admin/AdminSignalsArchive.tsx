import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, LogOut, Archive, Undo2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, subMonths, subDays, isWithinInterval, isAfter, format } from "date-fns";

const PILLARS = ["Operations", "Sales & Marketing", "Finance", "Vision", "Personal"] as const;

// Pillar colors used for badge styling elsewhere


const PILLAR_BORDER: Record<string, string> = {
  Operations: "border-[#bf0f3e]/50",
  "Sales & Marketing": "border-green-500/50",
  Finance: "border-sky-300/50",
  Vision: "border-amber-400/50",
  Personal: "border-purple-400/50",
};

type Signal = {
  id: string;
  title: string | null;
  pillar: string | null;
  priority_layer: string | null;
  signal_kind: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  date_assigned: string | null;
  signal_type: string;
  source: string | null;
  description: string | null;
  archived_at: string | null;
};

const buildOptions = () => {
  const options: { value: string; label: string }[] = [
    { value: "7d", label: "Last 7 Days" },
    { value: "30d", label: "Last 30 Days" },
  ];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    if (d.getFullYear() < 2026) break;
    const value = format(d, "yyyy-MM");
    const label = i === 0 ? `This Month (${format(d, "MMM yyyy")})` : format(d, "MMM yyyy");
    options.push({ value, label });
  }
  options.push({ value: "all", label: "All Time" });
  return options;
};

const FILTER_OPTIONS = buildOptions();

const AdminSignalsArchive = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState(FILTER_OPTIONS[0].value);
  const [activePillar, setActivePillar] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("signals")
        .update({ is_archived: false, archived_at: null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      toast.success("Signal unarchived");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: allArchived = [], isLoading } = useQuery({
    queryKey: ["signals", "archived"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .eq("is_archived", true as any)
        .order("archived_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Signal[];
    },
  });

  // Filter signals by the selected filter key
  const filterByKey = (signals: Signal[], key: string) => {
    if (key === "all") return signals;
    if (key === "7d" || key === "30d") {
      const cutoff = subDays(new Date(), key === "7d" ? 7 : 30);
      return signals.filter((s) => s.archived_at && isAfter(new Date(s.archived_at), cutoff));
    }
    // Month key like "2026-02"
    const [year, month] = key.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));
    return signals.filter(
      (s) => s.archived_at && isWithinInterval(new Date(s.archived_at), { start, end })
    );
  };

  const filtered = useMemo(() => filterByKey(allArchived, selectedFilter), [allArchived, selectedFilter]);

  // Previous period for comparison
  const prevPeriodSignals = useMemo(() => {
    if (selectedFilter === "all") return [];
    if (selectedFilter === "7d") {
      const start = subDays(new Date(), 14);
      const end = subDays(new Date(), 7);
      return allArchived.filter((s) => s.archived_at && isAfter(new Date(s.archived_at), start) && !isAfter(new Date(s.archived_at), end));
    }
    if (selectedFilter === "30d") {
      const start = subDays(new Date(), 60);
      const end = subDays(new Date(), 30);
      return allArchived.filter((s) => s.archived_at && isAfter(new Date(s.archived_at), start) && !isAfter(new Date(s.archived_at), end));
    }
    const [year, month] = selectedFilter.split("-").map(Number);
    const prevDate = subMonths(new Date(year, month - 1), 1);
    const prevKey = format(prevDate, "yyyy-MM");
    return filterByKey(allArchived, prevKey);
  }, [allArchived, selectedFilter]);

  const total = filtered.length;
  const prevTotal = prevPeriodSignals.length;

  const pillarCounts = PILLARS.map((p) => {
    const count = filtered.filter((s) => s.pillar === p).length;
    const prevCount = prevPeriodSignals.filter((s) => s.pillar === p).length;
    return {
      pillar: p,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
      diff: count - prevCount,
      prevCount,
    };
  });

  const totalDiff = total - prevTotal;
  const totalPctChange = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const showComparison = selectedFilter !== "all";

  // Drill-down: filtered signals for active pillar
  const drillDownSignals = useMemo(() => {
    if (!activePillar) return [];
    return filtered.filter((s) => s.pillar === activePillar);
  }, [filtered, activePillar]);

  // Label for drill-down header
  const filterLabel = useMemo(() => {
    const opt = FILTER_OPTIONS.find((o) => o.value === selectedFilter);
    return opt?.label || selectedFilter;
  }, [selectedFilter]);
  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const DiffIndicator = ({ diff, pctChange }: { diff: number; pctChange?: number | null }) => {
    if (diff === 0) return <span className="text-[10px] text-white/30 flex items-center gap-0.5"><Minus className="w-3 h-3" /> 0</span>;
    const positive = diff > 0;
    return (
      <span className={`text-[10px] flex items-center gap-0.5 ${positive ? "text-green-400" : "text-red-400"}`}>
        {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {positive ? "+" : ""}{diff}
        {pctChange != null && ` (${pctChange > 0 ? "+" : ""}${pctChange}%)`}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-black border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/signals")} aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">Archive – Signals</h1>
              <p className="text-sm text-white/50">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-white/20 text-white bg-black hover:bg-black hover:text-white">
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filter */}
        <div className="mb-6">
          <Select value={selectedFilter} onValueChange={setSelectedFilter}>
            <SelectTrigger className="w-[220px] bg-white/5 border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/20 z-[200]">
              {FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pillar Breakdown + Comparison */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{total}</p>
              <p className="text-xs text-white/50">Total</p>
              {showComparison && <DiffIndicator diff={totalDiff} pctChange={totalPctChange} />}
            </CardContent>
          </Card>
          {pillarCounts.map(({ pillar, count, pct, diff }) => (
            <Card
              key={pillar}
              className={`bg-white/5 text-white cursor-pointer transition-all hover:bg-white/10 ${activePillar === pillar ? "ring-1 ring-white/40" : ""} ${PILLAR_BORDER[pillar] || "border-white/10"}`}
              onClick={() => setActivePillar(activePillar === pillar ? null : pillar)}
            >
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-white/80">{count}</p>
                <p className="text-xs text-white/50 truncate">{pillar}</p>
                <p className="text-[10px] text-white/30">{pct}%</p>
                {showComparison && <DiffIndicator diff={diff} />}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Outcomes vs Actions | Core vs Bonus */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {(["Outcome", "Action"] as const).map((kind) => {
            const kindCount = filtered.filter((s) => s.signal_kind === kind).length;
            const kindPct = total > 0 ? Math.round((kindCount / total) * 100) : 0;
            return (
              <Card key={kind} className="bg-white/5 border-white/10 text-white">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-white/80">{kindCount}</p>
                  <p className="text-xs text-white/50">{kind}s</p>
                  <p className="text-[10px] text-white/30">{kindPct}%</p>
                </CardContent>
              </Card>
            );
          })}
          {(["Core", "Bonus"] as const).map((layer) => {
            const layerCount = filtered.filter((s) => s.priority_layer === layer).length;
            const layerPct = total > 0 ? Math.round((layerCount / total) * 100) : 0;
            return (
              <Card key={layer} className={`bg-white/5 text-white ${layer === "Core" ? "border-rose-500/40" : "border-white/10"}`}>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-white/80">{layerCount}</p>
                  <p className="text-xs text-white/50">{layer}</p>
                  <p className="text-[10px] text-white/30">{layerPct}%</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {showComparison && (
          <p className="text-[10px] text-white/30 text-center mb-8">
            Compared to previous period ({prevTotal} total)
          </p>
        )}

        {/* Pillar Drill-Down */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        ) : !activePillar ? (
          <div className="text-center py-12 text-white/30">
            <p className="text-sm">Click a pillar card above to view its archived signals.</p>
          </div>
        ) : drillDownSignals.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            <Archive className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No archived signals for {activePillar} in this period.</p>
            <Button variant="ghost" size="sm" onClick={() => setActivePillar(null)} className="mt-3 text-white/40 hover:text-white/70">
              ← Back to Summary
            </Button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/80">
                {activePillar} Archive – {filterLabel}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setActivePillar(null)} className="text-white/40 hover:text-white/70 text-xs">
                ← Back to Summary
              </Button>
            </div>
            <div className="space-y-2">
              {drillDownSignals.map((signal) => (
                <div
                  key={signal.id}
                  className="flex items-center gap-4 p-4 rounded-lg border bg-white/[0.02] border-white/5 opacity-70"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white/60">{signal.title || "(Untitled)"}</span>
                  </div>
                  {signal.priority_layer && (
                    <Badge variant="outline" className="text-[10px] border-white/20 text-white/40 shrink-0">
                      {signal.priority_layer}
                    </Badge>
                  )}
                  <span className="text-[10px] text-white/30 shrink-0">
                    {signal.archived_at ? new Date(signal.archived_at).toLocaleDateString() : "—"}
                  </span>
                  <button
                    onClick={() => unarchiveMutation.mutate(signal.id)}
                    className="shrink-0 text-white/20 hover:text-amber-400 transition-colors"
                    aria-label="Unarchive signal"
                    title="Unarchive"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminSignalsArchive;
