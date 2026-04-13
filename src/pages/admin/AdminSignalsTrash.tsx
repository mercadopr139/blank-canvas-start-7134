import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, LogOut, Trash2, Undo2, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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
  date_assigned: string | null;
  signal_type: string;
  trashed_at: string | null;
};

const FOCUS_AREA_LABELS: Record<string, string> = {
  nla: "NLA", "usa-boxing": "USA Boxing", quikhit: "QUIKHIT", fcusa: "FCUSA", personal: "Personal",
};

const AdminSignalsTrash = () => {
  const navigate = useNavigate();
  const { focusArea = "nla" } = useParams<{ focusArea: string }>();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const isNla = focusArea === "nla";
  const areaLabel = FOCUS_AREA_LABELS[focusArea] || focusArea;
  const applySourceFilter = (query: any) => {
    if (isNla) return query.or("source.is.null,source.eq.NLA");
    return query.eq("source", areaLabel);
  };

  const [search, setSearch] = useState("");
  const [pillarFilter, setPillarFilter] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [bucketFilter, setBucketFilter] = useState<string | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<string | null>(null);

  const { data: trashedSignals = [], isLoading } = useQuery({
    queryKey: ["signals", "trashed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .eq("is_trashed", true as any)
        .order("trashed_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Signal[];
    },
  });

  const filtered = useMemo(() => {
    let results = trashedSignals;
    if (search) {
      const q = search.toLowerCase();
      results = results.filter((s) => (s.title || "").toLowerCase().includes(q));
    }
    if (pillarFilter) results = results.filter((s) => s.pillar === pillarFilter);
    if (kindFilter) results = results.filter((s) => s.signal_kind === kindFilter);
    if (bucketFilter) results = results.filter((s) => s.priority_layer === bucketFilter);
    return results;
  }, [trashedSignals, search, pillarFilter, kindFilter, bucketFilter]);

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("signals")
        .update({
          is_trashed: false,
          trashed_at: null,
          trashed_by: null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      toast.success("Restored");
    },
    onError: () => toast.error("Action failed. Try again."),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("signals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      setPermanentDeleteTarget(null);
      toast.success("Deleted permanently");
    },
    onError: () => toast.error("Action failed. Try again."),
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const FilterChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
        active ? "bg-white/20 border-white/40 text-white" : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
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
              <h1 className="text-xl font-bold text-white">Trash – Signals</h1>
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
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            placeholder="Search trashed signals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 max-w-md"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {PILLARS.map((p) => (
            <FilterChip key={p} label={p} active={pillarFilter === p} onClick={() => setPillarFilter(pillarFilter === p ? null : p)} />
          ))}
          <span className="w-px h-5 bg-white/10 mx-1 self-center" />
          {(["Outcome", "Action"] as const).map((k) => (
            <FilterChip key={k} label={k} active={kindFilter === k} onClick={() => setKindFilter(kindFilter === k ? null : k)} />
          ))}
          <span className="w-px h-5 bg-white/10 mx-1 self-center" />
          {(["Core", "Bonus"] as const).map((b) => (
            <FilterChip key={b} label={b} active={bucketFilter === b} onClick={() => setBucketFilter(bucketFilter === b ? null : b)} />
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <Trash2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Trash is empty.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((signal) => (
              <div key={signal.id} className="flex items-center gap-3 p-4 rounded-lg border bg-white/[0.02] border-white/5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/70 mb-1">{signal.title || "(Untitled)"}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {signal.pillar && (
                      <Badge variant="outline" className={`text-[10px] ${PILLAR_COLORS[signal.pillar] || "border-white/20 text-white/60"}`}>
                        {signal.pillar}
                      </Badge>
                    )}
                    {signal.signal_kind && (
                      <Badge variant="outline" className="text-[10px] border-white/20 text-white/40">
                        {signal.signal_kind}
                      </Badge>
                    )}
                    {signal.priority_layer && (
                      <Badge variant="outline" className={`text-[10px] ${signal.priority_layer === "Core" ? "border-rose-500/40 text-rose-400" : "border-white/20 text-white/40"}`}>
                        {signal.priority_layer}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-white/30 mt-1">
                    Trashed: {signal.trashed_at ? format(new Date(signal.trashed_at), "MMM d, yyyy h:mm a") : "—"}
                  </p>
                </div>
                <button
                  onClick={() => restoreMutation.mutate(signal.id)}
                  className="shrink-0 text-white/30 hover:text-amber-400 transition-colors"
                  aria-label="Restore"
                  title="Restore"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPermanentDeleteTarget(signal.id)}
                  className="shrink-0 text-white/20 hover:text-red-400 transition-colors"
                  aria-label="Delete permanently"
                  title="Delete permanently"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Permanent Delete Confirmation */}
      <AlertDialog open={!!permanentDeleteTarget} onOpenChange={(open) => { if (!open) setPermanentDeleteTarget(null); }}>
        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete permanently?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => permanentDeleteTarget && permanentDeleteMutation.mutate(permanentDeleteTarget)}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSignalsTrash;
