// One day: the two sessions, the six boxes, the photo and the journal.
//
// Lives on its own rather than inside the calendar because the journal opens it
// too — reading "day 12 was rough" and wanting to see what day 12 actually was
// is the obvious next move.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2, RefreshCw, Check, Camera, Dumbbell, HeartPulse, Home, BookOpen,
  Pencil, Trash2, Plus, X, Eraser,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Hard75Run, Hard75Day, Workout, WorkoutBlock, CHECKLIST, ChecklistKey, doneCount,
  STRENGTH_COLOR, CARDIO_COLOR, MOBILITY_COLOR, isMobilityDay, phaseFor, weightTrend,
} from "@/lib/hard75";
import { Hard75Api } from "@/lib/hard75Api";
import SessionTimer from "@/components/hard75/SessionTimer";

const Hard75DaySheet = ({
  day, days, run, api, onClose,
}: {
  day: Hard75Day | null;
  /** The whole run, so the weight can be shown against day one. */
  days: Hard75Day[];
  run: Hard75Run;
  api: Hard75Api;
  onClose: () => void;
}) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [journal, setJournal] = useState<string | null>(null);
  const [weight, setWeight] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [editing, setEditing] = useState<"strength" | "cardio" | null>(null);
  const [clearing, setClearing] = useState(false);

  const patch = async (patchObj: Record<string, unknown>) => {
    if (!day) return;
    try {
      await api.patchDay(day.id, patchObj);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn’t save that.");
    }
  };

  const toggle = async (key: ChecklistKey) => {
    if (!day) return;
    setBusy(key);
    await patch({ [key]: !day[key] });
    setBusy(null);
  };

  // Rewrite one session. Same body part, same place in the progression — the
  // rest of the 75 days doesn't move.
  const regenerate = async (kind: "strength" | "cardio") => {
    if (!day) return;
    setBusy(kind);
    try {
      const w = kind === "strength" ? day.strength : day.cardio;
      const phase = phaseFor(day.day_number);
      const workout = await api.regenerate({
          kind,
          title: w?.title ?? "",
          focus: w?.focus ?? "",
          dayNumber: day.day_number,
          mobility: kind === "strength" && isMobilityDay(day.day_number),
          sets: phase.sets,
          reps: phase.reps,
          accessoryReps: phase.accessoryReps,
          outdoor: kind === "cardio" ? !!w?.outdoor : undefined,
          age: run.age,
          goal: run.goal,
          limitations: run.limitations,
          avoid: (w?.blocks ?? []).map((b) => b.name),
      });
      if (!workout) { toast.error("Nothing came back."); return; }
      await patch({ [kind]: workout });
      toast.success(`New ${kind} workout for day ${day.day_number}.`);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn't rewrite that.");
    } finally {
      setBusy(null);
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!day) return;
    setUploading(true);
    try {
      const path = await api.uploadPhoto(day.id, day.day_number, file);
      await patch({ photo_path: path });
      toast.success("Photo saved.");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn't upload that.");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    if (!day?.photo_path) return;
    setUploading(true);
    // Out of storage too, not just off the row — an orphaned body photo left
    // on the server is exactly the thing that must not happen.
    await api.removePhoto(day.photo_path);
    await patch({ photo_path: null });
    setUploading(false);
    toast.success("Photo removed.");
  };

  // Ticked the wrong day. Puts it back to untouched without disturbing the
  // workouts, which are part of the plan rather than something he entered.
  const clearDay = async () => {
    if (!day) return;
    if (day.photo_path) await api.removePhoto(day.photo_path);
    await patch({
      strength_done: false, cardio_done: false, outdoor_done: false,
      water_done: false, reading_done: false, diet_done: false,
      photo_path: null, notes: null, completed_at: null,
      strength_seconds: 0, strength_started_at: null,
      cardio_seconds: 0, cardio_started_at: null,
    });
    setJournal("");
    setClearing(false);
    toast.success(`Day ${day.day_number} cleared.`);
  };

  const saveWeight = async () => {
    if (!day || weight === null) return;
    const raw = weight.trim();
    const value = raw === "" ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) return;
    if (value === (day.weight_lb ?? null)) return;
    await patch({ weight_lb: value });
  };

  const saveJournal = async () => {
    if (!day || journal === null) return;
    if (journal.trim() === (day.notes ?? "").trim()) return;
    await patch({ notes: journal.trim() || null });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  if (!day) return null;
  const done = doneCount(day);
  const trend = weightTrend(days);

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) {
          saveJournal();
          saveWeight();
          setJournal(null);
          setWeight(null);
          onClose();
        }
      }}
    >
      <DialogContent className="bg-neutral-950 border-neutral-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-baseline gap-3 flex-wrap">
            <span>Day {day.day_number}</span>
            <span className="text-sm font-normal text-white/40">
              {format(new Date(`${day.date}T12:00:00`), "EEEE d MMMM")}
            </span>
            <span className={`ml-auto text-sm font-bold ${done === 6 ? "text-emerald-400" : "text-white/50"}`}>
              {done} of 6
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <WorkoutCard
            workout={day.strength}
            color={isMobilityDay(day.day_number) ? MOBILITY_COLOR : STRENGTH_COLOR}
            icon={Dumbbell}
            busy={busy === "strength"}
            onRegenerate={() => regenerate("strength")}
            onEdit={() => setEditing("strength")}
            timer={{
              seconds: day.strength_seconds ?? 0,
              startedAt: day.strength_started_at,
              onChange: (t) =>
                patch({ strength_seconds: t.seconds, strength_started_at: t.startedAt }),
            }}
          />
          <WorkoutCard
            workout={day.cardio}
            color={CARDIO_COLOR}
            icon={HeartPulse}
            busy={busy === "cardio"}
            onRegenerate={() => regenerate("cardio")}
            onEdit={() => setEditing("cardio")}
            timer={{
              seconds: day.cardio_seconds ?? 0,
              startedAt: day.cardio_started_at,
              onChange: (t) =>
                patch({ cardio_seconds: t.seconds, cardio_started_at: t.startedAt }),
            }}
          />

          {/* All six, or the day doesn't count. */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-white/35 font-semibold mb-2">
              The day
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {CHECKLIST.map((c) => {
                const on = day[c.key];
                return (
                  <button
                    key={c.key}
                    onClick={() => toggle(c.key)}
                    disabled={busy === c.key}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      on
                        ? "border-emerald-500/40 bg-emerald-500/10 text-white"
                        : "border-white/10 text-white/50 hover:text-white hover:border-white/25"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-md border grid place-items-center shrink-0 ${
                        on ? "bg-emerald-500 border-emerald-500" : "border-white/25"
                      }`}
                    >
                      {busy === c.key ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : on ? (
                        <Check className="w-3.5 h-3.5 text-black" />
                      ) : null}
                    </span>
                    <span className="text-sm font-medium">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Today's weight, above the photo — the scale and the mirror on the
              same morning. Optional: the programme never asks for it, so a day
              without one is a day without one, not a zero. */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[11px] uppercase tracking-[0.15em] text-white/35 font-semibold">
                Today&apos;s weight
              </p>
              {trend && (
                <span
                  className={`text-[11px] font-bold tabular-nums ${
                    trend.change < 0
                      ? "text-emerald-400"
                      : trend.change > 0
                      ? "text-amber-400"
                      : "text-white/35"
                  }`}
                >
                  {trend.change > 0 ? "+" : ""}{trend.change} lb since day one
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={weight ?? (day.weight_lb != null ? String(day.weight_lb) : "")}
                onChange={(e) => setWeight(e.target.value)}
                onBlur={saveWeight}
                placeholder="—"
                className="w-32 h-11 text-lg bg-neutral-900 border-neutral-800 text-white"
              />
              <span className="text-sm text-white/40">lb</span>
            </div>
          </div>

          {/* Photo */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] text-white/35 font-semibold mb-2">
              Progress photo
            </p>
            <label className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5 cursor-pointer hover:border-white/25 transition-colors">
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white/50" />
              ) : (
                <Camera className={`w-4 h-4 ${day.photo_path ? "text-emerald-400" : "text-white/40"}`} />
              )}
              <span className="text-sm text-white/70">
                {day.photo_path ? "Photo saved — tap to replace" : "Upload today's photo"}
              </span>
              {/* No `capture` attribute on purpose.
                  It used to say capture="environment", which forced the phone
                  straight into the REAR camera with no way to reach the photo
                  library — a rear-facing forced camera is close to the worst
                  possible choice for a daily progress selfie.
                  Plain accept="image/*" hands over to the OS picker instead, so
                  he can shoot it with whatever camera app he likes and upload
                  it, or take one there and then. His phone, his choice. */}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPhoto(f);
                  e.target.value = "";
                }}
              />
              {day.photo_path && (
                <span
                  role="button"
                  tabIndex={0}
                  title="Remove this photo"
                  onClick={(e) => { e.preventDefault(); removePhoto(); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); removePhoto(); } }}
                  className="ml-auto text-white/25 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </span>
              )}
            </label>
          </div>

          {/* The journal. Written at the end of the day, and the thing that will
              be worth reading back in November. */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-3.5 h-3.5 text-white/35" />
              <p className="text-[11px] uppercase tracking-[0.15em] text-white/35 font-semibold">
                Journal
              </p>
              {savedFlash && (
                <span className="text-[10px] uppercase tracking-wider text-emerald-400/80 font-bold">
                  Saved
                </span>
              )}
            </div>
            <Textarea
              value={journal ?? day.notes ?? ""}
              onChange={(e) => setJournal(e.target.value)}
              onBlur={saveJournal}
              rows={5}
              placeholder="How did today actually go? Rough, strong, tired, angry — whatever it was. Weights and times too if you want them."
              className="bg-neutral-900 border-neutral-800 text-white text-[15px] leading-relaxed"
            />
            <p className="text-[11px] text-white/25 mt-1">
              Saves when you click away. Everything you write shows up under Journal.
            </p>
          </div>

          {/* Ticked the wrong day, or the wrong day entirely. */}
          <div className="pt-1">
            <button
              onClick={() => setClearing(true)}
              className="text-xs font-semibold text-white/25 hover:text-red-400 transition-colors inline-flex items-center gap-1.5"
            >
              <Eraser className="w-3.5 h-3.5" /> Clear this day
            </button>
          </div>
        </div>

        <EditWorkoutDialog
          workout={editing === "strength" ? day.strength : editing === "cardio" ? day.cardio : null}
          kind={editing}
          onClose={() => setEditing(null)}
          onSave={async (w) => {
            if (!editing) return;
            await patch({ [editing]: w });
            setEditing(null);
            toast.success("Workout updated.");
          }}
        />

        <Dialog open={clearing} onOpenChange={setClearing}>
          <DialogContent className="bg-neutral-950 border-neutral-800 text-white max-w-sm">
            <DialogHeader>
              <DialogTitle>Clear day {day.day_number}?</DialogTitle>
              <DialogDescription className="text-white/50">
                Unticks all six boxes and removes the photo and the journal entry. The workouts stay —
                they are part of the plan, not something you entered.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setClearing(false)} className="text-white/50 hover:text-white">
                Cancel
              </Button>
              <Button onClick={clearDay} className="bg-red-600 hover:bg-red-500 text-white font-bold">
                Clear it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

const WorkoutCard = ({
  workout, color, icon: Icon, busy, onRegenerate, onEdit, timer,
}: {
  workout: Workout | null;
  color: string;
  icon: typeof Dumbbell;
  busy: boolean;
  onRegenerate: () => void;
  onEdit: () => void;
  timer: {
    seconds: number;
    startedAt: string | null;
    onChange: (t: { seconds: number; startedAt: string | null }) => void;
  };
}) => {
  const [showHome, setShowHome] = useState(false);
  if (!workout?.blocks?.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div
        className="px-4 py-2.5 flex items-center gap-2.5 border-b border-white/[0.06]"
        style={{ backgroundColor: `${color}14` }}
      >
        <Icon className="w-4 h-4 shrink-0" style={{ color }} />
        <div className="min-w-0">
          <p className="font-bold leading-tight" style={{ color }}>{workout.title}</p>
          <p className="text-[11px] text-white/35">
            {workout.focus}
            {workout.outdoor && " · outdoors"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <button
            onClick={onEdit}
            title="Edit this workout by hand"
            className="text-white/35 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={onRegenerate}
            disabled={busy}
            title="Write a different workout for this day only"
            className="text-white/35 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            New workout
          </button>
        </div>
      </div>

      <ul className="p-4 space-y-2">
        {workout.blocks.map((b, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3">
            <span className="text-white">
              {b.name}
              {showHome && b.home && (
                <span className="block text-xs text-white/35 mt-0.5">
                  <Home className="w-3 h-3 inline mr-1 -mt-px" />
                  {b.home}
                </span>
              )}
            </span>
            <span className="text-sm text-white/50 tabular-nums shrink-0">{b.detail}</span>
          </li>
        ))}
      </ul>

      {workout.notes && (
        <p className="px-4 pb-3 text-xs text-white/40 italic">{workout.notes}</p>
      )}

      {/* The 45 minutes the program asks for. Lives with the session rather
          than the day, because each one needs its own three-quarters of an
          hour and they happen at different times. */}
      <SessionTimer
        seconds={timer.seconds}
        startedAt={timer.startedAt}
        color={color}
        onChange={timer.onChange}
      />

      {/* A shift at the firehouse should cost the gym, not the session. The
          label has to say what appears, not ask a question — the first time
          anyone read "No gym today?" they had to press it to find out. */}
      {workout.blocks.some((b) => b.home) && (
        <button
          onClick={() => setShowHome((s) => !s)}
          className="w-full px-4 py-2 border-t border-white/[0.06] text-xs font-semibold text-white/35 hover:text-white/70 transition-colors text-left inline-flex items-center gap-1.5"
        >
          <Home className="w-3.5 h-3.5" />
          {showHome ? "Hide dumbbell / bodyweight swaps" : "Show dumbbell / bodyweight swaps"}
        </button>
      )}
    </div>
  );
};

/* ───── Editing a workout by hand ─────
   "New workout" rewrites the whole session; this is for the smaller case — a
   wrong weight, a swapped exercise, one line that shouldn't be there. */

const EditWorkoutDialog = ({
  workout, kind, onClose, onSave,
}: {
  workout: Workout | null;
  kind: "strength" | "cardio" | null;
  onClose: () => void;
  onSave: (w: Workout) => Promise<void>;
}) => {
  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workout) return;
    setTitle(workout.title ?? "");
    setFocus(workout.focus ?? "");
    setBlocks(workout.blocks?.map((b) => ({ ...b })) ?? []);
  }, [workout]);

  const patchBlock = (i: number, field: keyof WorkoutBlock, value: string) =>
    setBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, [field]: value } : b)));

  const submit = async () => {
    if (!workout || !kind) return;
    setSaving(true);
    await onSave({
      ...workout,
      kind,
      title: title.trim() || workout.title,
      focus: focus.trim(),
      blocks: blocks
        .map((b) => ({
          name: b.name.trim(),
          detail: b.detail.trim(),
          home: b.home?.trim() || undefined,
        }))
        .filter((b) => b.name),
    });
    setSaving(false);
  };

  return (
    <Dialog open={!!workout} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-neutral-950 border-neutral-800 text-white max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {kind === "cardio" ? "cardio" : "strength"} workout</DialogTitle>
          <DialogDescription className="text-white/45">
            Only this day. The rest of the plan is untouched.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-white/50">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 bg-neutral-900 border-neutral-800 text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-white/50">Focus</Label>
              <Input
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="Build"
                className="mt-1 bg-neutral-900 border-neutral-800 text-white"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-white/50">Movements</Label>
            <div className="mt-1 space-y-2">
              {blocks.map((b, i) => (
                <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2 space-y-1.5">
                  <div className="flex gap-1.5">
                    <Input
                      value={b.name}
                      onChange={(e) => patchBlock(i, "name", e.target.value)}
                      placeholder="Barbell bench press"
                      className="h-8 flex-1 bg-neutral-900 border-neutral-800 text-white text-sm"
                    />
                    <Input
                      value={b.detail}
                      onChange={(e) => patchBlock(i, "detail", e.target.value)}
                      placeholder="4 × 8-10"
                      className="h-8 w-28 shrink-0 bg-neutral-900 border-neutral-800 text-white text-sm"
                    />
                    <button
                      onClick={() => setBlocks((prev) => prev.filter((_, j) => j !== i))}
                      className="shrink-0 text-white/25 hover:text-red-400 px-1"
                      title="Remove this movement"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <Input
                    value={b.home ?? ""}
                    onChange={(e) => patchBlock(i, "home", e.target.value)}
                    placeholder="Away from the gym — dumbbell floor press"
                    className="h-7 bg-black/40 border-neutral-800 text-white/70 text-xs"
                  />
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() => setBlocks((prev) => [...prev, { name: "", detail: "" }])}
              className="mt-2 w-full bg-transparent border-neutral-800 text-white/50 hover:text-white h-8 text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add a movement
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-white/50 hover:text-white">Cancel</Button>
          <Button
            onClick={submit}
            disabled={saving || blocks.every((b) => !b.name.trim())}
            className="bg-white text-black hover:bg-white/90 font-bold"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Hard75DaySheet;
