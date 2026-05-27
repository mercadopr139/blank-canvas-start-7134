// SendToWorkbenchOverlay — the per-row Send-to-Workbench surface.
//
// Triggered from the Send button on any agenda task row. Mirrors the
// pattern of [[MyWorkbenchOverlay]] in the Message Board so the muscle
// memory transfers: pick a target staffer at the top, see their full
// Workbench tiles below, click "Add to X" on whichever tile you want
// the task to land in. The input is pre-filled with the agenda task
// title but fully editable before sending.
//
// Notes:
//   - Source convention matches MyWorkbenchOverlay's signalSourceFor
//     so the resulting signals show up correctly in the target's
//     existing Workbench display (PD-NLA = null, others = "TYPE:title").
//   - source_agenda_item_id is set on every insert so the bi-directional
//     status sync still works (reviewing the agenda task flips the
//     pushed signal Complete, and vice versa).
//   - Modal stays open after a successful add — common during a meeting
//     to drop one task into multiple tiles (e.g. NLA AND Personal).

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Circle, Plus, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  colorForUserId,
  initialsOf,
  type AgendaItemWithChildren,
  type StaffOption,
} from "./types";

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
};

// Same convention as MyWorkbenchOverlay + AdminWorkbench. Keep all
// three aligned — PD's NLA is the only legacy bare-source case.
const signalSourceFor = (
  managerType: string,
  area: { key: string; title: string },
): string | null => {
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
    if (source.includes(":")) return null;
    return focusAreas.find((a) => a.title === source)?.key ?? null;
  }
  const prefix = `${managerType}:`;
  if (!source?.startsWith(prefix)) return null;
  const stripped = source.slice(prefix.length);
  if (stripped === "NLA") return "nla";
  return focusAreas.find((a) => a.title === stripped)?.key ?? null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  agendaItem: AgendaItemWithChildren | null;
  staff: StaffOption[];
  // manager_type → focus_area_id of seeded Agenda tile. Used here just
  // to identify which staff have a Workbench set up (filter the picker).
  agendaFocusByManager: Map<string, string>;
}

export const SendToWorkbenchOverlay = ({
  open,
  onClose,
  agendaItem,
  staff,
  agendaFocusByManager,
}: Props) => {
  const queryClient = useQueryClient();
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [addingDraft, setAddingDraft] = useState("");

  const eligibleStaff = useMemo(
    () =>
      staff.filter(
        (s) => s.task_manager_type && agendaFocusByManager.has(s.task_manager_type),
      ),
    [staff, agendaFocusByManager],
  );

  // Default to the first eligible staffer when the modal opens.
  // Resets the add-input on every open so a stale draft doesn't carry
  // across different agenda items.
  useEffect(() => {
    if (open) {
      setAdding(null);
      setAddingDraft("");
      if (!targetUserId && eligibleStaff.length > 0) {
        setTargetUserId(eligibleStaff[0].user_id);
      }
    }
  }, [open, eligibleStaff, targetUserId]);

  const targetUser = staff.find((s) => s.user_id === targetUserId) ?? null;
  const managerType = targetUser?.task_manager_type ?? null;

  const { data: focusAreas = [], isLoading: areasLoading } = useQuery<FocusArea[]>({
    queryKey: ["send-workbench-focus-areas", managerType],
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

  // Current Pending signals on the target Workbench so the user can
  // see what's already there before adding (avoid duplicates, judge
  // load). Same filtering convention as MyWorkbenchOverlay.
  const { data: coreSignals = [] } = useQuery<CoreSignal[]>({
    queryKey: ["send-workbench-core-signals", managerType],
    queryFn: async () => {
      if (!managerType) return [];
      const { data, error } = await supabase
        .from("signals")
        .select("id, title, status, source")
        .eq("priority_layer", "Core")
        .eq("is_archived", false)
        .eq("is_trashed", false);
      if (error) throw error;
      return ((data || []) as CoreSignal[]).filter((s) => {
        if (managerType === "PD") return !s.source || !s.source.includes(":");
        return s.source?.startsWith(`${managerType}:`) ?? false;
      });
    },
    enabled: !!managerType && open,
  });

  const addSignalMutation = useMutation({
    mutationFn: async ({ title, area }: { title: string; area: FocusArea }) => {
      if (!agendaItem || !managerType) throw new Error("Missing context");
      const source = signalSourceFor(managerType, area);
      const { error } = await supabase.from("signals").insert({
        title,
        description: agendaItem.notes,
        pillar: null,
        priority_layer: "Core",
        signal_kind: null,
        signal_type: "Action",
        status: "Pending",
        is_archived: false,
        source,
        // Bi-directional sync hook — reviewing the agenda task flips
        // this signal Complete (and vice versa) via the realtime
        // listener in AdminAgenda.
        source_agenda_item_id: agendaItem.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["send-workbench-core-signals", managerType] });
      queryClient.invalidateQueries({ queryKey: ["agenda-sourced-signals"] });
      queryClient.invalidateQueries({ queryKey: ["task-manager-home-core"] });
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      queryClient.invalidateQueries({ queryKey: ["my-workbench-core-signals"] });
      toast.success(
        `Added to ${targetUser?.full_name?.split(" ")[0] ?? "Workbench"}.`,
      );
      setAdding(null);
      setAddingDraft("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Add failed."),
  });

  // Group Pending signals by focus-area key for the per-tile display.
  const signalsByArea = useMemo(() => {
    const m = new Map<string, CoreSignal[]>();
    for (const a of focusAreas) m.set(a.key, []);
    for (const s of coreSignals) {
      const key = sourceToFocusAreaKey(s.source, managerType || "", focusAreas);
      if (key && m.has(key)) m.get(key)!.push(s);
    }
    return m;
  }, [coreSignals, focusAreas, managerType]);

  const startAddingTo = (area: FocusArea) => {
    setAdding(area.key);
    setAddingDraft(agendaItem?.title ?? "");
  };

  const handleAddSubmit = (area: FocusArea) => {
    const trimmed = addingDraft.trim();
    if (!trimmed) return;
    addSignalMutation.mutate({ title: trimmed, area });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-neutral-950 border-white/[0.08] text-white max-w-3xl w-[95vw] max-h-[90vh] p-0 gap-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-white/[0.06] shrink-0 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/15 text-emerald-400 shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <DialogTitle className="text-sm font-bold text-white">
                Send to Workbench
              </DialogTitle>
              <p className="text-[11px] text-zinc-500 truncate">
                {agendaItem?.title
                  ? `Adding: "${agendaItem.title}"`
                  : "Pick a Workbench"}
              </p>
            </div>
          </div>

          {/* Target picker — pill buttons, one per eligible staff. */}
          {eligibleStaff.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {eligibleStaff.map((s) => {
                const active = s.user_id === targetUserId;
                return (
                  <button
                    key={s.user_id}
                    type="button"
                    onClick={() => {
                      setTargetUserId(s.user_id);
                      setAdding(null);
                    }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors ${
                      active
                        ? "bg-white/[0.08] border-white/20 text-white"
                        : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/15"
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-white text-[8px] shrink-0"
                      style={{ background: colorForUserId(s.user_id) }}
                    >
                      {initialsOf(s.full_name)}
                    </span>
                    <span className="truncate max-w-[120px]">
                      {s.full_name.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </DialogHeader>

        {/* Body — focus area tiles for the selected staffer */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {eligibleStaff.length === 0 && (
            <p className="text-xs text-zinc-500 italic text-center py-6">
              No Workbenches are configured yet.
            </p>
          )}

          {eligibleStaff.length > 0 && !managerType && (
            <p className="text-xs text-zinc-500 italic text-center py-6">
              Pick a Workbench above to see its tiles.
            </p>
          )}

          {areasLoading && (
            <p className="text-zinc-600 text-sm text-center py-8">Loading…</p>
          )}

          {!areasLoading && managerType && focusAreas.length === 0 && (
            <p className="text-xs text-zinc-500 italic text-center py-6">
              This Workbench has no focus areas yet.
            </p>
          )}

          {!areasLoading && focusAreas.length > 0 && (
            <div className="space-y-3">
              {focusAreas.map((area) => {
                const signals = signalsByArea.get(area.key) || [];
                const isAddingHere = adding === area.key;
                const doneCount = signals.filter((s) => s.status === "Complete").length;

                return (
                  <div
                    key={area.key}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        {area.title}
                      </h3>
                      <span className="text-[10px] text-zinc-600 tabular-nums">
                        {doneCount}/{signals.length}
                      </span>
                    </div>

                    {signals.length === 0 && !isAddingHere && (
                      <p className="text-[11px] text-zinc-600 italic mb-2">
                        Nothing here yet.
                      </p>
                    )}

                    {signals.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {signals.map((s) => {
                          const done = s.status === "Complete";
                          return (
                            <div
                              key={s.id}
                              className="flex items-start gap-2 px-2 py-1 text-left"
                            >
                              {done ? (
                                <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                              ) : (
                                <Circle className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" />
                              )}
                              <span
                                className={`text-[11px] leading-relaxed ${
                                  done ? "text-zinc-600 line-through" : "text-zinc-300"
                                }`}
                              >
                                {s.title || "(untitled)"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {isAddingHere ? (
                      <div className="flex items-center gap-2">
                        <Input
                          autoFocus
                          value={addingDraft}
                          onChange={(e) => setAddingDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddSubmit(area);
                            }
                            if (e.key === "Escape") {
                              setAdding(null);
                              setAddingDraft("");
                            }
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
                          type="button"
                          onClick={() => { setAdding(null); setAddingDraft(""); }}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300 px-1"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startAddingTo(area)}
                        className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-emerald-400 transition-colors"
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

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between shrink-0">
          <p className="text-[10px] text-zinc-600">
            Tip: open multiple tiles to drop the same task into more than one.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-zinc-400 hover:text-white px-2 py-1"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
