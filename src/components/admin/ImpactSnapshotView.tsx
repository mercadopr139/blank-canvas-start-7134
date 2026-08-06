// Renders a youth-reached snapshot (see src/lib/impactSnapshot.ts). Used for
// both the per-form summary (Responses tab) and the aggregate at the bottom of
// the Forms & Waivers list. Dark-surface styling.
import type { SnapshotResult } from "@/lib/impactSnapshot";

// One titled bar-breakdown (label · %/count) for a demographic.
const Breakdown = ({ title, data }: { title: string; data: { name: string; count: number }[] }) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold text-white/60 mb-1.5">{title} <span className="text-white/30">· {total}</span></p>
      <div className="space-y-1.5">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return (
            <div key={d.name} className="flex items-center gap-2">
              <span className="text-[11px] text-white/70 w-32 shrink-0 truncate" title={d.name}>{d.name}</span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden min-w-0"><div className="h-full bg-[#bf0f3e] rounded-full" style={{ width: `${pct}%` }} /></div>
              <span className="text-[11px] font-semibold text-white w-9 text-right tabular-nums">{pct}%</span>
              <span className="text-[10px] text-white/40 w-8 text-right tabular-nums">{d.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const HeadStat = ({ value, label, big, muted }: { value: number; label: string; big?: boolean; muted?: boolean }) => (
  <div>
    <p className={`${big ? "text-3xl" : "text-xl"} font-bold leading-none ${muted ? "text-white/60" : "text-white"}`}>{value.toLocaleString()}</p>
    <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">{label}</p>
  </div>
);

export const ImpactSnapshotView = ({ snap, emptyHint }: { snap: SnapshotResult; emptyHint?: string }) => (
  <div className="rounded-lg border border-[#bf0f3e]/30 bg-[#bf0f3e]/[0.05] p-4 space-y-3">
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
      <HeadStat value={snap.uniqueCount} label="Youth reached" big />
      <HeadStat value={snap.boys} label="Boys" />
      <HeadStat value={snap.girls} label="Girls" />
      <HeadStat value={snap.totalResponses} label="Total responses" muted />
    </div>
    {snap.noKey > 0 && (
      <p className="text-[10px] text-amber-300/70">
        {snap.noKey} response{snap.noKey === 1 ? "" : "s"} had no name + birthday, so each counts as its own head (couldn't de-duplicate).
      </p>
    )}
    {snap.totalResponses === 0 ? (
      <p className="text-xs text-white/40">{emptyHint || "No responses yet — this fills in as youth submit."}</p>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        <Breakdown title="Gender" data={snap.gender} />
        <Breakdown title="Age" data={snap.ageData} />
        <Breakdown title="Race / Ethnicity" data={snap.race} />
        <Breakdown title="School District" data={snap.district} />
        <Breakdown title="Free / Reduced Lunch" data={snap.lunch} />
        <Breakdown title="Household Income" data={snap.income} />
      </div>
    )}
  </div>
);
