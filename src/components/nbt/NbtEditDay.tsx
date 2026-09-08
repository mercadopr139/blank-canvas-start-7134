// Editing a day by hand.
//
// Regenerating is for "give me something else"; this is for "swap the incline
// push-up for a knee push-up and make it 3 × 10". When a coach already knows
// exactly what they want, asking a model for it is the slow way round.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { DAYS, DayKey, TRACKS, TRACK_META, NbtDay } from "@/lib/nbt";

/** Textarea in, trimmed lines out. Blank lines are dropped, not stored. */
const linesOf = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

const NbtEditDay = ({
  day, dayKey, weekLabel, onClose, onSave,
}: {
  day: NbtDay | null;
  dayKey: DayKey | null;
  weekLabel: string;
  onClose: () => void;
  onSave: (d: NbtDay) => Promise<void>;
}) => {
  const [draft, setDraft] = useState<NbtDay | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Deep copy, so abandoning the dialog leaves the saved day untouched.
    setDraft(day ? (JSON.parse(JSON.stringify(day)) as NbtDay) : null);
  }, [day]);

  if (!draft || !dayKey) return null;
  const meta = DAYS.find((d) => d.key === dayKey);

  const set = (fn: (d: NbtDay) => void) =>
    setDraft((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as NbtDay;
      fn(next);
      return next;
    });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-neutral-950 border-neutral-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit {meta?.label} — {meta?.title}
          </DialogTitle>
          <DialogDescription className="text-white/40">
            {weekLabel}. Only this day; the rest of the month is untouched.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-white/50">Today&apos;s focus</Label>
              <Input
                value={draft.focus}
                onChange={(e) => set((d) => { d.focus = e.target.value; })}
                className="mt-1 bg-neutral-900 border-neutral-800 text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-white/50">Movement pattern</Label>
              <Input
                value={draft.lift.pattern}
                onChange={(e) => set((d) => { d.lift.pattern = e.target.value; })}
                placeholder="Squat"
                className="mt-1 bg-neutral-900 border-neutral-800 text-white"
              />
            </div>
          </div>

          <Block label="Prep — one line each">
            <Textarea
              value={draft.prep.join("\n")}
              onChange={(e) => set((d) => { d.prep = linesOf(e.target.value); })}
              rows={3}
              className="bg-neutral-900 border-neutral-800 text-white text-sm"
            />
          </Block>

          {/* The lift, one row per track — kept side by side so it is obvious
              they are three progressions of one pattern. */}
          <Block label="Strength — Learn + Lift">
            <div className="space-y-2">
              {TRACKS.map((t) => (
                <div key={t} className="flex gap-2 items-center">
                  <span
                    className="w-16 shrink-0 text-xs font-bold"
                    style={{ color: TRACK_META[t].color }}
                  >
                    {TRACK_META[t].label}
                  </span>
                  <Input
                    value={draft.lift[t].name}
                    onChange={(e) => set((d) => { d.lift[t].name = e.target.value; })}
                    placeholder="Exercise"
                    className="flex-1 h-9 bg-neutral-900 border-neutral-800 text-white text-sm"
                  />
                  <Input
                    value={draft.lift[t].detail}
                    onChange={(e) => set((d) => { d.lift[t].detail = e.target.value; })}
                    placeholder="3 × 8"
                    className="w-28 shrink-0 h-9 bg-neutral-900 border-neutral-800 text-white text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="mt-2">
              <Label className="text-xs text-white/50">Cues — one per line</Label>
              <Textarea
                value={draft.lift.cues.join("\n")}
                onChange={(e) => set((d) => { d.lift.cues = linesOf(e.target.value); })}
                rows={2}
                className="mt-1 bg-neutral-900 border-neutral-800 text-white text-sm"
              />
            </div>
          </Block>

          <Block label="Conditioning">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Input
                value={draft.work.title}
                onChange={(e) => set((d) => { d.work.title = e.target.value; })}
                placeholder="Circuit name"
                className="h-9 bg-neutral-900 border-neutral-800 text-white text-sm"
              />
              <Input
                value={draft.work.emphasis}
                onChange={(e) => set((d) => { d.work.emphasis = e.target.value; })}
                placeholder="intervals · carries · steady aerobic"
                className="h-9 bg-neutral-900 border-neutral-800 text-white text-sm"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {TRACKS.map((t) => (
                <div key={t}>
                  <p className="text-xs font-bold mb-1" style={{ color: TRACK_META[t].color }}>
                    {TRACK_META[t].label}
                  </p>
                  <Textarea
                    value={draft.work[t].join("\n")}
                    onChange={(e) => set((d) => { d.work[t] = linesOf(e.target.value); })}
                    rows={4}
                    placeholder="One line each"
                    className="bg-neutral-900 border-neutral-800 text-white text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="mt-2">
              <Label className="text-xs text-white/50">What athletes write down</Label>
              <Input
                value={String(draft.work.result_unit ?? "")}
                onChange={(e) => set((d) => { d.work.result_unit = e.target.value.trim().toLowerCase(); })}
                placeholder="rounds · minutes · seconds · meters · reps"
                className="mt-1 h-9 bg-neutral-900 border-neutral-800 text-white text-sm"
              />
            </div>
          </Block>

          <Block label="Reset — one line each">
            <Textarea
              value={draft.reset.join("\n")}
              onChange={(e) => set((d) => { d.reset = linesOf(e.target.value); })}
              rows={2}
              className="bg-neutral-900 border-neutral-800 text-white text-sm"
            />
          </Block>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-white/50 hover:text-white">
            Cancel
          </Button>
          <Button
            onClick={async () => {
              setSaving(true);
              await onSave(draft);
              setSaving(false);
            }}
            disabled={saving}
            className="bg-white text-black hover:bg-white/90 font-bold"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Block = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[11px] uppercase tracking-[0.15em] text-white/35 font-semibold mb-1.5">{label}</p>
    {children}
  </div>
);

export default NbtEditDay;
