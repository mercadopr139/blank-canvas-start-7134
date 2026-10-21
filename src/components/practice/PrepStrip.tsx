// What to drag out before the session starts — a pill on the wall boards.
//
// Closed, it is one line: "Prep · drag out first · 7 items". Tap it and the
// kit chips and the coach's note unfold beside it; tap again to close. Closed
// by default and remembered per screen, so the wall gives its height to the
// workout (Josh, 2026-10-20: the open strip made the board busy).
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const KEY = "prep-strip-open";
const readOpen = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const writeOpen = (v: boolean) => { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* no storage */ } };

export const PrepStrip = ({
  equipment, note, accent,
}: {
  equipment: string[];
  note: string | null | undefined;
  accent: string;
}) => {
  const [open, setOpen] = useState<boolean>(readOpen);
  if (!equipment.length && !note) return null;
  const toggle = () => { setOpen((o) => { writeOpen(!o); return !o; }); };
  return (
    <div className="shrink-0 flex items-start gap-3 flex-wrap">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors hover:bg-white/[0.06]"
        style={{ color: accent, borderColor: `${accent}55`, backgroundColor: `${accent}10` }}
      >
        Prep · drag out first
        {equipment.length > 0 && <span className="normal-case tracking-normal font-semibold opacity-80">· {equipment.length} item{equipment.length === 1 ? "" : "s"}</span>}
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && equipment.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {equipment.map((e) => (
            <span key={e} className="rounded-md border border-white/15 bg-white/[0.05] px-2 py-0.5 text-sm text-white/90">
              {e}
            </span>
          ))}
        </div>
      )}
      {open && note && (
        <p className="text-sm text-white/80 leading-snug basis-full md:basis-auto md:ml-auto">
          <span className="text-white/45 font-semibold">Coach&apos;s note · </span>{note}
        </p>
      )}
    </div>
  );
};
