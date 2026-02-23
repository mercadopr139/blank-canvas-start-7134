import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, LogOut, Archive, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { subDays, startOfMonth, isAfter } from "date-fns";

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

type DateRange = "7d" | "this_month" | "30d" | "all";

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  "7d": "Last 7 Days",
  this_month: "This Month",
  "30d": "Last 30 Days",
  all: "All Time",
};

const AdminSignalsArchive = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>("all");
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

  const filtered = useMemo(() => {
    if (dateRange === "all") return allArchived;
    const now = new Date();
    let cutoff: Date;
    switch (dateRange) {
      case "7d":
        cutoff = subDays(now, 7);
        break;
      case "this_month":
        cutoff = startOfMonth(now);
        break;
      case "30d":
        cutoff = subDays(now, 30);
        break;
      default:
        return allArchived;
    }
    return allArchived.filter(
      (s) => s.archived_at && isAfter(new Date(s.archived_at), cutoff)
    );
  }, [allArchived, dateRange]);

  const pillarCounts = PILLARS.map((p) => ({
    pillar: p,
    count: filtered.filter((s) => s.pillar === p).length,
  }));

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
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
        {/* Date Filter */}
        <div className="mb-6">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[180px] bg-white/5 border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/20 z-[200]">
              {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((key) => (
                <SelectItem key={key} value={key} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">
                  {DATE_RANGE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pillar Breakdown */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{filtered.length}</p>
              <p className="text-xs text-white/50">Total</p>
            </CardContent>
          </Card>
          {pillarCounts.map(({ pillar, count }) => (
            <Card key={pillar} className="bg-white/5 border-white/10 text-white">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-white/80">{count}</p>
                <p className="text-xs text-white/50 truncate">{pillar}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Archived List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <Archive className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-lg">No archived signals{dateRange !== "all" ? " in this period" : " yet"}.</p>
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
