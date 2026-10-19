// The standing checklist under a checkpoint (Josh, 2026-10-19): what we
// look at every week at this topic. One flat level — lines, ticked as they
// are reviewed, reset each lap because the tick belongs to the lap. A line
// that needs doing becomes a commitment ("+"); it never grows children.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Check, Circle, Plus, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { useAsk } from "@/components/admin/AskDialog";

const NLA_RED = "#bf0f3e";

export interface ChecklistItem { id: string; title: string; sort_order: number }

interface Props {
  lapId: string;
  topicId: string;
  ask: ReturnType<typeof useAsk>["ask"];
  /** Turn a line into a commitment: the page prefills its "Add a commitment" box. */
  onMakeCommitment: (title: string) => void;
}

const LapChecklist = ({ lapId, topicId, ask, onMakeCommitment }: Props) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["lap-checklist", topicId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lap_checklist_items" as never).select("id, title, sort_order").eq("topic_id", topicId).is("retired_at", null).order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as ChecklistItem[];
    },
  });
  const { data: ticked = [] } = useQuery({
    queryKey: ["lap-checklist-ticks", lapId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lap_checklist_ticks" as never).select("item_id").eq("lap_id", lapId);
      if (error) throw error;
      return ((data ?? []) as unknown as { item_id: string }[]).map((r) => r.item_id);
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["lap-checklist", topicId] });
    qc.invalidateQueries({ queryKey: ["lap-checklist-ticks", lapId] });
  };

  const toggle = async (item: ChecklistItem) => {
    const isTicked = ticked.includes(item.id);
    const { error } = isTicked
      ? await supabase.from("lap_checklist_ticks" as never).delete().eq("lap_id", lapId).eq("item_id", item.id)
      : await supabase.from("lap_checklist_ticks" as never).insert({ lap_id: lapId, item_id: item.id, ticked_by: user?.id ?? null } as never);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  const add = async () => {
    const title = draft.trim();
    if (!title) return;
    setBusy(true);
    const { error } = await supabase.from("lap_checklist_items" as never).insert({ topic_id: topicId, title, sort_order: items.length, created_by: user?.id ?? null } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setDraft("");
    refresh();
  };
  const rename = async (item: ChecklistItem) => {
    const r = await ask.prompt({ title: "Rename this line", fields: [{ key: "title", label: "Line", defaultValue: item.title, required: true }], confirmLabel: "Save" });
    const title = r?.title?.trim();
    if (!title || title === item.title) return;
    const { error } = await supabase.from("lap_checklist_items" as never).update({ title, updated_at: new Date().toISOString() } as never).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  const remove = async (item: ChecklistItem) => {
    const ok = await ask.confirm({ title: `Remove "${item.title}" from this checkpoint?`, body: "It leaves the list for every lap from now on. Past laps keep their record.", confirmLabel: "Remove", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("lap_checklist_items" as never).update({ retired_at: new Date().toISOString() } as never).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const done = items.filter((i) => ticked.includes(i.id)).length;

  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-bold text-sm uppercase tracking-wide text-white/60">Every week, we look at</h3>
        {items.length > 0 && <span className={`text-xs font-semibold ${done === items.length ? "text-emerald-300" : "text-white/40"}`}>{done}/{items.length} reviewed</span>}
      </div>
      {items.length === 0 && <p className="text-sm text-white/35">Nothing standing here yet. Add the lines you review every week at this checkpoint.</p>}
      <ul className="space-y-1">
        {items.map((item) => {
          const isTicked = ticked.includes(item.id);
          return (
            <li key={item.id} className="group flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-white/[0.04]">
              <button onClick={() => void toggle(item)} className={`shrink-0 ${isTicked ? "text-emerald-300" : "text-white/35 hover:text-white"}`} aria-label={isTicked ? "Not reviewed yet" : "Reviewed"}>
                {isTicked ? <Check className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
              </button>
              <span className={`flex-1 min-w-0 text-sm truncate ${isTicked ? "text-white/45" : "text-white/85"}`}>{item.title}</span>
              <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button onClick={() => onMakeCommitment(item.title)} title="Make this a commitment" aria-label="Make this a commitment" className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"><Plus className="w-4 h-4" /></button>
                <button onClick={() => void rename(item)} title="Rename" aria-label="Rename" className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => void remove(item)} title="Remove from this checkpoint" aria-label="Remove" className="p-1 rounded text-white/50 hover:text-red-300 hover:bg-white/10"><X className="w-4 h-4" /></button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2 pt-2 border-t border-white/10">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void add(); }} placeholder="Add a line we review every week…" className="bg-neutral-950 border-neutral-800 text-white" />
        <Button size="sm" onClick={() => void add()} disabled={busy || !draft.trim()} className="text-white" style={{ backgroundColor: NLA_RED }}>Add</Button>
      </div>
      <p className="text-[11px] text-white/35">Same lines every lap; ticks reset each Monday. Hover a line: + turns it into a commitment with an owner.</p>
    </section>
  );
};

export default LapChecklist;
