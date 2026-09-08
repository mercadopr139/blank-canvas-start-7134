// Logging, from the gym floor.
//
// Two numbers a session and no more: what they lifted, and one result for the
// circuit. A youth finds their name, their track is already selected, they tap
// steppers rather than a keyboard, and they are done in under a minute. Anything
// longer does not get filled in with thirty kids waiting to box.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Search, Loader2, Check, Minus, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  NbtDay, DayKey, Track, TRACKS, TRACK_META, NbtLogSet, blankSets, ResultUnit,
} from "@/lib/nbt";

interface Youth {
  id: string;
  child_first_name: string;
  child_last_name: string;
}

const NbtLogSheet = ({
  open, onClose, day, dayKey, date, weekId,
}: {
  open: boolean;
  onClose: () => void;
  day: NbtDay | undefined;
  dayKey: DayKey;
  date: string;
  weekId: string | null;
}) => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Youth[]>([]);
  const [searching, setSearching] = useState(false);
  const [youth, setYouth] = useState<Youth | null>(null);
  const [track, setTrack] = useState<Track>("charlie");
  const [sets, setSets] = useState<NbtLogSet[]>(blankSets(3));
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setSearch(""); setResults([]); setYouth(null);
    setSets(blankSets(3)); setResult("");
  };

  // Name search goes through the same kiosk RPC the other boards use, so this
  // screen never needs to read the registrations table.
  useEffect(() => {
    if (youth || search.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.rpc("search_kiosk_youth", { _search: search.trim() });
      setResults(((data as Youth[]) || []).slice(0, 8));
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search, youth]);

  // Their assigned track is pre-selected, and anything they already logged today
  // comes back — so a second visit edits rather than duplicates.
  const pick = async (y: Youth) => {
    setYouth(y);
    const [{ data: level }, { data: existing }] = await Promise.all([
      supabase.from("nbt_athlete_levels" as never).select("level").eq("registration_id", y.id).maybeSingle(),
      supabase.from("nbt_logs" as never).select("*").eq("workout_date", date).eq("registration_id", y.id).maybeSingle(),
    ]);
    const prior = existing as unknown as { level: Track; sets: NbtLogSet[]; work_result: number | null } | null;
    setTrack(prior?.level ?? ((level as unknown as { level: Track })?.level ?? "charlie"));
    setSets(prior?.sets?.length ? prior.sets : blankSets(3));
    setResult(prior?.work_result != null ? String(prior.work_result) : "");
  };

  const movement = day?.lift?.[track];
  const unit = (day?.work?.result_unit ?? "rounds") as ResultUnit;

  const bump = (i: number, field: "weight" | "reps", by: number) =>
    setSets((prev) =>
      prev.map((s, j) =>
        j === i ? { ...s, [field]: Math.max(0, (s[field] ?? 0) + by) } : s
      )
    );

  const save = async () => {
    if (!youth) return;
    setSaving(true);
    const { error } = await supabase.from("nbt_logs" as never).upsert(
      {
        week_id: weekId,
        workout_date: date,
        day_key: dayKey,
        registration_id: youth.id,
        athlete_name: `${youth.child_first_name} ${youth.child_last_name}`,
        // The track trained TODAY, not whatever they are assigned now — so
        // moving up to Alpha in week three doesn't rewrite week one.
        level: track,
        lift: movement?.name ?? null,
        sets,
        work_result: result === "" ? null : Number(result),
        work_unit: result === "" ? null : unit,
      } as never,
      { onConflict: "workout_date,registration_id" } as never
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${youth.child_first_name} logged.`);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="bg-neutral-950 border-neutral-800 text-white max-w-md max-h-[90vh] overflow-y-auto px-5 pb-6">
        <DialogHeader>
          <DialogTitle>
            {youth ? `${youth.child_first_name} ${youth.child_last_name}` : "Who's logging?"}
          </DialogTitle>
          <DialogDescription className="text-white/40">
            {youth ? movement?.name ?? "Today's lift" : "Find your name"}
          </DialogDescription>
        </DialogHeader>

        {!youth ? (
          <div className="space-y-2 pb-1">
            <div className="relative px-0.5">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type your first name…"
                autoFocus
                className="pl-9 h-12 text-lg bg-neutral-900 border-neutral-800 text-white"
              />
            </div>
            {searching && <p className="text-white/30 text-sm px-1">Looking…</p>}

            {results.length > 0 && (
              <div className="divide-y divide-neutral-800 rounded-lg border border-neutral-800 overflow-hidden">
                {results.map((y) => (
                  <button
                    key={y.id}
                    onClick={() => pick(y)}
                    className="w-full text-left px-4 py-3 text-lg hover:bg-white/5"
                  >
                    {y.child_first_name} {y.child_last_name}
                  </button>
                ))}
              </div>
            )}

            {!searching && search.trim().length >= 2 && results.length === 0 && (
              <p className="px-1 py-2 text-white/35">No match. Check the spelling.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Their track, pre-selected. Switchable, because a coach can move
                someone up on the day. */}
            <div className="grid grid-cols-3 gap-1.5">
              {TRACKS.map((t) => {
                const m = TRACK_META[t];
                const on = t === track;
                return (
                  <button
                    key={t}
                    onClick={() => setTrack(t)}
                    className="rounded-lg border py-2 text-sm font-bold transition-colors"
                    style={{
                      borderColor: on ? m.color : "rgba(255,255,255,0.1)",
                      backgroundColor: on ? `${m.color}22` : "transparent",
                      color: on ? m.color : "rgba(255,255,255,0.45)",
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* The lift. Steppers, not a keyboard — this happens with chalk on
                the hands and a queue behind you. */}
            <div>
              <p className="text-[11px] uppercase tracking-[0.15em] text-white/35 font-bold mb-1.5">
                {movement?.name} <span className="text-white/20">{movement?.detail}</span>
              </p>
              <div className="space-y-1.5">
                {sets.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-10 text-xs text-white/30 font-bold">SET {s.set}</span>
                    <Stepper
                      label="lb"
                      value={s.weight}
                      onDown={() => bump(i, "weight", -5)}
                      onUp={() => bump(i, "weight", 5)}
                    />
                    <Stepper
                      label="reps"
                      value={s.reps}
                      onDown={() => bump(i, "reps", -1)}
                      onUp={() => bump(i, "reps", 1)}
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => setSets((p) => [...p, { set: p.length + 1, weight: null, reps: null }])}
                className="mt-1.5 text-xs font-semibold text-white/30 hover:text-white/70"
              >
                + another set
              </button>
              <p className="text-[11px] text-white/20 mt-1">
                Bodyweight? Leave the weight alone and just log reps.
              </p>
            </div>

            {/* One number for the circuit. */}
            <div>
              <p className="text-[11px] uppercase tracking-[0.15em] text-white/35 font-bold mb-1.5">
                {day?.work?.title || "Work"} — how many {unit}?
              </p>
              <Input
                type="number"
                inputMode="numeric"
                value={result}
                onChange={(e) => setResult(e.target.value)}
                placeholder={unit}
                className="h-12 text-lg bg-neutral-900 border-neutral-800 text-white"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={reset}
                className="text-white/40 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Someone else
              </Button>
              <Button
                onClick={save}
                disabled={saving}
                className="flex-1 h-12 font-bold text-white text-base"
                style={{ backgroundColor: TRACK_META[track].color }}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5 mr-1.5" /> Done</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Stepper = ({
  label, value, onDown, onUp,
}: {
  label: string;
  value: number | null;
  onDown: () => void;
  onUp: () => void;
}) => (
  <div className="flex-1 flex items-center rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
    <button onClick={onDown} className="px-3 py-2 text-white/40 hover:text-white hover:bg-white/5">
      <Minus className="w-4 h-4" />
    </button>
    <span className="flex-1 text-center tabular-nums">
      <span className={`text-lg font-bold ${value == null ? "text-white/20" : "text-white"}`}>
        {value ?? "—"}
      </span>
      <span className="text-[10px] text-white/25 ml-1">{label}</span>
    </span>
    <button onClick={onUp} className="px-3 py-2 text-white/40 hover:text-white hover:bg-white/5">
      <Plus className="w-4 h-4" />
    </button>
  </div>
);

export default NbtLogSheet;
