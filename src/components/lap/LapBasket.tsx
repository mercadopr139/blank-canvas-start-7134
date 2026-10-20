// The Lap's basket on a Workbench (Josh, 2026-10-20): this week's goals,
// all of them, wherever each has been placed. A goal lands here when it is
// set; "Place in" moves it into a focus area, where it wears the Lap flag,
// and it stays listed here with the area's name so it still reads as a
// weekly goal. One row of data, seen twice. Lime + flag = the Lap; the
// green target stays Today's Plan.
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAsk } from "@/components/admin/AskDialog";
import { dropGoal, carryGoalNow, refreshGoals } from "@/lib/lap/goals";
import { Flag, Circle, CheckCircle2, Target, Plus, Forward, X, ChevronDown, ArrowRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LAP_GREEN, LAP_TILE_LABEL } from "@/lib/lap/commitments";

export interface BasketGoal {
  id: string;
  title: string | null;
  status: string;
  source: string | null;
  planned_date: string | null;
  lap_topic_id?: string | null;
  lap_commitment_id?: string | null;
}
export interface BasketArea { key: string; title: string; accent_color: string }

interface Props {
  goals: BasketGoal[];
  /** The focus areas a goal can be placed in (never the basket itself). */
  areas: BasketArea[];
  /** The area a goal currently lives in, or null while it sits in the basket. */
  areaOf: (g: BasketGoal) => BasketArea | null;
  topicTitle: (id: string | null | undefined) => string | undefined;
  todayStr: string;
  onToggle: (g: BasketGoal) => void;
  onTogglePlan: (g: BasketGoal) => void;
  onOpenDetails: (g: BasketGoal) => void;
  onPlace: (g: BasketGoal, area: BasketArea | null) => void;
  onAddGoal: () => void;
}

const LapBasket = ({ goals, areas, areaOf, topicTitle, todayStr, onToggle, onTogglePlan, onOpenDetails, onPlace, onAddGoal }: Props) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { ask, dialog } = useAsk();
  const onCarry = async (g: BasketGoal) => {
    if (!g.lap_commitment_id) return;
    const ok = await ask.confirm({ title: `Move "${g.title ?? "this goal"}" to next week?`, body: "It leaves this lap and waits at the start line of the next one, counted as carried once more.", confirmLabel: "Next week" });
    if (!ok) return;
    const err = await carryGoalNow(g.lap_commitment_id);
    if (err) { toast.error(err); return; }
    toast.success("Moved to next week.");
    refreshGoals(qc);
  };
  const onDrop = async (g: BasketGoal) => {
    if (!g.lap_commitment_id) return;
    const r = await ask.prompt({ title: `Drop "${g.title ?? "this goal"}"?`, body: "It leaves every owner's board.", fields: [{ key: "reason", label: "Why", placeholder: "Optional, for the lap history", required: false }], confirmLabel: "Drop" });
    if (!r) return;
    const err = await dropGoal(g.lap_commitment_id, r.reason.trim() || "Dropped");
    if (err) { toast.error(err); return; }
    toast.success("Dropped.");
    refreshGoals(qc);
  };
  const done = goals.filter((g) => g.status === "Complete").length;
  const ordered = [...goals].sort((a, b) => Number(a.status === "Complete") - Number(b.status === "Complete"));
  return (
    <section
      className="relative rounded-2xl border-2 p-5 max-w-4xl mx-auto mb-5"
      style={{ borderColor: LAP_GREEN, background: `linear-gradient(145deg, ${LAP_GREEN}1f 0%, ${LAP_GREEN}08 100%)` }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${LAP_GREEN}18`, color: LAP_GREEN }}>
          <Flag className="w-5 h-5" strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h2 className="text-base font-extrabold tracking-tight text-white">{LAP_TILE_LABEL}</h2>
          <p className="text-[11px] text-zinc-500 font-medium">This week's goals · place each one where the work happens</p>
        </div>
        <button type="button" onClick={() => navigate("/admin/the-lap")} className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: LAP_GREEN }}>
          Open the Lap <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {goals.length === 0 ? (
        <p className="text-[11px] text-white/25 italic text-center py-4">No weekly goals yet</p>
      ) : (
        <ul className="space-y-0.5">
          {ordered.map((g) => {
            const isComplete = g.status === "Complete";
            const placed = areaOf(g);
            const isPlanned = g.planned_date === todayStr;
            const tag = topicTitle(g.lap_topic_id);
            return (
              <li key={g.id} className="flex items-start gap-2 px-1 py-1 rounded-md hover:bg-white/[0.04] group/row">
                <button type="button" onClick={() => onToggle(g)} className="pt-0.5 shrink-0" title={isComplete ? "Mark incomplete" : "Mark complete"}>
                  {isComplete ? <CheckCircle2 className="w-4 h-4" style={{ color: LAP_GREEN }} /> : <Circle className="w-4 h-4 text-white/30 hover:text-white/60 transition-colors" />}
                </button>
                <button type="button" onClick={() => onOpenDetails(g)} className={`text-sm leading-snug flex-1 min-w-0 break-words text-left hover:text-white transition-colors ${isComplete ? "line-through text-white/30" : "text-white/85"}`} title="View details">
                  {g.title || "Untitled"}
                  {tag && <span className="ml-1.5 inline-block align-middle rounded-full border px-1.5 py-px text-[10px] font-medium max-w-[140px] truncate" style={{ borderColor: `${LAP_GREEN}66`, background: `${LAP_GREEN}1a`, color: LAP_GREEN }}>{tag}</span>}
                  {placed && <span className="ml-1.5 inline-block align-middle rounded-full border px-1.5 py-px text-[10px] font-medium max-w-[140px] truncate" style={{ borderColor: `${placed.accent_color}66`, color: placed.accent_color }}>in {placed.title}</span>}
                </button>
                {!isComplete && (
                  <span className="flex items-center gap-0.5 shrink-0 pt-0.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="inline-flex items-center gap-1 rounded-md border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white/60 hover:text-white hover:border-white/40 transition-colors" title="Place this goal in a focus area">
                          {placed ? "Move" : "Place in"} <ChevronDown className="w-3 h-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 bg-neutral-900 border-white/[0.08] shadow-2xl text-white">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500">Where the work happens</DropdownMenuLabel>
                        {areas.map((a) => (
                          <DropdownMenuItem key={a.key} onSelect={() => onPlace(g, a)} className="cursor-pointer text-white/85 focus:text-white focus:bg-white/10">
                            <span className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ background: a.accent_color }} />{a.title}
                          </DropdownMenuItem>
                        ))}
                        {placed && (
                          <>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem onSelect={() => onPlace(g, null)} className="cursor-pointer text-zinc-400 focus:text-white focus:bg-white/10">Back to the basket</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <button type="button" onClick={() => void onCarry(g)} title="Move to next week" className="text-white/30 hover:text-white"><Forward className="w-4 h-4" /></button>
                      <button type="button" onClick={() => void onDrop(g)} title="Drop this goal" className="text-white/30 hover:text-red-300"><X className="w-4 h-4" /></button>
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onTogglePlan(g)}
                  className={`shrink-0 pt-0.5 transition-colors ${isPlanned ? "text-green-400 hover:text-green-300" : "text-white/20 hover:text-white/60 opacity-0 group-hover/row:opacity-100"}`}
                  title={isPlanned ? "On Today's Plan — click to remove" : "Add to Today's Plan"}
                >
                  {isPlanned ? <Target className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={onAddGoal}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-md border transition-colors hover:bg-white/5"
          style={{ borderColor: `${LAP_GREEN}66`, color: LAP_GREEN }}
          title="Add a weekly goal"
        >
          <Flag className="w-3.5 h-3.5" /> Add a weekly goal
        </button>
        {goals.length > 0 && <span className="text-[11px] text-white/40">{done}/{goals.length} done this week</span>}
      </div>
      {dialog}
    </section>
  );
};

export default LapBasket;
