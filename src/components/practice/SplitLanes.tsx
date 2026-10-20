// A block's two lanes — one group doing two things at once (Tuesday's Battle
// Team: some coach the Junior Boxers, the rest run), or Thursday's Bible study
// (boys with one leader, girls with another). The editor and the board both use
// these, so lanes look the same everywhere; the block's category picks the
// default lane names.
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, X } from "lucide-react";
import { parseSplit, serializeSplit, capFirst, laneDefaults, MIN_LANES, MAX_LANES, NEW_LANE, type SplitLane } from "@/lib/practicePlan";
import { parseBullets, levelIndent, levelDot, levelText } from "@/lib/bulletText";
import BulletEditor from "./BulletEditor";

/** Two or three mini-columns: lane name, who, drills. Saves on blur. The names are
 *  typed over, and look it: a pencil on hover, an underline while editing (Josh, 2026-10-20). */
export const SplitLanesEditor = ({
  detail, category = "Split", accent, dark = false, onSave,
}: {
  detail: string | null;
  /** The block's name — decides the starting lane names. */
  category?: string;
  accent: string;
  /** The board's black surface rather than the editor's neutral one. */
  dark?: boolean;
  onSave: (detail: string | null) => void;
}) => {
  const defaults = laneDefaults(category);
  const [lanes, setLanes] = useState<SplitLane[]>(() => parseSplit(detail, defaults));
  const patch = (i: number, field: keyof SplitLane, value: string) =>
    setLanes((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  const commitWith = (next: SplitLane[]) => {
    // Lane names settle into sentence case as they're saved.
    const tidy = next.map((l) => ({ ...l, title: capFirst(l.title) }));
    if (tidy.some((l, i) => l.title !== next[i].title)) setLanes(tidy);
    const v = serializeSplit(tidy, defaults);
    if (v !== (detail || null)) onSave(v);
  };
  const commit = () => commitWith(lanes);
  const addLane = () => { if (lanes.length >= MAX_LANES) return; const next = [...lanes, { ...NEW_LANE }]; setLanes(next); commitWith(next); };
  const removeLane = (i: number) => { if (lanes.length <= MIN_LANES) return; const next = lanes.filter((_, idx) => idx !== i); setLanes(next); commitWith(next); };
  // A lane's drills arrive from its bullet editor when focus leaves it.
  const saveText = (i: number, text: string | null) => {
    const next = lanes.map((l, idx) => (idx === i ? { ...l, text: text ?? "" } : l));
    setLanes(next);
    commitWith(next);
  };
  // Lanes are SUB-divisions of the Split column, and they look like it: indented
  // behind a thin rule in the group's colour, small muted sub-labels, boxes a
  // size down from the column's own. The column header stays the loud thing.
  const quiet = `border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 ${
    dark ? "text-white placeholder:text-white/30" : "text-white placeholder:text-neutral-600"
  }`;
  const editable = "border-b border-transparent hover:border-white/20 focus-visible:border-white/50 rounded-none";
  return (
    <div className="ml-1 pl-2.5 space-y-2.5" style={{ borderLeft: `2px solid ${accent}66` }}>
      {lanes.map((l, i) => {
        return (
          <div key={i} className="space-y-1 group/lane">
            <div className="flex items-baseline gap-2">
              {/* Bold gray, sentence case — a sub-heading under the column's
                  coloured header, not a second header. Typed over to rename. */}
              <span className="relative flex-1 min-w-0 flex items-baseline">
                <Input
                  value={l.title}
                  onChange={(e) => patch(i, "title", e.target.value)}
                  onBlur={commit}
                  placeholder={`Lane ${i + 1} name`}
                  title="Click to rename this lane"
                  className={`h-6 flex-1 min-w-0 px-0 pr-4 text-[12px] font-bold ${quiet} ${editable} ${dark ? "!text-white/60" : "!text-neutral-400"}`}
                />
                <Pencil className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-white/25 opacity-0 group-hover/lane:opacity-100" />
              </span>
              <Input
                value={l.who}
                onChange={(e) => patch(i, "who", e.target.value)}
                onBlur={commit}
                placeholder="who"
                title="Who is in this lane"
                className={`h-6 w-[40%] min-w-0 px-0 text-[11px] text-right ${quiet} ${editable}`}
              />
              {lanes.length > MIN_LANES && (
                <button type="button" onClick={() => removeLane(i)} title="Remove this lane" aria-label="Remove this lane" className="shrink-0 p-0.5 rounded text-white/25 opacity-0 group-hover/lane:opacity-100 hover:text-red-300 hover:bg-white/10">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <BulletEditor
              defaultValue={l.text}
              accent={accent}
              dark={dark}
              textClassName="text-[13px]"
              className="min-h-[48px] !px-2.5 !py-1.5 rounded-md"
              placeholder=""
              onSave={(v) => saveText(i, v)}
            />
          </div>
        );
      })}
      {lanes.length < MAX_LANES && (
        <button type="button" onClick={addLane} className="inline-flex items-center gap-1 text-[11px] text-white/35 hover:text-white">
          <Plus className="w-3 h-3" /> Add a lane
        </button>
      )}
    </div>
  );
};

/** The lanes as the wall sees them, two or three across. Sized in em so the board's fit pass scales it. */
export const SplitLanesView = ({
  detail, category = "Split", accent,
}: { detail: string | null; category?: string; accent: string }) => {
  const lanes = parseSplit(detail, laneDefaults(category));
  return (
    <div className={`grid gap-[0.6em] ${lanes.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {lanes.map((l, i) => {
        const lines = parseBullets(l.text);
        return (
          <div key={i} className="rounded-lg border p-[0.5em]" style={{ borderColor: `${accent}44`, background: `${accent}0d` }}>
            <p className="text-[0.7em] font-bold text-white/60 leading-tight">
              {capFirst(l.title) || `Lane ${i + 1}`}
            </p>
            {l.who && <p className="text-[0.75em] text-white/60 leading-snug">{l.who}</p>}
            {lines.length ? (
              <ul className="mt-[0.3em] text-[0.95em] leading-snug text-white space-y-[0.15em]">
                {lines.map((t, k) => (
                  <li key={k} className="flex items-start gap-[0.4em]" style={{ marginLeft: levelIndent(t.level), ...levelText(t.level) }}>
                    <span className="shrink-0 rounded-full" style={{ width: levelDot(t.level, 0.3).size, height: levelDot(t.level, 0.3).size, marginTop: t.level ? "0.6em" : "0.55em", backgroundColor: accent, opacity: levelDot(t.level, 0.3).opacity }} />
                    <span className="flex-1">{t.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-white/25 italic text-[0.85em]">Coach&apos;s call</p>
            )}
          </div>
        );
      })}
    </div>
  );
};
