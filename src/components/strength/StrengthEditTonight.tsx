// Edit tonight — on the Battle Team Workout Plan, on the wall.
//
// Same idea as the NBT board's: a signed-in coach fixes tonight's plan where
// the kids read it. Retype the bar, the warm-up or the extra work, or hand the
// whole day to the generator with a one-line note. Saves go into the week's
// day, so the wall and the coach's page stay one record. (Josh, 2026-10-03.)
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DAYS, type DayKey, type DayWorkout, type WeekRow } from "@/lib/strength";
import { todayNY } from "@/lib/programYear";

const NLA_RED = "#bf0f3e";
const box = "bg-black/60 border-white/15 text-white";
const linesOf = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);
const label = "text-[11px] font-bold uppercase tracking-[0.18em] mb-1";

/** "Name — detail" lines ⇄ the warm-up list. */
const warmupToText = (w: DayWorkout["warmup"]) => (w ?? []).map((x) => (x.detail ? `${x.name} — ${x.detail}` : x.name)).join("\n");
const textToWarmup = (v: string) =>
  linesOf(v).map((line) => {
    const [name, ...rest] = line.split(/\s+—\s+|\s+-\s+/);
    return { name: name.trim(), detail: rest.join(" — ").trim() };
  });

export const StrengthEditTonight = ({
  week, dayKey, day, onSaved,
}: {
  week: WeekRow;
  dayKey: DayKey;
  day: DayWorkout;
  onSaved: () => void;
}) => {
  const [draft, setDraft] = useState<DayWorkout>(day);
  const [saved, setSaved] = useState<string>(JSON.stringify(day));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (next: DayWorkout) => {
    const stamped: DayWorkout = { ...next, editedOn: todayNY() };
    const json = JSON.stringify(stamped);
    if (json === saved) return;
    const { error } = await supabase
      .from("strength_weeks" as never)
      .update({ days: { ...week.days, [dayKey]: stamped } } as never)
      .eq("id", week.id);
    if (error) { toast.error(error.message); return; }
    setSaved(json);
    setDraft(stamped);
    onSaved();
  };
  const commit = () => save(draft);

  const setMain = (field: "lift" | "scheme", value: string) =>
    setDraft((d) => ({ ...d, main: { lift: "", scheme: "", ...d.main, [field]: value } }));
  const setAccessory = (i: number, field: "name" | "sets", value: string) =>
    setDraft((d) => ({
      ...d,
      accessories: (d.accessories ?? []).map((a, k) => (k === i ? { ...a, [field]: value } : a)),
    }));

  /** The whole day rewritten by the generator with the coach's note. */
  const rewrite = async () => {
    const instruction = note.trim();
    if (!instruction) { toast.error("Say what to change first."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("strength-coach", {
        body: { mode: "revise", dayKey, day: draft, instruction },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const fresh = data?.day as DayWorkout | undefined;
      if (!fresh?.focus) throw new Error("The coach came back empty — try again.");
      await save(fresh);
      setNote("");
      toast.success(`${DAYS.find((d) => d.key === dayKey)?.label} rewritten for tonight.`);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn't rewrite tonight.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-3 space-y-4">
      <p className="text-xs text-white/50">
        Editing tonight's plan. Changes save as you leave each box and show on the wall right away.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-2xl border-2 p-4 space-y-3" style={{ borderColor: `${NLA_RED}66` }}>
          <h2 className="text-lg font-black uppercase tracking-[0.15em]" style={{ color: NLA_RED }}>The bar</h2>
          <div>
            <p className={label} style={{ color: `${NLA_RED}cc` }}>Warm-up · one per line, "name — detail"</p>
            <Textarea
              value={warmupToText(draft.warmup)}
              onChange={(e) => setDraft((d) => ({ ...d, warmup: textToWarmup(e.target.value) }))}
              onBlur={commit}
              rows={3}
              className={`${box} text-sm`}
            />
          </div>
          <div>
            <p className={label} style={{ color: `${NLA_RED}cc` }}>Lift</p>
            <div className="flex gap-2">
              <Input value={draft.main?.lift ?? ""} onChange={(e) => setMain("lift", e.target.value)} onBlur={commit} className={`${box} flex-1 text-base font-semibold`} />
              <Input value={draft.main?.scheme ?? ""} onChange={(e) => setMain("scheme", e.target.value)} onBlur={commit} className={`${box} w-28 text-base font-black tabular-nums text-center`} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border-2 p-4 space-y-3" style={{ borderColor: "#fb718566" }}>
          <h2 className="text-lg font-black uppercase tracking-[0.15em]" style={{ color: "#fb7185" }}>Extra work</h2>
          {(draft.accessories ?? []).map((a, i) => (
            <div key={i} className="flex gap-2">
              <Input value={a.name} onChange={(e) => setAccessory(i, "name", e.target.value)} onBlur={commit} className={`${box} flex-1 text-sm font-semibold`} />
              <Input value={a.sets} onChange={(e) => setAccessory(i, "sets", e.target.value)} onBlur={commit} className={`${box} w-24 text-sm font-black tabular-nums text-center`} />
            </div>
          ))}
          <div>
            <p className={label} style={{ color: "#fb7185cc" }}>Finisher</p>
            <div className="flex gap-2">
              <Input
                value={draft.finisher?.name ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, finisher: { name: e.target.value, detail: d.finisher?.detail ?? "" } }))}
                onBlur={commit}
                className={`${box} flex-1 text-sm font-semibold`}
              />
              <Input
                value={draft.finisher?.detail ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, finisher: { name: d.finisher?.name ?? "", detail: e.target.value } }))}
                onBlur={commit}
                className={`${box} flex-1 text-sm`}
              />
            </div>
          </div>
        </section>
      </div>

      {/* The bigger "this isn't going to work" moment: one note, the day rewritten. */}
      <div className="flex gap-2 items-center">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") rewrite(); }}
          placeholder="Rewrite tonight with a note — e.g. only two racks free, keep it to 20 minutes"
          className={`${box} flex-1 text-sm`}
        />
        <Button onClick={rewrite} disabled={busy} className="font-bold text-white shrink-0" style={{ backgroundColor: NLA_RED }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
          Rewrite tonight
        </Button>
      </div>
    </main>
  );
};
