import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Signal as SignalIcon, ArrowRight, Plus, Check, Circle, ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
}

type FocusArea = {
  id: string;
  key: string;
  title: string;
  manager_type: string;
};

type CoreSignal = {
  id: string;
  title: string | null;
  status: string;
  source: string | null;
  description: string | null;
  pillar: string | null;
};

// Mirrors helpers in AdminWorkbench.tsx + AddToWorkbenchModal.tsx — keep
// all three in sync. PD legacy stores source as the raw area title (or
// null for NLA); every other manager prefixes with "<MGR>:".
const signalSourceFor = (managerType: string, area: { key: string; title: string }): string | null => {
  const isNla = area.key === "nla";
  if (managerType === "PD") return isNla ? null : area.title;
  return `${managerType}:${isNla ? "NLA" : area.title}`;
};

const sourceToFocusAreaKey = (
  source: string | null,
  managerType: string,
  focusAreas: FocusArea[],
): string | null => {
  if (managerType === "PD") {
    if (source === null || source === "NLA") return "nla";
    if (source.includes(":")) return null; // belongs to another manager
    return focusAreas.find((a) => a.title === source)?.key ?? null;
  }
  const prefix = `${managerType}:`;
  if (!source?.startsWith(prefix)) return null;
  const stripped = source.slice(prefix.length);
  if (stripped === "NLA") return "nla";
  return focusAreas.find((a) => a.title === stripped)?.key ?? null;
};

const MyWorkbenchOverlay = ({ open, onClose, currentUserId }: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState<string | null>(null);
  const [addingDraft, setAddingDraft] = useState("");

  // The current user's task_manager_type is the gate. No type = no
  // Workbench, and we render the empty state instead of trying to fetch.
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-task-manager-type", currentUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_profiles")
        .select("task_manager_type")
        .eq("user_id", currentUserId)
        .maybeSingle();
      return data as { task_manager_type: string | null } | null;
    },
    enabled: !!currentUserId && open,
  });

  const managerType = profile?.task_manager_type ?? null;

  const { data: focusAreas = [], isLoading: areasLoading } = useQuery<FocusArea[]>({
    queryKey: ["my-workbench-focus-areas", managerType],
    queryFn: async () => {
      if (!managerType) return [];
      const { data, error } = await supabase
        .from("focus_areas")
        .select("id, key, title, manager_type")
        .eq("manager_type", managerType)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as FocusArea[];
    },
    enabled: !!managerType && open,
  });

  const { data: coreSignals = [], isLoading: signalsLoading } = useQuery<CoreSignal[]>({
    queryKey: ["my-workbench-core-signals", managerType],
    queryFn: async () => {
      if (!managerType) return [];
      const { data, error } = await supabase
        .from("signals")
        .select("id, title, status, source, description, pillar, today_sort_order, created_at")
        .eq("priority_layer", "Core")
        .eq("is_archived", false)
        .eq("is_trashed", false)
        .order("today_sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data || []) as (CoreSignal & { today_sort_order?: number; created_at?: string })[]).filter((s) => {
        if (managerType === "PD") return !s.source || !s.source.includes(":");
        return s.source?.startsWith(`${managerType}:`) ?? false;
      });
    },
    enabled: !!managerType && open,
  });

  const addSignalMutation = useMutation({
    mutationFn: async ({ title, area }: { title: string; area: FocusArea }) => {
      const source = signalSourceFor(managerType!, area);
      const { error } = await supabase.from("signals").insert({
        title,
        pillar: null,
        priority_layer: "Core",
        signal_kind: null,
        signal_type: "Action",
        status: "Pending",
        is_archived: false,
        source,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-workbench-core-signals", managerType] });
      // Also invalidate the full Workbench page's queries so they reflect
      // the new signal when the user opens it.
      queryClient.invalidateQueries({ queryKey: ["task-manager-home-core"] });
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      setAdding(null);
      setAddingDraft("");
    },
    onError: (e: unknown) => {
      toast({
        title: "Failed to add signal",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const next = status === "Complete" ? "Pending" : "Complete";
      const { error } = await supabase
        .from("signals")
        .update({
          status: next,
          completed_at: next === "Complete" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-workbench-core-signals", managerType] });
      queryClient.invalidateQueries({ queryKey: ["task-manager-home-core"] });
      queryClient.invalidateQueries({ queryKey: ["signals"] });
    },
  });

  // Group signals by focus-area key for display
  const signalsByArea = new Map<string, CoreSignal[]>();
  for (const area of focusAreas) signalsByArea.set(area.key, []);
  for (const s of coreSignals) {
    const key = sourceToFocusAreaKey(s.source, managerType || "", focusAreas);
    if (key && signalsByArea.has(key)) signalsByArea.get(key)!.push(s);
  }

  const totalCount = coreSignals.length;
  const doneCount = coreSignals.filter((s) => s.status === "Complete").length;

  const handleAddSubmit = (area: FocusArea) => {
    const trimmed = addingDraft.trim();
    if (!trimmed) return;
    addSignalMutation.mutate({ title: trimmed, area });
  };

  const handleOpenFullWorkbench = () => {
    onClose();
    navigate(managerType === "PD" ? "/admin/pd-task-manager" : "/admin/pc-task-manager");
  };

  const loading = profileLoading || areasLoading || signalsLoading;
  const noManager = !profileLoading && !managerType;
  const noAreas = !!managerType && !areasLoading && focusAreas.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-neutral-950 border-white/[0.08] text-white max-w-3xl w-[95vw] max-h-[90vh] p-0 gap-0 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/15 text-emerald-400 shrink-0">
              <SignalIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white">My Workbench</h2>
              <p className="text-[11px] text-zinc-500">
                {totalCount > 0
                  ? `${doneCount} of ${totalCount} Core done`
                  : "Nothing on your list yet"}
              </p>
            </div>
          </div>
          {managerType && (
            <button
              onClick={handleOpenFullWorkbench}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 shrink-0"
            >
              Open full Workbench
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <p className="text-zinc-600 text-sm text-center py-8">Loading…</p>
          )}

          {noManager && (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-300 mb-2">You don't have a Workbench assigned yet.</p>
              <p className="text-xs text-zinc-500">
                Ask Josh to set your <code className="bg-white/[0.06] px-1 rounded">task_manager_type</code> on your staff profile.
              </p>
            </div>
          )}

          {noAreas && (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-300 mb-2">Your Workbench has no focus areas yet.</p>
              <button
                onClick={handleOpenFullWorkbench}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline"
              >
                Open full Workbench to create one →
              </button>
            </div>
          )}

          {!loading && !noManager && !noAreas && (
            <div className="space-y-4">
              {focusAreas.map((area) => {
                const signals = signalsByArea.get(area.key) || [];
                const isAddingHere = adding === area.key;
                return (
                  <div
                    key={area.key}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        {area.title}
                      </h3>
                      <span className="text-[10px] text-zinc-600">
                        {signals.filter((s) => s.status === "Complete").length}/{signals.length}
                      </span>
                    </div>

                    {signals.length === 0 && !isAddingHere && (
                      <p className="text-[11px] text-zinc-600 italic mb-2">Nothing here yet.</p>
                    )}

                    <div className="space-y-1">
                      {signals.map((s) => {
                        const done = s.status === "Complete";
                        return (
                          <button
                            key={s.id}
                            onClick={() => toggleStatusMutation.mutate({ id: s.id, status: s.status })}
                            className="w-full flex items-start gap-2 px-2 py-1.5 rounded hover:bg-white/[0.04] text-left transition-colors group"
                          >
                            {done ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 shrink-0 mt-0.5" />
                            )}
                            <span
                              className={`text-xs leading-relaxed ${
                                done ? "text-zinc-600 line-through" : "text-zinc-200"
                              }`}
                            >
                              {s.title || "(untitled)"}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {isAddingHere ? (
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          autoFocus
                          value={addingDraft}
                          onChange={(e) => setAddingDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); handleAddSubmit(area); }
                            if (e.key === "Escape") { setAdding(null); setAddingDraft(""); }
                          }}
                          placeholder="What needs to get done?"
                          className="h-7 text-xs bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-600"
                        />
                        <Button
                          size="sm"
                          disabled={!addingDraft.trim() || addSignalMutation.isPending}
                          onClick={() => handleAddSubmit(area)}
                          className="h-7 text-[11px] bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
                        >
                          Add
                        </Button>
                        <button
                          onClick={() => { setAdding(null); setAddingDraft(""); }}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300 px-1"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAdding(area.key); setAddingDraft(""); }}
                        className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500 hover:text-emerald-400 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add to {area.title}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with full-workbench shortcut */}
        {managerType && (
          <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-end shrink-0">
            <button
              onClick={handleOpenFullWorkbench}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
            >
              Full Workbench
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MyWorkbenchOverlay;
