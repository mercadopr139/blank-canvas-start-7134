// The strip under the Practice Plan title: four pills, one per job the week
// needs before it's ready for the Gym Board. Tap a pill to go do that job.
// It is also the page's only tab bar (Josh, 2026-10-20: a second row of the
// same four names was redundant), so the open tab's pill is drawn as such.
// Reads the verse, Battle Team and NBT state itself; the practice plan's
// state comes from the page, which already has it.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Minus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { weekSteps, weekReady, stepFinished, type WeekStep, type SkippableStep } from "@/lib/weekProgress";

const STATE_CLASS: Record<WeekStep["state"], string> = {
  todo: "border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200",
  doing: "border-amber-500/40 text-amber-300 bg-amber-500/[0.06] hover:bg-amber-500/10",
  done: "border-emerald-500/40 text-emerald-300 bg-emerald-500/[0.06] hover:bg-emerald-500/10",
  skipped: "border-neutral-700 text-neutral-500 bg-neutral-800/40 hover:bg-neutral-800/70",
};

export const WeekProgress = ({
  weekStart, plan, onTab, active,
}: {
  weekStart: string;
  plan: { status: string; filled: number; total: number } | null;
  /** Switch the page to one of its own tabs. */
  onTab: (tab: "week" | "verse" | "bt" | "nbt") => void;
  /** The tab that is open, so its pill reads as selected. */
  active?: "week" | "verse" | "bt" | "nbt" | "template";
}) => {

  const { data: verse = null } = useQuery({
    queryKey: ["week-progress", "verse", weekStart],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("board_verse_weeks" as never)
        .select("theme, is_published")
        .eq("week_start", weekStart)
        .maybeSingle();
      return (data as unknown as { theme: string | null; is_published: boolean } | null) ?? null;
    },
  });

  const { data: battle = null } = useQuery({
    queryKey: ["week-progress", "battle", weekStart],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("strength_weeks" as never)
        .select("status, days")
        .eq("week_start", weekStart)
        .maybeSingle();
      const row = data as unknown as { status: "draft" | "locked"; days: Record<string, unknown> | null } | null;
      return row ? { status: row.status, days: Object.keys(row.days ?? {}).length } : null;
    },
  });

  // NBT: built = this week's row has all three days; locked = the week is locked.
  const { data: nbt = null } = useQuery({
    queryKey: ["week-progress", "nbt", weekStart],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data: wk } = await supabase
        .from("nbt_weeks" as never)
        .select("status, days")
        .eq("week_start", weekStart)
        .maybeSingle();
      const row = wk as unknown as { status?: string; days: Record<string, unknown> | null } | null;
      if (!row) return null;
      const built = Object.keys(row.days ?? {}).length >= 3;
      return { built, locked: row.status === "locked" };
    },
  });

  // "Not this week" (Josh, 2026-11-02): a Monday-and-Thursday week needs no verse and no lift plans,
  // and the strip should not sit at "1 of 4 done" forever. Per week; next week starts clean.
  const qc = useQueryClient();
  const { data: skipped = new Set<SkippableStep>() } = useQuery({
    queryKey: ["week-progress", "skips", weekStart],
    queryFn: async () => {
      const { data } = await supabase.from("week_step_skips" as never).select("step").eq("week_start", weekStart);
      return new Set(((data ?? []) as unknown as { step: SkippableStep }[]).map((r) => r.step));
    },
  });
  const setSkip = useMutation({
    mutationFn: async ({ step, skip }: { step: SkippableStep; skip: boolean }) => {
      const { error } = skip
        ? await supabase.from("week_step_skips" as never).upsert({ week_start: weekStart, step } as never, { onConflict: "week_start,step" } as never)
        : await supabase.from("week_step_skips" as never).delete().eq("week_start", weekStart).eq("step", step);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["week-progress", "skips", weekStart] }); if (v.skip) toast.success("Not this week. It counts as done; undo on the pill."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const steps = weekSteps({ plan, verse, battle, nbt }, skipped);
  const ready = weekReady(steps);
  const tabOf = (s: WeekStep): "week" | "verse" | "bt" | "nbt" =>
    s.key === "plan" ? "week" : s.key === "verse" ? "verse" : s.key === "battle" ? "bt" : "nbt";
  const go = (s: WeekStep) => onTab(tabOf(s));
  // The template is edited from the Practice Plan pill.
  const isOpen = (s: WeekStep) => active === tabOf(s) || (active === "template" && s.key === "plan");

  return (
    <div
      className={`rounded-xl border p-3 flex items-center gap-2 flex-wrap ${
        ready ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-neutral-800 bg-neutral-900"
      }`}
    >
      {steps.map((s, i) => (
        <div
          key={s.key}
          className={`group/pill flex items-center gap-1 rounded-lg border pl-3 pr-1.5 py-2 transition-colors ${STATE_CLASS[s.state]} ${isOpen(s) ? "ring-2 ring-white/70 ring-offset-2 ring-offset-black" : ""}`}
        >
          <button
            type="button"
            onClick={() => go(s)}
            aria-current={isOpen(s) ? "page" : undefined}
            className="flex items-center gap-2.5 text-left min-w-0"
          >
            <span
              className={`h-5 w-5 rounded-full grid place-items-center text-[11px] font-bold shrink-0 ${
                s.state === "done" ? "bg-emerald-500 text-black" : s.state === "skipped" ? "bg-neutral-700 text-neutral-300" : s.state === "doing" ? "bg-amber-500/80 text-black" : "bg-neutral-800 text-neutral-400"
              }`}
            >
              {s.state === "done" ? <Check className="w-3 h-3" /> : s.state === "skipped" ? <Minus className="w-3 h-3" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-semibold leading-tight ${s.state === "skipped" ? "line-through decoration-neutral-600" : ""}`}>{s.title}</span>
              <span className="block text-[11px] opacity-80 leading-tight">{s.status}</span>
            </span>
          </button>
          {/* Not this week — on the three steps a week can do without. Undo on the same spot. */}
          {s.key !== "plan" && (
            <button
              type="button"
              disabled={setSkip.isPending}
              onClick={() => setSkip.mutate({ step: s.key as SkippableStep, skip: s.state !== "skipped" })}
              title={s.state === "skipped" ? "Put it back on this week" : "Not this week — counts as done"}
              className={`ml-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                s.state === "skipped" ? "text-neutral-400 hover:text-white hover:bg-white/10" : "text-neutral-500 opacity-0 group-hover/pill:opacity-100 focus:opacity-100 hover:text-white hover:bg-white/10"
              }`}
            >
              {s.state === "skipped" ? "Undo" : "Not this week"}
            </button>
          )}
        </div>
      ))}
      <p className={`ml-auto text-sm font-semibold ${ready ? "text-emerald-300" : "text-neutral-500"}`}>
        {ready ? "Practice plan is set for the week! ✓" : `${steps.filter(stepFinished).length} of 4 done`}
      </p>
    </div>
  );
};
