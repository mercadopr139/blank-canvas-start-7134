// Edit tonight — on the NBT Workout Plan, on the wall.
//
// A lot can happen on any given night at a youth development center. A
// signed-in coach looks at the plan on the Gym Board, sees it won't work, and
// fixes it right there: retype a line, or hand the lift to the generator with
// a one-line note ("no barbells tonight"). Saves go straight into the week's
// day, so the wall and the coach's plan page are the same record. (Josh,
// 2026-10-03.) One group, one lift since 2026-11-09.
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  NBT_AMBER, type DayKey, type NbtBlock, type NbtDay, type NbtWeek, type GroupLift, dayMeta, liftOf, withLift, workLines,
} from "@/lib/nbt";
import { priorWeekBriefs, dayProblem, dayForModel } from "@/lib/nbtCoaching";
import { roomBrief } from "@/lib/nbtRooms";
import { todayNY } from "@/lib/programYear";
import BulletEditor from "@/components/practice/BulletEditor";
import { bulletLinesOf } from "@/lib/bulletText";
import ExercisePicturePicker from "@/components/strength/ExercisePicturePicker";
import { stationPictures } from "@/lib/nbtStations";
import { stationLines, withStations } from "@/lib/nbt";

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
  // A day written for two tracks opens — and saves — as one group, one lift.
  const [draft, setDraft] = useState<NbtDay>(() => withLift(day, {}));
  const [saved, setSaved] = useState<string>(() => JSON.stringify(withLift(day, {})));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

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

  const lift = liftOf(draft);
  const setLift = (field: keyof GroupLift, value: string) =>
    setDraft((d) => withLift(d, { [field]: value }));
  /** An older circuit (a day written before the stations) arrives from its bullet editor when focus leaves it. */
  const saveWork = (value: string | null) => {
    const next: NbtDay = { ...draft, work: { ...draft.work, alpha: bulletLinesOf(value), bravo: [] } };
    setDraft(next);
    save(next);
  };

  /** The Cardio Stations are one shared block: one editor, stored once (Josh, 2026-10-22). */
  const stations = stationLines(draft);
  const stationsNight = stations.length > 0;
  const saveStations = (value: string | null) => {
    // A new station list renumbers the lines, so tonight's hides start fresh.
    const fresh = withStations(draft, bulletLinesOf(value)) as NbtDay;
    const next: NbtDay = { ...fresh, work: { ...fresh.work, hiddenStations: [] } };
    setDraft(next);
    save(next);
  };

  /**
   * Rename one station for tonight only ("1 · The Racks" → "1 · Outside Run",
   * Josh, 2026-10-22). It rewrites that one line of tonight's plan — this
   * week's day, saved like every other Edit-tonight change — so the template
   * and every other night stay as they are.
   */
  const renameStation = (index: number, place: string) => {
    const lines = [...stations];
    const m = lines[index]?.match(/^(Station\s+\d\s*·\s*)([^—]+?)(\s*—\s*.*)$/);
    const clean = place.trim();
    if (!m || !clean || clean === m[2].trim()) return;
    lines[index] = `${m[1]}${clean}${m[3]}`;
    const next = withStations(draft, lines) as NbtDay;
    setDraft(next);
    save(next);
  };

  /** The lift — with its easier and harder versions and its warm-up — rewritten by the generator with the coach's note; the stations stay. */
  const rewrite = async () => {
    const instruction = note.trim();
    setBusy(true);
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
          onlyBlock: "lift",
          keepDay: dayForModel(draft),
          ...(instruction ? { instruction } : {}),
        },
      });
      if (error) throw error;
      if (!res?.day) throw new Error(res?.error ?? "Nothing came back.");
      const fresh = res.day as NbtDay;
      // Whatever was not asked for is put back from tonight's plan: only the
      // lift, its modification, its cues and its warm-up come from the rewrite.
      const relifted = withLift(draft, liftOf(fresh));
      const merged: NbtDay = { ...relifted, prep: fresh.prep, lift: { ...relifted.lift, cues: fresh.lift.cues } };
      const problem = dayProblem(merged, dayKey);
      if (problem) throw new Error(problem);
      await save(merged);
      setNote("");
      toast.success("Lift and warm-up rewritten for tonight.");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn't rewrite the lift.");
    } finally {
      setBusy(false);
    }
  };

  const dayLabel = dayMeta(dayKey).label;

  return (
    <main className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-3 space-y-4">
      <p className="text-xs text-white/50">
        Editing tonight's plan for {dayLabel}. Changes save as you leave each box and show on the wall right away.
      </p>

      <section>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: NBT_AMBER }}>Warm-up for the lift · one per line</p>
        <Textarea
          value={draft.prep.join("\n")}
          onChange={(e) => setDraft((d) => ({ ...d, prep: linesOf(e.target.value) }))}
          onBlur={commit}
          rows={3}
          className={`${box} text-sm`}
        />
      </section>

      {/* One lift for the whole group, and the same lift made easier and harder. */}
      <section className="rounded-2xl border-2 p-4 space-y-3" style={{ borderColor: `${NBT_AMBER}66` }}>
        <h2 className="text-lg font-black uppercase tracking-[0.15em]" style={{ color: NBT_AMBER }}>
          Lift <span className="text-white/40 text-sm tracking-normal font-bold">· everyone</span>
        </h2>

        <div>
          <div className="flex gap-2">
            <Input
              value={lift.name}
              onChange={(e) => setLift("name", e.target.value)}
              onBlur={commit}
              aria-label="The lift"
              className={`${box} flex-1 text-base font-semibold`}
            />
            <Input
              value={lift.detail}
              onChange={(e) => setLift("detail", e.target.value)}
              onBlur={commit}
              aria-label="Sets and reps"
              className={`${box} w-28 text-base font-black tabular-nums text-center`}
            />
          </div>
          {lift.name.trim() && <div className="mt-2"><ExercisePicturePicker name={lift.name} /></div>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(["easier", "harder"] as const).map((k) => (
            <div key={k}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: `${NBT_AMBER}cc` }}>{k === "easier" ? "Make it easier" : "Make it harder"}</p>
              <Input
                value={lift[k]}
                onChange={(e) => setLift(k, e.target.value)}
                onBlur={commit}
                placeholder={k === "easier" ? "Goblet squat with a kettlebell — same sets, 8 reps" : "Add a 3-second pause at the bottom"}
                className={`${box} text-sm`}
              />
            </div>
          ))}
        </div>

        {!stationsNight && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: `${NBT_AMBER}cc` }}>Work · one per line, Tab to nest</p>
            <BulletEditor
              key={`work-${workLines(draft).join("\n")}`}
              defaultValue={workLines(draft).join("\n")}
              accent={NBT_AMBER}
              dark
              textClassName="text-sm"
              className="min-h-[7rem]"
              placeholder="One line per exercise. Enter for the next, Tab to nest."
              onSave={(v) => saveWork(v)}
            />
          </div>
        )}

        {/* The bigger "this isn't going to work" moment: one note, the lift and its warm-up rewritten. */}
        <div className="flex gap-2 items-center pt-1">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") rewrite(); }}
            placeholder="Rewrite the lift and its warm-up with a note — e.g. no barbells tonight"
            className={`${box} flex-1 text-sm`}
          />
          <Button
            onClick={() => rewrite()}
            disabled={busy}
            className="font-bold text-black shrink-0"
            style={{ backgroundColor: NBT_AMBER }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            Rewrite
          </Button>
        </div>
      </section>

      {stationsNight && (
        <section className="rounded-2xl border-2 p-4 space-y-3" style={{ borderColor: `${NBT_AMBER}66` }}>
          <h2 className="text-lg font-black uppercase tracking-[0.15em]" style={{ color: NBT_AMBER }}>
            Cardio Stations <span className="text-white/40 text-sm tracking-normal font-bold">· everyone, one block for the room</span>
          </h2>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: `${NBT_AMBER}cc` }}>Stations · one per line, Tab to nest</p>
            <BulletEditor
              key={`stations-${stations.join("\n")}`}
              defaultValue={stations.join("\n")}
              accent={NBT_AMBER}
              dark
              textClassName="text-sm"
              className="min-h-[7rem]"
              placeholder="The header line, then one station per line."
              onSave={(v) => saveStations(v)}
            />
          </div>

          {/* Tonight's station names: rename one for tonight without touching the template. */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-2 space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">Station names · tonight only</p>
            {stations.map((line, i) => {
              const sm = line.match(/^Station\s+(\d)\s*·\s*([^—]+?)\s*—/);
              if (!sm) return null;
              return (
                <div key={`${i}-${sm[2]}`} className="flex items-center gap-2">
                  <span className="w-6 text-right text-sm font-black" style={{ color: NBT_AMBER }}>{sm[1]}</span>
                  <Input
                    defaultValue={sm[2].trim()}
                    onBlur={(e) => renameStation(i, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className={`${box} h-8 text-sm font-semibold`}
                    aria-label={`Station ${sm[1]} name`}
                  />
                </div>
              );
            })}
          </div>

          {/* The station moves the kids see under "See the stations" — fix any picture here. */}
          {(() => {
            const moves = [...new Set(stationPictures(stations).flatMap((x) => x.moves))];
            return moves.length ? (
              <details className="rounded-lg border border-white/10 bg-black/20 p-2">
                <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">Pictures for the stations ({moves.length})</summary>
                <div className="mt-2 space-y-2">{moves.map((mv) => <ExercisePicturePicker key={mv} name={mv} />)}</div>
              </details>
            ) : null;
          })()}
        </section>
      )}
    </main>
  );
};
