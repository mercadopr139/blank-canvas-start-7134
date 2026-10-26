// By School District, as a circle (Josh, 2026-10-26) — without the sloppy
// look of long district names squeezed around a pie. The circle carries no
// text at all: every name sits in the list beside it, full length, with its
// count, its share and the districts inside each group. Groups match the
// Youth-per-District map (src/lib/districtGroups.ts).
//
// Colours: Josh's choice per district, shades validated (dataviz skill), slices in
// an order where every neighbouring pair passes the colour-blind
// check. Each group keeps its colour
// whatever its size — colour follows the district, never its rank.
import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { GROUP_LABEL, GROUP_COLOR, groupOf, shortDistrict, type GroupKey } from "@/lib/districtGroups";

/**
 * Josh's colours for each district (2026-10-26), shades tuned so every pair of
 * neighbouring slices passes the colour-blind check on the dark card (dataviz
 * validator). The ORDER is part of that: green sits between lavender and blue,
 * never against orange or red; the two blues never touch.
 */
const SLICES: { g: GroupKey; color: string }[] = (
  ["lowercape", "middle", "catholic", "woodbine", "wildwood", "avalon", "ocean", "home", "tech"] as GroupKey[]
).map((g) => ({ g, color: GROUP_COLOR[g] }));
const SURFACE = "#141414";

interface Row { g: GroupKey; name: string; color: string; count: number; parts: { name: string; count: number }[] }

export default function DistrictDonut({ districts }: { districts: (string | null | undefined)[] }) {
  const [hover, setHover] = useState<GroupKey | null>(null);

  const { rows, total } = useMemo(() => {
    const byGroup = new Map<GroupKey, Map<string, number>>();
    for (const d of districts) {
      const g = groupOf(d);
      const name = (d ?? "").trim() || "Unknown";
      if (!byGroup.has(g)) byGroup.set(g, new Map());
      const m = byGroup.get(g)!;
      m.set(name, (m.get(name) ?? 0) + 1);
    }
    const rows: Row[] = SLICES.filter((s) => byGroup.has(s.g)).map((s) => {
      const parts = [...byGroup.get(s.g)!.entries()].map(([name, count]) => ({ name: shortDistrict(name), count })).sort((a, b) => b.count - a.count);
      return { g: s.g, name: GROUP_LABEL[s.g].name, color: s.color, count: parts.reduce((n, p) => n + p.count, 0), parts };
    });
    return { rows, total: rows.reduce((n, r) => n + r.count, 0) };
  }, [districts]);

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  // The list reads biggest first; the circle keeps the fixed palette order.
  const list = [...rows].sort((a, b) => b.count - a.count);

  if (!total) return <p className="text-sm text-white/40 py-8 text-center">No school districts recorded yet.</p>;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(220px,300px)_1fr] items-center">
      {/* The circle: no text on it, the total in the middle */}
      <div className="relative w-full max-w-[300px] mx-auto aspect-square">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="count"
              nameKey="name"
              innerRadius="62%"
              outerRadius="96%"
              startAngle={90}
              endAngle={-270}
              stroke={SURFACE}
              strokeWidth={2}
              isAnimationActive={false}
              onMouseEnter={(_, i) => setHover(rows[i]?.g ?? null)}
              onMouseLeave={() => setHover(null)}
            >
              {rows.map((r) => (
                <Cell key={r.g} fill={r.color} opacity={hover && hover !== r.g ? 0.35 : 1} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                const r = active && payload?.[0] ? (payload[0].payload as Row) : null;
                if (!r) return null;
                return (
                  <div className="rounded-lg border border-white/15 bg-neutral-950/95 px-3 py-2 text-xs shadow-xl">
                    <p className="font-semibold text-white flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: r.color }} />{r.name}</p>
                    <p className="text-white/70 mt-0.5 tabular-nums">{r.count} youth · {pct(r.count)}%</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-black text-white tabular-nums leading-none">{total}</p>
          <p className="text-[11px] uppercase tracking-wide text-white/50 mt-1">youth</p>
        </div>
      </div>

      {/* Every name, full length, in a list — this is also the table view */}
      {/* Read left to right in one glance: colour, share, name (Josh, 2026-10-26: the
          percentage first and bigger, the count smaller, both right beside the name).
          Kept compact so the eye never travels across the card to find a number. */}
      <ul className="max-w-xl divide-y divide-white/[0.06]" aria-label="Youth by school district">
        {list.map((r) => (
          <li
            key={r.g}
            className={`py-2.5 flex items-start gap-3 transition-opacity ${hover && hover !== r.g ? "opacity-45" : ""}`}
            onMouseEnter={() => setHover(r.g)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="mt-1.5 w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: r.color }} />
            <span className="w-14 shrink-0 text-right text-xl font-black text-white tabular-nums leading-none mt-0.5">{pct(r.count)}%</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-snug">
                {r.name}
                <span className="ml-2 text-[12px] font-normal text-white/50 tabular-nums">{r.count} youth</span>
              </p>
              {(r.parts.length > 1 || r.parts[0]?.name !== r.name) && (
                <p className="text-[12px] text-white/45 leading-snug mt-0.5">
                  {r.parts.map((p) => `${p.name} ${p.count}`).join(" · ")}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
