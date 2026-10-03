// The strip under the Practice Plan title: four pills, one per job the week
// needs before it's ready for the Gym Board. Tap a pill to go do that job.
// Reads the verse, Battle Team and NBT state itself; the practice plan's
// state comes from the page, which already has it.
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { weekSteps, weekReady, type WeekStep } from "@/lib/weekProgress";

const STATE_CLASS: Record<WeekStep["state"], string> = {
  todo: "border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200",
  doing: "border-amber-500/40 text-amber-300 bg-amber-500/[0.06] hover:bg-amber-500/10",
  done: "border-emerald-500/40 text-emerald-300 bg-emerald-500/[0.06] hover:bg-emerald-500/10",
};

export const WeekProgress = ({
  weekStart, plan, onTab,
}: {
  weekStart: string;
  plan: { status: string; filled: number; total: number } | null;
  /** Switch the page to one of its own tabs. */
  onTab: (tab: "week" | "verse" | "bt" | "nbt") => void;
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

  const steps = weekSteps({ plan, verse, battle, nbt });
  const ready = weekReady(steps);
  const go = (s: WeekStep) => {
    if (s.key === "plan") onTab("week");
    else if (s.key === "verse") onTab("verse");
    else if (s.key === "battle") onTab("bt");
    else onTab("nbt");
  };

  return (
    <div
      className={`rounded-xl border p-3 flex items-center gap-2 flex-wrap ${
        ready ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-neutral-800 bg-neutral-900"
      }`}
    >
      {steps.map((s, i) => (
        <button
          key={s.key}
          type="button"
          onClick={() => go(s)}
          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${STATE_CLASS[s.state]}`}
        >
          <span
            className={`h-5 w-5 rounded-full grid place-items-center text-[11px] font-bold shrink-0 ${
              s.state === "done" ? "bg-emerald-500 text-black" : s.state === "doing" ? "bg-amber-500/80 text-black" : "bg-neutral-800 text-neutral-400"
            }`}
          >
            {s.state === "done" ? <Check className="w-3 h-3" /> : i + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight">{s.title}</span>
            <span className="block text-[11px] opacity-80 leading-tight">{s.status}</span>
          </span>
        </button>
      ))}
      <p className={`ml-auto text-sm font-semibold ${ready ? "text-emerald-300" : "text-neutral-500"}`}>
        {ready ? "Practice plan is set for the week! ✓" : `${steps.filter((s) => s.state === "done").length} of 4 done`}
      </p>
    </div>
  );
};
