// The weekly-goal window (Josh, 2026-10-19: "weekly goal", never
// "commitment"). One place to make a goal, wherever it is made: the + on a
// checklist line, the gold box at a checkpoint, or the Agenda Meeting tile on
// a Workbench. The goal is one Workbench task per owner, tied by
// lap_commitment_id, under a topic of the lap. Made while a lap is open it
// belongs to that lap; made between laps it waits and joins the next one at
// the start line (AdminTheLap.startLap picks up rows with no lap).
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayNY } from "@/lib/programYear";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, Loader2, Target } from "lucide-react";
import { runningOrder, type RingTopic } from "@/lib/lap/ring";
import { commitmentSourceFor } from "@/lib/lap/commitments";
import { openGoalTitles, sameGoal, refreshGoals } from "@/lib/lap/goals";

const NLA_RED = "#bf0f3e";

export interface WeeklyGoalSeed {
  title?: string;
  /** The topic to start on; otherwise the open lap's current checkpoint, else the first topic. */
  topicId?: string | null;
  /** The checklist line this goal came from, so the line can tick itself when the goal is done. */
  itemId?: string;
}

interface Manager { key: string; display_name: string; owner_name: string | null }
interface TopicRow extends RingTopic { sort_order: number; this_lap_only_lap_id: string | null }
const firstName = (m: Manager) => (m.owner_name ?? m.display_name).split(/[\s:]/)[0];

const WeeklyGoalDialog = ({ open, seed, onClose, onSaved }: { open: boolean; seed: WeeklyGoalSeed | null; onClose: () => void; onSaved?: () => void }) => {
  const qc = useQueryClient();
  const { data: lap = null } = useQuery({
    queryKey: ["lap-open-for-goal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("laps" as never).select("id, current_topic_id").eq("status", "open").order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return (data as unknown as { id: string; current_topic_id: string | null } | null) ?? null;
    },
    enabled: open,
  });
  const { data: allTopics = [] } = useQuery({
    queryKey: ["lap-topics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lap_topics" as never).select("id, pillar, title, sort_order, this_lap_only_lap_id").is("retired_at", null).order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as TopicRow[];
    },
    enabled: open,
  });
  const { data: managers = [] } = useQuery({
    queryKey: ["task-managers-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_managers").select("key, display_name, owner_name").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Manager[];
    },
    enabled: open,
  });
  const order = runningOrder(allTopics.filter((t) => !t.this_lap_only_lap_id || t.this_lap_only_lap_id === lap?.id));
  // The same words already open as a goal? Say so, rather than make a twin.
  const { data: openTitles = [] } = useQuery({ queryKey: ["lap-open-goal-titles"], queryFn: openGoalTitles, enabled: open });

  const [title, setTitle] = useState("");
  const [topicId, setTopicId] = useState<string | null>(null);
  const [owners, setOwners] = useState<Record<string, boolean>>({});
  const [onPlan, setOnPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Each opening starts from its seed.
  useEffect(() => {
    if (!open) return;
    setTitle(seed?.title ?? "");
    setTopicId(seed?.topicId ?? null);
    setOnPlan(false);
  }, [open, seed]);
  useEffect(() => {
    if (open && managers.length && !Object.keys(owners).length) setOwners(Object.fromEntries(managers.map((m) => [m.key, m.key === "PD" || m.key === "PC"])));
  }, [open, managers, owners]);
  const chosenTopic = topicId ?? lap?.current_topic_id ?? order[0]?.id ?? null;
  const twin = title.trim() ? openTitles.find((t) => sameGoal(t, title)) ?? null : null;

  const save = async () => {
    const text = title.trim();
    const keys = managers.map((m) => m.key).filter((k) => owners[k]);
    if (!text) return;
    if (!chosenTopic) { toast.error("The lap has no topics yet."); return; }
    if (!keys.length) { toast.error("Pick at least one owner."); return; }
    setBusy(true);
    const commitmentId = crypto.randomUUID();
    const rows = keys.map((k) => ({
      title: text, source: commitmentSourceFor(k), priority_layer: "Core", signal_type: "Action", status: "Pending", is_archived: false,
      lap_id: lap?.id ?? null, lap_topic_id: chosenTopic, lap_commitment_id: commitmentId, lap_checklist_item_id: seed?.itemId ?? null,
      planned_date: onPlan ? todayNY() : null,
    }));
    const { error } = await supabase.from("signals").insert(rows as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    refreshGoals(qc);
    qc.invalidateQueries({ queryKey: ["lap-open-goal-titles"] });
    const under = order.find((t) => t.id === chosenTopic);
    toast.success(lap ? `Weekly goal set${under && under.id !== seed?.topicId ? ` under ${under.title}` : ""}.` : "Weekly goal set. It joins the next lap at the start line.");
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-[#1a1a2e] border-white/10 text-white" onOpenAutoFocus={(e) => { e.preventDefault(); titleRef.current?.focus(); titleRef.current?.select(); }}>
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2"><Target className="w-5 h-5 text-amber-300" /> Weekly goal</DialogTitle>
          <DialogDescription className="text-white/60">
            Something that gets done this week, by someone. It lands on each owner's Agenda Meeting tile and comes up in next lap's warm-up.
            {!lap && " No lap is open right now, so it waits for the next one."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <div>
            <label className="text-sm text-white/60" htmlFor="goal-title">The goal</label>
            <Input id="goal-title" ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Register for Nationals in Florida" className="mt-1 bg-white/10 border-white/20 text-white" />
            {twin && <p className="mt-1.5 text-[12px] text-amber-300">"{twin}" is already an open goal. Tick that one, or set this anyway.</p>}
          </div>
          <div>
            <p className="text-sm text-white/60">Topic</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="mt-1 w-full flex items-center justify-between rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-white/40">
                  <span className="truncate">{order.find((t) => t.id === chosenTopic)?.title ?? "Pick a topic"}</span>
                  <ChevronDown className="w-4 h-4 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] max-h-72 overflow-y-auto bg-neutral-900 border-white/[0.08] shadow-2xl text-white">
                {order.map((t) => (
                  <DropdownMenuItem key={t.id} onSelect={() => setTopicId(t.id)} className="cursor-pointer text-white/85 focus:text-white focus:bg-white/10">
                    <span className="w-4 mr-1.5 inline-flex justify-center">{t.id === chosenTopic ? <Check className="w-3.5 h-3.5" style={{ color: NLA_RED }} /> : null}</span>
                    {t.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div>
            <p className="text-sm text-white/60">Who owns it</p>
            <div className="mt-1 flex flex-wrap items-center gap-4 text-sm">
              {managers.map((m) => (
                <label key={m.key} className="inline-flex items-center gap-1.5 text-white/80">
                  <input type="checkbox" checked={!!owners[m.key]} onChange={(e) => setOwners((o) => ({ ...o, [m.key]: e.target.checked }))} className="accent-[#bf0f3e]" /> {firstName(m)}
                </label>
              ))}
            </div>
          </div>
          <label className="inline-flex items-center gap-1.5 text-sm text-white/60"><input type="checkbox" checked={onPlan} onChange={(e) => setOnPlan(e.target.checked)} className="accent-[#bf0f3e]" /> On today's plan</label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-white/20 text-white bg-transparent hover:bg-white/10 hover:text-white">Cancel</Button>
          <Button onClick={() => void save()} disabled={busy || !title.trim()} className="text-white" style={{ backgroundColor: NLA_RED }}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} {twin ? "Set it anyway" : "Set the goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WeeklyGoalDialog;
