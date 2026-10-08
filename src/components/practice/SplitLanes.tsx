// A block's two lanes — one group doing two things at once (Tuesday's Battle
// Team: some coach the Junior Boxers, the rest run), or Thursday's Bible study
// (boys with one leader, girls with another). The editor and the board both use
// these, so lanes look the same everywhere; the block's category picks the
// default lane names.
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseSplit, serializeSplit, capFirst, laneDefaults, type SplitLane } from "@/lib/practicePlan";
import { handleIndentKey } from "@/lib/indentTextarea";

/** Two side-by-side mini-columns: lane name, who, drills. Saves on blur. */
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
  const commit = () => {
    // Lane names settle into sentence case as they're saved.
    const tidy = lanes.map((l) => ({ ...l, title: capFirst(l.title) }));
    if (tidy.some((l, i) => l.title !== lanes[i].title)) setLanes(tidy);
    const v = serializeSplit(tidy, defaults);
    if (v !== (detail || null)) onSave(v);
  };
  // Lanes are SUB-divisions of the Split column, and they look like it: indented
  // behind a thin rule in the group's colour, small muted sub-labels, boxes a
  // size down from the column's own. The column header stays the loud thing.
  const quiet = `border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 ${
    dark ? "text-white placeholder:text-white/30" : "text-white placeholder:text-neutral-600"
  }`;
  const box = dark
    ? "bg-black/60 border-white/15 text-white placeholder:text-white/30"
    : "bg-neutral-950 border-neutral-800 text-white placeholder:text-neutral-600";

  return (
    <div className="ml-1 pl-2.5 space-y-2.5" style={{ borderLeft: `2px solid ${accent}66` }}>
      {lanes.map((l, i) => {
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-baseline gap-2">
              {/* Bold gray, sentence case — a sub-heading under the column's
                  coloured header, not a second header. */}
              <Input
                value={l.title}
                onChange={(e) => patch(i, "title", e.target.value)}
                onBlur={commit}
                className={`h-6 flex-1 min-w-0 px-0 text-[12px] font-bold ${quiet} ${dark ? "!text-white/60" : "!text-neutral-400"}`}
              />
              <Input
                value={l.who}
                onChange={(e) => patch(i, "who", e.target.value)}
                onBlur={commit}
                className={`h-6 w-[45%] min-w-0 px-0 text-[11px] text-right ${quiet}`}
              />
            </div>
            <Textarea
              value={l.text}
              onChange={(e) => patch(i, "text", e.target.value)}
              onBlur={commit}
              onKeyDown={handleIndentKey}
              rows={2}
              className={`min-h-[48px] resize-none px-2.5 py-1.5 text-[13px] rounded-md ${box}`}
            />
          </div>
        );
      })}
    </div>
  );
};

/** The two lanes as the wall sees them. Sized in em so the board's fit pass scales it. */
export const SplitLanesView = ({
  detail, category = "Split", accent,
}: { detail: string | null; category?: string; accent: string }) => {
  const lanes = parseSplit(detail, laneDefaults(category));
  return (
    <div className="grid grid-cols-2 gap-[0.6em]">
      {lanes.map((l, i) => {
        const lines = l.text.split("\n").map((s) => s.trim().replace(/^[-*>•]\s*/, "")).filter(Boolean);
        return (
          <div key={i} className="rounded-lg border p-[0.5em]" style={{ borderColor: `${accent}44`, background: `${accent}0d` }}>
            <p className="text-[0.7em] font-bold text-white/60 leading-tight">
              {capFirst(l.title) || `Lane ${i + 1}`}
            </p>
            {l.who && <p className="text-[0.75em] text-white/60 leading-snug">{l.who}</p>}
            {lines.length ? (
              <ul className="mt-[0.3em] text-[0.95em] leading-snug text-white space-y-[0.15em]">
                {lines.map((t, k) => (
                  <li key={k} className="flex items-start gap-[0.4em]">
                    <span className="shrink-0 rounded-full" style={{ width: "0.3em", height: "0.3em", marginTop: "0.55em", backgroundColor: accent }} />
                    <span className="flex-1">{t}</span>
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
