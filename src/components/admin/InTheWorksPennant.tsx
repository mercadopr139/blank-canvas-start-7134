import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Flag, Plus, X, Check } from "lucide-react";

// "In the Works" — a personal pennant that hangs in the top-right of the
// Workbench. It's a cross-focus-area watchlist of longer-running initiatives
// (e.g. "Youth chapel construction") the owner wants to revisit to make sure
// they're still progressing. These are NOT tasks: there's no complete state.
// Instead each item tracks last_touched_at, and tapping an item re-stamps it
// "touched now" — the age ("3w ago") is the whole point, a glance-able signal
// of what's stalling. Strictly personal, scoped by owner_email (see the
// workbench_watch_items migration; RLS enforces the per-user scope).

type WatchItem = {
  id: string;
  owner_email: string;
  title: string;
  sort_order: number;
  last_touched_at: string;
  created_at: string;
};

// Accent gold — deliberately different from the focus-area tiles so the
// pennant reads as a distinct, personal banner rather than another tile.
const GOLD = "#e0b341";
// Every item's dot is the same green — this is a plain reminder list, not a
// staleness tracker. The user clears items themselves when they're done.
const GREEN = "#4ade80";

// The date the item was added, e.g. "Jul 1".
const addedOn = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function InTheWorksPennant({ ownerEmail }: { ownerEmail: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["workbench-watch-items", ownerEmail];

  const { data: items = [] } = useQuery<WatchItem[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase.from("workbench_watch_items") as any)
        .select("*")
        .eq("owner_email", ownerEmail)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as WatchItem[];
    },
    enabled: !!ownerEmail,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const addMutation = useMutation({
    mutationFn: async (title: string) => {
      const nextOrder = items.length ? Math.max(...items.map((i) => i.sort_order)) + 10 : 0;
      const { error } = await (supabase.from("workbench_watch_items") as any).insert({
        owner_email: ownerEmail,
        title,
        sort_order: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => { setDraft(""); setAdding(false); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("workbench_watch_items") as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message),
  });

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (t) addMutation.mutate(t);
  };

  return (
    // On large screens this floats in the top-right corner of the workbench;
    // on smaller screens it collapses to a normal centered block above the grid
    // so it never overlaps the tiles.
    <div className="relative mx-auto max-w-md mb-10 lg:mb-0 lg:absolute lg:top-4 lg:right-2 lg:w-96 lg:z-20">
      <div
        className="relative rounded-xl border-2 px-4 pt-3 pb-4"
        style={{
          borderColor: `${GOLD}66`,
          background: `linear-gradient(160deg, ${GOLD}1c 0%, ${GOLD}08 55%, transparent 100%)`,
        }}
      >
        {/* Banner header */}
        <div className="flex items-center gap-2 mb-2.5">
          <Flag className="w-3.5 h-3.5" style={{ color: GOLD }} strokeWidth={2.2} />
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: GOLD }}>
            In the Works
          </h3>
        </div>

        {/* Watch items */}
        {items.length === 0 && !adding ? (
          <p className="text-[11px] text-white/30 italic leading-snug">
            Things you're keeping an eye on across every focus area.
          </p>
        ) : (
          <div className="space-y-1">
            {items.map((item) => {
              return (
                <div key={item.id} className="group/w flex items-start gap-2 py-0.5">
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: GREEN }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-white/85 leading-snug break-words">
                      {item.title}
                    </span>
                    <span className="ml-1.5 text-[10px] font-medium text-white/40">
                      {addedOn(item.created_at)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(item.id)}
                    className="mt-0.5 p-0.5 rounded text-white/20 hover:text-red-400 opacity-0 group-hover/w:opacity-100 transition-opacity shrink-0"
                    title="Remove from In the Works"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add row */}
        {adding ? (
          <form onSubmit={submitAdd} className="mt-2 flex items-center gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setAdding(false); setDraft(""); } }}
              placeholder="e.g. Youth chapel construction"
              disabled={addMutation.isPending}
              className="flex-1 min-w-0 bg-white/5 border border-white/10 focus:border-white/30 rounded px-2 py-1 text-[11px] text-white placeholder:text-white/25 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim() || addMutation.isPending}
              className="p-1 rounded text-white/60 hover:text-white disabled:opacity-30"
              title="Add"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/35 hover:text-white/70 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>
    </div>
  );
}
