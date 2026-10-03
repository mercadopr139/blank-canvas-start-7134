// The one week picker for the Practice Plan page.
//
// The week is picked here, once, and every tab and both Workout Plans follow
// it — that is how a coach plans next week in order: drills, verse, Battle
// Team, NBT. Arrows go both ways so past weeks stay readable; Today jumps
// home; the label says where you are; the dropdown jumps straight to a week
// and shows what state each one is in. (Josh, 2026-10-03.)
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ChevronDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, mondayOf, planningWeekOf, formatWeekRange, type SeasonMode } from "@/lib/practicePlan";

const WEEKS_BACK = 8;
const WEEKS_AHEAD = 4;

/** "this week", "next week", "2 weeks ago", "in 3 weeks". */
const relativeWeek = (weekStart: string, today: string = mondayOf()): string => {
  const ms = new Date(`${weekStart}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime();
  const n = Math.round(ms / (7 * 24 * 3600 * 1000));
  if (n === 0) return "this week";
  if (n === 1) return "next week";
  if (n === -1) return "last week";
  return n < 0 ? `${-n} weeks ago` : `in ${n} weeks`;
};

export const WeekPicker = ({
  weekStart, season, onChange, action,
}: {
  weekStart: string;
  season: SeasonMode;
  onChange: (weekStart: string) => void;
  /** Something to put on the right — the "Reset entire week" button. */
  action?: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const today = mondayOf();          // the calendar week, for the labels
  const home = planningWeekOf();     // where Today lands: next week from Saturday on
  const isPast = weekStart < today;

  // The weeks on offer, newest first, with the practice plan's state of each.
  const options = Array.from({ length: WEEKS_BACK + WEEKS_AHEAD + 1 }, (_, i) => addDays(today, (WEEKS_AHEAD - i) * 7));
  const { data: statuses = {} } = useQuery({
    queryKey: ["practice-week-statuses", options[options.length - 1], options[0]],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("practice_weeks" as never)
        .select("week_start, status")
        .gte("week_start", options[options.length - 1])
        .lte("week_start", options[0]);
      const out: Record<string, string> = {};
      ((data ?? []) as unknown as { week_start: string; status: string }[]).forEach((r) => { out[r.week_start] = r.status; });
      return out;
    },
  });

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" onClick={() => onChange(addDays(weekStart, -7))} className="text-neutral-400 hover:text-white h-8 w-8" aria-label="Previous week">
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="text-left px-2 rounded-lg hover:bg-white/5 min-w-[220px]" title="Jump to a week">
              <p className="text-white font-bold leading-tight flex items-center gap-1.5">
                Week of {formatWeekRange(weekStart, season)}
                <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
              </p>
              <p className="text-[11px] leading-tight mt-0.5">
                <span className={isPast ? "text-amber-300/80" : "text-neutral-500"}>{relativeWeek(weekStart, today)}</span>
                {isPast && <span className="text-neutral-600"> · past week, still editable</span>}
              </p>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-1.5 bg-neutral-900 border-neutral-700 text-white">
            <div className="max-h-80 overflow-y-auto">
              {options.map((w) => {
                const st = statuses[w];
                const label = st === "published" ? "Published" : st === "draft" ? "Draft" : "Not started";
                const tone = st === "published" ? "text-emerald-300" : st === "draft" ? "text-amber-300" : "text-neutral-600";
                const on = w === weekStart;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => { onChange(w); setOpen(false); }}
                    className={`w-full flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-white/10 ${on ? "bg-white/10" : ""}`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-4 shrink-0">{on && <Check className="w-3.5 h-3.5" />}</span>
                      <span className="truncate">{formatWeekRange(w, season)}</span>
                      <span className="text-[11px] text-neutral-500 shrink-0">{relativeWeek(w, today)}</span>
                    </span>
                    <span className={`text-[11px] font-semibold shrink-0 ${tone}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="icon" onClick={() => onChange(addDays(weekStart, 7))} className="text-neutral-400 hover:text-white h-8 w-8" aria-label="Next week">
          <ChevronRight className="w-4 h-4" />
        </Button>
        {weekStart !== home && (
          <Button variant="ghost" size="sm" onClick={() => onChange(home)} className="text-neutral-400 hover:text-white text-xs" title={home === today ? "This week" : "The week ahead — it is the weekend"}>
            Today
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <p className="text-[11px] text-neutral-500 hidden lg:block">Pick the week once — every tab and both Workout Plans follow it.</p>
        {action}
      </div>
    </div>
  );
};
