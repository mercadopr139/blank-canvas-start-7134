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
            <Card key={pillar} className="bg-white/5 border-white/10 text-white">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-white/80">{count}</p>
                <p className="text-xs text-white/50 truncate">{pillar}</p>
                <p className="text-[10px] text-white/30">{pct}%</p>
                {showComparison && <DiffIndicator diff={diff} />}
              </CardContent>
            </Card>
          ))}
        </div>

        {showComparison && (
          <p className="text-[10px] text-white/30 text-center mb-8">
            Compared to previous period ({prevTotal} total)
          </p>
        )}

        {/* Archived List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <Archive className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-lg">No archived signals{selectedFilter !== "all" ? " in this period" : " yet"}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((signal) => (
              <div
                key={signal.id}
                className="flex items-center gap-4 p-4 rounded-lg border bg-white/[0.02] border-white/5 opacity-70"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white/60">{signal.title || "(Untitled)"}</span>
                </div>
                {signal.pillar && (
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${PILLAR_COLORS[signal.pillar] || "border-white/20 text-white/60"}`}>
                    {signal.pillar}
                  </Badge>
                )}
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
        )}
      </main>
    </div>
  );
};

export default AdminSignalsArchive;
