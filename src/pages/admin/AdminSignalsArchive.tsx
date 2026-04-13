import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, LogOut, Archive, Undo2, TrendingUp, TrendingDown, Minus, Repeat, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, subMonths, subDays, isWithinInterval, isAfter, format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const PILLARS = ["Operations", "Sales & Marketing", "Finance", "Vision", "Personal"] as const;

const PILLAR_BORDER: Record<string, string> = {
  Operations: "border-[#bf0f3e]/50",
  "Sales & Marketing": "border-green-500/50",
  Finance: "border-sky-300/50",
  Vision: "border-amber-400/50",
  Personal: "border-purple-400/50",
};

// (PILLAR_COLORS removed – badge colors no longer used in drilldown)

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
  reopened_at: string | null;
  reopen_count: number;
};

type DrilldownFilter = {
  label: string;
  filterFn: (s: Signal) => boolean;
} | null;

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

const FOCUS_AREA_LABELS: Record<string, string> = {
  nla: "NLA", "usa-boxing": "USA Boxing", quikhit: "QUIKHIT", fcusa: "FCUSA", personal: "Personal",
};

const AdminSignalsArchive = () => {
  const navigate = useNavigate();
  const { focusArea = "nla" } = useParams<{ focusArea: string }>();
  const { user, signOut } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState(FILTER_OPTIONS[0].value);
  const [activePillar, setActivePillar] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const isNla = focusArea === "nla";
  const areaLabel = FOCUS_AREA_LABELS[focusArea] || focusArea;
  const applySourceFilter = (query: any) => {
    if (isNla) return query.or("source.is.null,source.eq.NLA");
    return query.eq("source", areaLabel);
  };

  // Drilldown state
  const [drilldown, setDrilldown] = useState<DrilldownFilter>(null);
  const [drilldownSearch, setDrilldownSearch] = useState("");

  // Trash state
  const [trashTarget, setTrashTarget] = useState<string | null>(null);

  const openDrilldown = (label: string, filterFn: (s: Signal) => boolean) => {
    setDrilldown({ label, filterFn });
    setDrilldownSearch("");
  };



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
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      setTrashTarget(null);
      toast.success("Moved to Trash");
    },
    onError: () => toast.error("Action failed. Try again."),
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: current, error: fetchErr } = await supabase
        .from("signals")
        .select("reopen_count")
        .eq("id", id)
        .single();
      if (fetchErr) throw fetchErr;
      const currentCount = (current as any)?.reopen_count ?? 0;
      const { error } = await supabase
        .from("signals")
        .update({
          is_archived: false,
          archived_at: null,
          reopened_at: new Date().toISOString(),
          reopen_count: currentCount + 1,
        } as any)
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
        .eq("is_trashed", false as any)
        .order("archived_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Signal[];
    },
  });

  const { data: allReopened = [] } = useQuery({
    queryKey: ["signals", "reopened"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .gt("reopen_count", 0 as any)
        .eq("is_trashed", false as any)
        .order("reopened_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Signal[];
    },
  });

  const filterReopenedByKey = (signals: Signal[], key: string) => {
    if (key === "all") return signals;
    if (key === "7d" || key === "30d") {
      const cutoff = subDays(new Date(), key === "7d" ? 7 : 30);
      return signals.filter((s) => s.reopened_at && isAfter(new Date(s.reopened_at), cutoff));
    }
    const [year, month] = key.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));
    return signals.filter(
      (s) => s.reopened_at && isWithinInterval(new Date(s.reopened_at), { start, end })
    );
  };

  const reopenedInRange = useMemo(() => filterReopenedByKey(allReopened, selectedFilter), [allReopened, selectedFilter]);

  const filterByKey = (signals: Signal[], key: string) => {
    if (key === "all") return signals;
    if (key === "7d" || key === "30d") {
      const cutoff = subDays(new Date(), key === "7d" ? 7 : 30);
      return signals.filter((s) => s.archived_at && isAfter(new Date(s.archived_at), cutoff));
    }
    const [year, month] = key.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));
    return signals.filter(
      (s) => s.archived_at && isWithinInterval(new Date(s.archived_at), { start, end })
    );
  };

  const filtered = useMemo(() => filterByKey(allArchived, selectedFilter), [allArchived, selectedFilter]);

  const drilldownResults = useMemo(() => {
    if (!drilldown) return [];
    let results = filtered.filter(drilldown.filterFn);
    if (drilldownSearch) {
      const q = drilldownSearch.toLowerCase();
      results = results.filter((s) => (s.title || "").toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q));
    }
    return results;
  }, [drilldown, filtered, drilldownSearch]);

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
    return { pillar: p, count, pct: total > 0 ? Math.round((count / total) * 100) : 0, diff: count - prevCount, prevCount };
  });

  const totalDiff = total - prevTotal;
  const totalPctChange = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const showComparison = selectedFilter !== "all";

  const PILLAR_CHART_COLORS: Record<string, string> = {
    Operations: "#bf0f3e",
    "Sales & Marketing": "#22c55e",
    Finance: "#7dd3fc",
    Vision: "#fbbf24",
    Personal: "#c084fc",
  };

  const monthlyTrendData = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i);
      months.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM") });
    }
    return months.map(({ key, label }) => {
      const [year, month] = key.split("-").map(Number);
      const start = startOfMonth(new Date(year, month - 1));
      const end = endOfMonth(new Date(year, month - 1));
      const inMonth = allArchived.filter(
        (s) => s.archived_at && isWithinInterval(new Date(s.archived_at), { start, end })
      );
      const row: Record<string, any> = { month: label, Total: inMonth.length };
      PILLARS.forEach((p) => {
        row[p] = inMonth.filter((s) => s.pillar === p).length;
      });
      return row;
    });
  }, [allArchived]);

  const drillDownSignals = useMemo(() => {
    if (!activePillar) return [];
    return filtered.filter((s) => s.pillar === activePillar);
  }, [filtered, activePillar]);

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

  // Clickable metric card component
  const MetricCard = ({
    value, label, subLabel, onClick, className = "", valueClassName = "text-white/80",
    diff, pctChange, showDiff = false,
  }: {
    value: number; label: string; subLabel?: string; onClick: () => void;
    className?: string; valueClassName?: string;
    diff?: number; pctChange?: number | null; showDiff?: boolean;
  }) => (
    <Card
      className={`bg-white/5 text-white cursor-pointer transition-all hover:bg-white/10 hover:ring-1 hover:ring-white/20 focus-visible:ring-2 focus-visible:ring-amber-400 ${className}`}
      onClick={onClick}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    >
      <CardContent className="p-4 text-center">
        <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
        <p className="text-xs text-white/50">{label}</p>
        {subLabel && <p className="text-[10px] text-white/30">{subLabel}</p>}
        {showDiff && diff !== undefined && <DiffIndicator diff={diff} pctChange={pctChange} />}
      </CardContent>
    </Card>
  );


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
          <MetricCard
            value={total}
            label="Total"
            valueClassName="text-amber-400"
            className="border-white/10"
            onClick={() => openDrilldown("Total", () => true)}
            diff={totalDiff}
            pctChange={totalPctChange}
            showDiff={showComparison}
          />
          {pillarCounts.map(({ pillar, count, pct, diff }) => (
            <MetricCard
              key={pillar}
              value={count}
              label={pillar}
              subLabel={`${pct}%`}
              className={`${activePillar === pillar ? "ring-1 ring-white/40" : ""} ${PILLAR_BORDER[pillar] || "border-white/10"}`}
              onClick={() => {
                setActivePillar(activePillar === pillar ? null : pillar);
                openDrilldown(pillar, (s) => s.pillar === pillar);
              }}
              diff={diff}
              showDiff={showComparison}
            />
          ))}
        </div>

        {/* Outcomes vs Actions | Core vs Bonus */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {(["Outcome", "Action"] as const).map((kind) => {
            const kindCount = filtered.filter((s) => s.signal_kind === kind).length;
            const kindPct = total > 0 ? Math.round((kindCount / total) * 100) : 0;
            return (
              <MetricCard
                key={kind}
                value={kindCount}
                label={`${kind}s`}
                subLabel={`${kindPct}%`}
                className="border-white/10"
                onClick={() => openDrilldown(`${kind}s`, (s) => s.signal_kind === kind)}
              />
            );
          })}
          {(["Core", "Bonus"] as const).map((layer) => {
            const layerCount = filtered.filter((s) => s.priority_layer === layer).length;
            const layerPct = total > 0 ? Math.round((layerCount / total) * 100) : 0;
            return (
              <MetricCard
                key={layer}
                value={layerCount}
                label={layer}
                subLabel={`${layerPct}%`}
                className={layer === "Core" ? "border-rose-500/40" : "border-white/10"}
                onClick={() => openDrilldown(layer, (s) => s.priority_layer === layer)}
              />
            );
          })}
        </div>

        {/* Reopened Rate */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <MetricCard
            value={reopenedInRange.length}
            label="Reopened"
            subLabel={`${total > 0 ? Math.round((reopenedInRange.length / total) * 100) : 0}% of archived`}
            valueClassName="text-orange-400"
            className="border-orange-500/40"
            onClick={() => openDrilldown("Reopened", (s) => s.reopen_count > 0)}
          />
        </div>

        {/* Top 5 Reopened Signals */}
        {(() => {
          const top5 = [...allReopened]
            .sort((a, b) => {
              if (b.reopen_count !== a.reopen_count) return b.reopen_count - a.reopen_count;
              const aDate = a.reopened_at ? new Date(a.reopened_at).getTime() : 0;
              const bDate = b.reopened_at ? new Date(b.reopened_at).getTime() : 0;
              return bDate - aDate;
            })
            .slice(0, 5);
          return top5.length > 0 ? (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Repeat className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-semibold text-white/80">Top 5 Reopened Signals</h3>
                <span className="text-[10px] text-white/30 ml-auto">Friction detector</span>
              </div>
              <div className="space-y-1.5">
                {top5.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border bg-white/[0.02] border-white/5">
                    <span className="text-sm text-white/70 flex-1 min-w-0 truncate">{s.title || "(Untitled)"}</span>
                    {s.pillar && (
                      <Badge variant="outline" className={`text-[10px] shrink-0 text-white/50 ${PILLAR_BORDER[s.pillar] || "border-white/20"}`}>
                        {s.pillar}
                      </Badge>
                    )}
                    <span className="text-xs font-bold text-orange-400 shrink-0">×{s.reopen_count}</span>
                    <span className="text-[10px] text-white/30 shrink-0 w-20 text-right">
                      {s.reopened_at ? format(new Date(s.reopened_at), "MMM d, yyyy") : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {/* Monthly Trend Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-white/80 mb-4">Archived Signals by Month</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                    <Bar dataKey="Total" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-white/80 mb-4">Pillar Mix by Month</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }} />
                    {PILLARS.map((p) => (
                      <Bar key={p} dataKey={p} stackId="pillar" fill={PILLAR_CHART_COLORS[p]} radius={0} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {showComparison && (
          <p className="text-[10px] text-white/30 text-center mb-8">
            Compared to previous period ({prevTotal} total)
          </p>
        )}

        {/* Pillar Drill-Down (existing archive view) */}
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
                <div key={signal.id} className="flex items-center gap-4 p-4 rounded-lg border bg-white/[0.02] border-white/5 opacity-70">
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
                  <button
                    onClick={(e) => { e.stopPropagation(); setTrashTarget(signal.id); }}
                    className="shrink-0 text-white/20 hover:text-red-400 transition-colors"
                    aria-label="Move to Trash"
                    title="Move to Trash"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Drilldown Sheet */}
      <Sheet open={!!drilldown} onOpenChange={(open) => { if (!open) setDrilldown(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg bg-zinc-950 border-white/10 text-white overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-white text-lg">{drilldown?.label} — Completed</SheetTitle>
            <SheetDescription className="text-white/50 text-sm">
              Showing completed signals for {filterLabel}
            </SheetDescription>
          </SheetHeader>

          {/* Search */}
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              placeholder="Search signals…"
              value={drilldownSearch}
              onChange={(e) => setDrilldownSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          {/* Results */}
          <div className="space-y-1.5">
            {drilldownResults.length === 0 ? (
              <p className="text-center text-white/30 py-8 text-sm">No signals match this filter.</p>
            ) : (
              drilldownResults.map((signal) => {
                const pillarColor = signal.pillar ? PILLAR_CHART_COLORS[signal.pillar] || "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)";
                const metaParts: string[] = [];
                if (signal.signal_kind) metaParts.push(signal.signal_kind);
                if (signal.priority_layer) metaParts.push(signal.priority_layer);
                return (
                  <div
                    key={signal.id}
                    className="group flex items-center gap-3 p-3 rounded-lg border bg-white/[0.02] border-white/5 hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: pillarColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 leading-snug">{signal.title || "(Untitled)"}</p>
                      <p className="text-[11px] text-white/35 mt-0.5">
                        {[signal.pillar, ...metaParts].filter(Boolean).join(" · ")}
                        {signal.archived_at && ` · ${format(new Date(signal.archived_at), "MMM d")}`}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setTrashTarget(signal.id); }}
                      className="shrink-0 text-white/10 group-hover:text-white/30 hover:!text-red-400 transition-colors"
                      aria-label="Move to Trash"
                      title="Move to Trash"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Move to Trash Confirmation */}
      <AlertDialog open={!!trashTarget} onOpenChange={(open) => { if (!open) setTrashTarget(null); }}>
        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Move this signal to Trash?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">You can restore it later or permanently delete it from Trash.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => trashTarget && trashMutation.mutate(trashTarget)}
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSignalsArchive;
