// Floating "Workbenches" button + slide-out drawer for the Agenda page.
//
// Lives at the page level (not per-row) so the meeting flow is:
//   1. Per-row Send button pushes a task to a staffer's Workbench
//   2. This drawer is the at-a-glance "what does everyone owe right now"
//      view — one panel per eligible staff Workbench, listing the
//      Pending agenda-sourced signals on each.
//
// Removing an item here deletes the underlying signal row in the
// Workbench. That breaks the agenda ↔ workbench link entirely (it is
// the same as the user removing it from their Workbench themselves),
// so the agenda item itself is untouched — review state stays as is.

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Briefcase, X, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { colorForUserId, initialsOf, type StaffOption } from "./types";

interface AgendaSignal {
  id: string;
  title: string;
  status: "Pending" | "Complete";
  source: string | null;
  source_agenda_item_id: string;
  created_at: string;
}

// Workbenches are scoped by manager_type, not by user_id (the signals
// table has no user_id column). The convention:
//   - PD's NLA tile        → source = null OR "NLA"
//   - PD's other tiles     → source = "<title>" (e.g. "USA Boxing")
//   - any non-PD type      → source = "<TYPE>:<title or NLA>"
// So the manager_type is either the prefix before ":", or PD as the
// fallback for legacy bare sources.
const managerTypeFromSource = (source: string | null): string => {
  if (!source) return "PD";
  const colon = source.indexOf(":");
  if (colon > 0) return source.slice(0, colon);
  return "PD";
};

interface Props {
  staff: StaffOption[];
  // manager_type → focus_area_id. Same map the per-row Send button uses
  // — used here just to determine which staff are "eligible Workbench
  // recipients" so we don't render empty panels for users who can't
  // receive items.
  agendaFocusByManager: Map<string, string>;
}

export const WorkbenchesDrawer = ({ staff, agendaFocusByManager }: Props) => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Only fetch while the drawer is open — keeps the page idle when not
  // in use. Pulls every agenda-sourced signal in one round trip, then
  // groups client-side by manager_type derived from the source field.
  const { data: signals = [], isLoading } = useQuery<AgendaSignal[]>({
    queryKey: ["agenda-sourced-signals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("id, title, status, source, source_agenda_item_id, created_at")
        .not("source_agenda_item_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AgendaSignal[];
    },
    enabled: open,
  });

  const removeMutation = useMutation({
    mutationFn: async (signalId: string) => {
      const { error } = await supabase.from("signals").delete().eq("id", signalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-sourced-signals"] });
      toast.success("Removed from Workbench.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Remove failed."),
  });

  // Eligible recipients: anyone with a task_manager_type that maps to a
  // seeded Agenda focus area. Same filter the per-row Send picker uses,
  // so the two surfaces stay symmetrical.
  const eligibleStaff = useMemo(
    () =>
      staff.filter(
        (s) => s.task_manager_type && agendaFocusByManager.has(s.task_manager_type),
      ),
    [staff, agendaFocusByManager],
  );

  // Group signals by the manager_type embedded in their source. Each
  // staffer has a unique manager_type now (post-split), so this maps
  // 1:1 to the staff panels rendered below.
  const signalsByManagerType = useMemo(() => {
    const m = new Map<string, AgendaSignal[]>();
    for (const s of signals) {
      const mt = managerTypeFromSource(s.source);
      if (!m.has(mt)) m.set(mt, []);
      m.get(mt)!.push(s);
    }
    return m;
  }, [signals]);

  const totalPending = signals.filter((s) => s.status === "Pending").length;

  const handleRemove = async (signalId: string) => {
    setRemovingId(signalId);
    try {
      await removeMutation.mutateAsync(signalId);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 px-4 py-3 transition-colors"
          title="Open Workbenches"
        >
          <Briefcase className="w-4 h-4" />
          <span className="text-sm font-semibold">Workbenches</span>
          {totalPending > 0 && (
            <span className="ml-1 text-[10px] font-bold bg-white/20 rounded-full px-1.5 py-0.5 tabular-nums">
              {totalPending}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="bg-neutral-900 border-white/10 text-white w-full sm:max-w-md overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-white text-base font-bold">
            Workbenches
          </SheetTitle>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Items pushed from the agenda live on each staff Workbench. Status
            syncs both ways — reviewing the task on the agenda flips the
            signal Complete, and vice versa.
          </p>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          {eligibleStaff.length === 0 && (
            <p className="text-xs text-zinc-500 italic text-center py-6">
              No Workbenches are configured yet.
            </p>
          )}

          {eligibleStaff.map((s) => {
            const userSignals = s.task_manager_type
              ? signalsByManagerType.get(s.task_manager_type) || []
              : [];
            const pending = userSignals.filter((sig) => sig.status === "Pending");
            const completed = userSignals.filter((sig) => sig.status === "Complete");

            return (
              <div
                key={s.user_id}
                className="rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden"
              >
                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.06]">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0"
                    style={{ background: colorForUserId(s.user_id) }}
                  >
                    {initialsOf(s.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {s.full_name}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {s.job_title || s.task_manager_type}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold tabular-nums text-white">
                      {pending.length}
                    </p>
                    <p className="text-[9px] uppercase tracking-wider text-zinc-500">
                      Pending
                    </p>
                  </div>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
                  </div>
                ) : pending.length === 0 && completed.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic text-center py-4">
                    No items on this Workbench yet.
                  </p>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {pending.map((sig) => (
                      <div
                        key={sig.id}
                        className="flex items-center gap-2 px-3 py-2 group/sig"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">
                            {sig.title}
                          </p>
                          <p className="text-[10px] text-zinc-500 truncate">
                            {sig.source}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemove(sig.id)}
                          disabled={removingId === sig.id}
                          className="shrink-0 p-1 rounded text-zinc-500 hover:text-red-400 opacity-0 group-hover/sig:opacity-100 focus:opacity-100 disabled:opacity-50 transition-opacity"
                          title="Remove from Workbench"
                        >
                          {removingId === sig.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    ))}
                    {completed.length > 0 && (
                      <details className="px-3 py-2 group">
                        <summary className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 cursor-pointer select-none">
                          {completed.length} completed
                        </summary>
                        <div className="mt-1.5 space-y-1">
                          {completed.map((sig) => (
                            <div
                              key={sig.id}
                              className="flex items-center gap-2 group/sig"
                            >
                              <p className="text-xs text-zinc-500 line-through truncate flex-1">
                                {sig.title}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleRemove(sig.id)}
                                disabled={removingId === sig.id}
                                className="shrink-0 p-0.5 rounded text-zinc-600 hover:text-red-400 opacity-0 group-hover/sig:opacity-100 focus:opacity-100 disabled:opacity-50 transition-opacity"
                                title="Remove from Workbench"
                              >
                                {removingId === sig.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <X className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
