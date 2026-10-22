// Grant Coach's card — the gym board shape (StrengthBoard / NBT board): a
// dark card, one tinted header band with a bold uppercase title and a grey
// line under it, the same shade on every card. Only the colour changes:
// Grant Coach is a Finance app, so it wears the Finance pillar blue
// (docs/COLOURS.md). Every section of a grant folder is one of these, so
// they read apart at a glance.
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/** Finance pillar blue (PILLAR_COLOR.finance). */
export const GC_BLUE = "#38bdf8";
/** The header band: Finance blue, deep — the role SHADE plays on the boards. */
export const GC_SHADE = "#0f2433";

interface Props {
  title: ReactNode;
  blurb?: ReactNode;
  /** Controls on the right of the header band. */
  right?: ReactNode;
  /** A small icon before the title, in the blue. */
  icon?: ReactNode;
  /** Collapsible: the header becomes the toggle. */
  open?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
  className?: string;
}

export default function GcCard({ title, blurb, right, icon, open, onToggle, children, className = "" }: Props) {
  const collapsible = onToggle != null;
  const head = (
    <>
      <div className="flex items-start gap-2 min-w-0 flex-1 text-left">
        {collapsible && (open ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-white/50" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-white/50" />)}
        {icon && <span className="mt-0.5 shrink-0" style={{ color: GC_BLUE }}>{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-sm md:text-[15px] font-black uppercase tracking-wide leading-tight text-white">{title}</h2>
          {blurb && <p className="text-[11px] text-white/45 mt-0.5 normal-case tracking-normal font-normal">{blurb}</p>}
        </div>
      </div>
      {right && <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>{right}</div>}
    </>
  );
  const showBody = !collapsible || open;
  return (
    <section className={`rounded-2xl border border-white/15 bg-[#141416] overflow-hidden shadow-[0_0.3em_1.2em_rgba(0,0,0,0.45)] ${className}`}>
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          className={`w-full px-4 py-2.5 flex items-start gap-3 hover:brightness-125 transition ${showBody ? "border-b" : ""}`}
          style={{ background: GC_SHADE, borderColor: `${GC_BLUE}55` }}
        >
          {head}
        </button>
      ) : (
        <div className="px-4 py-2.5 flex items-start gap-3 border-b" style={{ background: GC_SHADE, borderColor: `${GC_BLUE}55` }}>{head}</div>
      )}
      {showBody && children}
    </section>
  );
}
