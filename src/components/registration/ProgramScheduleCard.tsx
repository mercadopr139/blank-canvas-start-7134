// The published schedule, shown to a family right after they register for a
// partner program (Hawk Squad today). It prints straight from the program's
// preset dates in programs.ts -- the same list the admin calendar starts from
// -- grouped by season and month, with weeks visibly clustered so a phone
// screen reads it at a glance. Renders nothing for a program with no preset
// schedule (BAM), so the generated forms can always include it.
//
// It shows the PUBLISHED schedule, not days a coach has flipped on the admin
// calendar; the "subject to change" line covers those.
import type { ProgramConfig } from "@/lib/programs";
import { CalendarDays } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "6, 7, 8 · 13, 14, 15": days of one month, a dot between weeks. */
const clusterDays = (days: number[]): string => {
  const sorted = [...days].sort((a, b) => a - b);
  let out = "";
  sorted.forEach((d, i) => {
    if (i === 0) { out = String(d); return; }
    const gap = d - sorted[i - 1];
    out += (gap > 2 ? " · " : ", ") + d;
  });
  return out;
};

const ProgramScheduleCard = ({ program }: { program: ProgramConfig }) => {
  const dates = program.scheduleDates ?? [];
  if (dates.length === 0) return null;

  // Season -> month ("2026-10") -> days, in date order.
  const seasons = program.scheduleSeasons ?? [{ name: "Schedule", through: "9999-12-31" }];
  const grouped = seasons.map((s, i) => {
    const from = i === 0 ? "0000-01-01" : seasons[i - 1].through;
    const inSeason = dates.filter((d) => d > from && d <= s.through).sort();
    const months: { label: string; days: number[] }[] = [];
    inSeason.forEach((d) => {
      const key = d.slice(0, 7);
      let m = months.find((x) => x.label === key);
      if (!m) { m = { label: key, days: [] }; months.push(m); }
      m.days.push(Number(d.slice(8, 10)));
    });
    return { name: s.name, months };
  }).filter((s) => s.months.length > 0);

  const firstYear = dates[0].slice(0, 4);
  const lastYear = dates[dates.length - 1].slice(0, 4);
  const yearLabel = firstYear === lastYear ? firstYear : `${firstYear}–${lastYear.slice(2)}`;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-5 text-left space-y-4">
      <div className="flex items-center justify-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-lg text-foreground">{yearLabel} {program.name} Schedule</h2>
      </div>
      {grouped.map((s) => (
        <div key={s.name} className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">{s.name}</p>
          {s.months.map((m) => (
            <p key={m.label} className="text-base text-foreground leading-relaxed">
              <span className="font-semibold">{MONTHS[Number(m.label.slice(5, 7)) - 1]}:</span>{" "}
              <span className="tabular-nums">{clusterDays(m.days)}</span>
            </p>
          ))}
        </div>
      ))}
      <p className="text-sm text-muted-foreground border-t border-primary/15 pt-3">
        Schedule is subject to change. We&apos;ll let participants know of any changes.
      </p>
    </div>
  );
};

export default ProgramScheduleCard;
