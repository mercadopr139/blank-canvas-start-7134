// Edit tonight — on the NBT Workout Plan, on the wall.
//
// A lot can happen on any given night at a youth development center. A
// signed-in coach looks at the plan on the Gym Board, sees it won't work, and
// fixes it right there: retype a line, or hand one track to the generator with
// a one-line note ("no bikes tonight"). Saves go straight into the week's day,
// so the wall and the coach's plan page are the same record. (Josh, 2026-10-03.)
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  DAYS, TRACKS, TRACK_META, NBT_AMBER, type DayKey, type NbtBlock, type NbtDay, type NbtWeek, type Track,
} from "@/lib/nbt";
import { priorWeekBriefs, dayProblem } from "@/lib/nbtCoaching";
import { roomBrief } from "@/lib/nbtRooms";
import { todayNY } from "@/lib/programYear";

const box = "bg-black/60 border-white/15 text-white";
const linesOf = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

export const NbtEditTonight = ({
  week, block, dayKey, day, onSaved,
}: {
  week: NbtWeek;
  block: NbtBlock | null;
  dayKey: DayKey;
  day: NbtDay;
  onSaved: () => void;
}) => {
  const [draft, setDraft] = useState<NbtDay>(day);
  const [saved, setSaved] = useState<string>(JSON.stringify(day));
  const [note, setNote] = useState<Record<Track, string>>({ alpha: "", bravo: "" });
  const [busy, setBusy] = useState<Track | null>(null);

  const save = async (next: NbtDay) => {
    const stamped: NbtDay = { ...next, editedOn: todayNY() };
    const json = JSON.stringify(stamped);
    if (json === saved) return;
    const { error } = await supabase
      .from("nbt_weeks" as never)
      .update({ days: { ...week.days, [dayKey]: stamped } } as never)
      .eq("id", week.id);
    if (error) { toast.error(error.message); return; }
    setSaved(json);
    setDraft(stamped);
    onSaved();
  };
  const commit = () => save(draft);

  const setLift = (t: Track, field: "name" | "detail", value: string) =>
    setDraft((d) => ({ ...d, lift: { ...d.lift, [t]: { ...d.lift[t], [field]: value } } }));
  const setWork = (t: Track, value: string) =>
    setDraft((d) => ({ ...d, work: { ...d.work, [t]: linesOf(value) } }));

  /** One track rewritten by the generator with the coach's note; the other stays. */
  const rewrite = async (t: Track) => {
    const instruction = note[t].trim();
    setBusy(t);
    try {
      const { data: rows } = await supabase
        .from("nbt_weeks" as never)
        .select("*")
        .eq("block_id", week.block_id);
      const weeks = (rows ?? []) as unknown as NbtWeek[];
      const { data: res, error } = await supabase.functions.invoke("nbt-workout", {
        body: {
          dayKey,
          weekInBlock: week.week_in_block,
          blockFocus: block?.focus ?? "",
          priorWeeks: priorWeekBriefs(weeks, dayKey, week.week_in_block),
          roomKit: roomBrief(dayKey),
          onlyTrack: t,
          keepDay: draft,
          ...(instruction ? { instruction } : {}),
        },
      });
      if (error) throw error;
      if (!res?.day) throw new Error(res?.error ?? "Nothing came back.");
      const fresh = res.day as NbtDay;
      const problem = dayProblem(fresh, dayKey, t);
      if (problem) throw new Error(problem);
      const merged: NbtDay = {
        ...draft,
        lift: { ...draft.lift, [t]: fresh.lift[t] },
        work: { ...draft.work, [t]: fresh.work[t] },
      };
      await save(merged);
      setNote((n) => ({ ...n, [t]: "" }));
      toast.success(`${TRACK_META[t].label} rewritten for tonight.`);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn't rewrite that track.");
    } finally {
      setBusy(null);
    }
  };

  const dayLabel = DAYS.find((d) => d.key === dayKey)?.label ?? "";

  return (
    <main className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-3 space-y-4">
      <p className="text-xs text-white/50">
        Editing tonight's plan for {dayLabel}. Changes save as you leave each box and show on the wall right away.
      </p>

      <section>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: NBT_AMBER }}>Warm-up · one per line</p>
        <Textarea
          value={draft.prep.join("\n")}
          onChange={(e) => setDraft((d) => ({ ...d, prep: linesOf(e.target.value) }))}
          onBlur={commit}
          rows={3}
          className={`${box} text-sm`}
        />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TRACKS.map((t) => {
          const m = TRACK_META[t];
          return (
            <section key={t} className="rounded-2xl border-2 p-4 space-y-3" style={{ borderColor: `${m.color}66` }}>
              <h2 className="text-lg font-black uppercase tracking-[0.15em]" style={{ color: m.color }}>{m.label}</h2>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: `${m.color}cc` }}>Lift</p>
                <div className="flex gap-2">
                  <Input
                    value={draft.lift[t]?.name ?? ""}
                    onChange={(e) => setLift(t, "name", e.target.value)}
                    onBlur={commit}
                    className={`${box} flex-1 text-base font-semibold`}
                  />
                  <Input
                    value={draft.lift[t]?.detail ?? ""}
                    onChange={(e) => setLift(t, "detail", e.target.value)}
                    onBlur={commit}
                    className={`${box} w-28 text-base font-black tabular-nums text-center`}
                  />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: `${m.color}cc` }}>Work · one per line</p>
                <Textarea
                  value={(draft.work[t] ?? []).join("\n")}
                  onChange={(e) => setWork(t, e.target.value)}
                  onBlur={commit}
                  rows={5}
                  className={`${box} text-sm`}
                />
              </div>

              {/* The bigger "this isn't going to work" moment: one note, one track rewritten. */}
              <div className="flex gap-2 items-center pt-1">
                <Input
                  value={note[t]}
                  onChange={(e) => setNote((n) => ({ ...n, [t]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") rewrite(t); }}
                  placeholder={`Rewrite ${m.label} with a note — e.g. no bikes tonight`}
                  className={`${box} flex-1 text-sm`}
                />
                <Button
                  onClick={() => rewrite(t)}
                  disabled={busy !== null}
                  className="font-bold text-black shrink-0"
                  style={{ backgroundColor: m.color }}
                >
                  {busy === t ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                  Rewrite
                </Button>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
};
