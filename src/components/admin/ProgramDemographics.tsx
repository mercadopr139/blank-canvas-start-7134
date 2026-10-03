// "Who the students are" — the demographics card on every program
// Intelligence page (Hawk Squad, BAM, Juniors Aftercare).
//
// One shape per question, so the eye reads each one in a glance:
//   Sex                      → two tiles, big number and percent each
//   Race / ethnicity         → one stacked bar with a legend underneath
//   Free or reduced lunch    → one headline percent, "16 of 20" under it
//   Grade, CTE program       → short rows (Hawk Squad / BAM only)
// Everything is in the program's colour; the stacked bar steps that colour
// down so the groups read apart without a second palette.

import type { HawkBreakdown } from "@/lib/hawkSquad";
import { NON_MINORITY_RACE } from "@/lib/demographics";

type Counts = Record<string, number>;

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const sorted = (c: Counts) => Object.entries(c).sort((a, b) => b[1] - a[1]);

/** Steps of the program colour for the stacked bar: solid, then fading. */
const shade = (hex: string, i: number) => {
  const alpha = [1, 0.7, 0.45, 0.28, 0.18, 0.12][i] ?? 0.1;
  const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return `${hex}${a}`;
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">{children}</p>
);

const SexTiles = ({ counts, total, color }: { counts: Counts; total: number; color: string }) => {
  const male = counts["Male"] ?? 0;
  const female = counts["Female"] ?? 0;
  const other = total - male - female;
  return (
    <div>
      <Label>Sex</Label>
      <div className="grid grid-cols-2 gap-3">
        {[["Male", male], ["Female", female]].map(([name, n]) => (
          <div key={name as string} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-3xl font-bold leading-none tabular-nums">{n as number}</p>
            <p className="text-sm text-white/70 mt-1.5">{name as string} <span className="text-white/40">· {pct(n as number, total)}%</span></p>
            <div className="h-1 rounded-full bg-white/5 mt-2 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct(n as number, total)}%`, backgroundColor: color }} />
            </div>
          </div>
        ))}
      </div>
      {other > 0 && <p className="text-[11px] text-white/40 mt-1.5">{other} not given</p>}
    </div>
  );
};

const StackedBar = ({ title, counts, total, color }: { title: string; counts: Counts; total: number; color: string }) => {
  const entries = sorted(counts);
  // Minority: everyone with a recorded race other than White, out of those
  // with a race recorded. The same rule as Attendance Intelligence.
  const recorded = entries.filter(([k]) => k !== "Not given").reduce((a, [, n]) => a + n, 0);
  const minority = recorded - (counts[NON_MINORITY_RACE] ?? 0);
  return (
    <div>
      <Label>{title}</Label>
      <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
        {entries.map(([k, n], i) => (
          <div key={k} title={`${k} · ${n} (${pct(n, total)}%)`} className="h-full" style={{ width: `${pct(n, total)}%`, backgroundColor: shade(color, i) }} />
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {entries.map(([k, n], i) => (
          <div key={k} className="flex items-center gap-2 text-sm min-w-0">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: shade(color, i) }} />
            <span className="text-white/75 truncate" title={k}>{k}</span>
            <span className="ml-auto tabular-nums text-white/90 font-semibold shrink-0">{pct(n, total)}%</span>
            <span className="w-6 text-right tabular-nums text-white/35 text-xs shrink-0">{n}</span>
          </div>
        ))}
      </div>
      {recorded > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
          <p className="text-2xl font-bold leading-none tabular-nums" style={{ color }}>{pct(minority, recorded)}%</p>
          <div className="min-w-0">
            <p className="text-sm text-white/80 leading-tight">Minority</p>
            <p className="text-[11px] text-white/40 leading-tight">{minority} of {recorded} students with a race recorded</p>
          </div>
        </div>
      )}
    </div>
  );
};

const Headline = ({ title, counts, total, color }: { title: string; counts: Counts; total: number; color: string }) => {
  const yes = counts["Yes"] ?? 0;
  const rest = sorted(counts).filter(([k]) => k !== "Yes");
  return (
    <div>
      <Label>{title}</Label>
      <div className="flex items-end gap-3">
        <p className="text-3xl font-bold leading-none tabular-nums" style={{ color }}>{pct(yes, total)}%</p>
        <p className="text-sm text-white/60 pb-0.5">{yes} of {total} students</p>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 mt-2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct(yes, total)}%`, backgroundColor: color }} />
      </div>
      {rest.length > 0 && (
        <p className="text-[11px] text-white/40 mt-1.5">{rest.map(([k, n]) => `${k} ${n}`).join(" · ")}</p>
      )}
    </div>
  );
};

const Rows = ({ title, counts, total, color }: { title: string; counts: Counts; total: number; color: string }) => (
  <div>
    <Label>{title}</Label>
    <div className="space-y-1.5">
      {sorted(counts).map(([k, n]) => (
        <div key={k} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-white/75" title={k}>{k}</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct(n, total)}%`, backgroundColor: color }} />
          </div>
          <span className="w-10 text-right tabular-nums font-semibold text-white/90 shrink-0">{pct(n, total)}%</span>
          <span className="w-6 text-right tabular-nums text-white/35 text-xs shrink-0">{n}</span>
        </div>
      ))}
    </div>
  </div>
);

interface Props {
  breakdown: HawkBreakdown;
  /** Distinct students in the period; every percent is out of this. */
  total: number;
  color: string;
}

const ProgramDemographics = ({ breakdown, total, color }: Props) => {
  const b = breakdown as Partial<Record<string, Counts>>;
  return (
    <div className="space-y-5">
      {b["Grade"] && <Rows title="Grade" counts={b["Grade"]} total={total} color={color} />}
      {b["CTE program"] && <Rows title="CTE program" counts={b["CTE program"]} total={total} color={color} />}
      {b["Sex"] && <SexTiles counts={b["Sex"]} total={total} color={color} />}
      {b["Race / ethnicity"] && <StackedBar title="Race / ethnicity" counts={b["Race / ethnicity"]} total={total} color={color} />}
      {b["Free or reduced lunch"] && <Headline title="Free or reduced lunch" counts={b["Free or reduced lunch"]} total={total} color={color} />}
    </div>
  );
};

export default ProgramDemographics;
