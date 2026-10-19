// The ring: the track the meeting runs around. Three coloured stretches, a
// marker per topic, the stretch behind the runner filled solid, the runner
// itself, and a flag count where commitments were made. Pure drawing — the
// page decides what the current checkpoint is.
import { arcPath, checkpoints, pointAt, segments, type Checkpoint, type RingTopic } from "@/lib/lap/ring";
import { PILLAR_COLOR } from "@/lib/lap/commitments";

const LapRing = ({
  topics,
  currentIndex,
  visited,
  flags,
  finished = false,
  onPick,
  size = 560,
}: {
  topics: RingTopic[];
  /** Index in running order of the checkpoint the runner stands on; -1 before the start. */
  currentIndex: number;
  visited: Set<string>;
  /** Commitments made per topic id. */
  flags: Record<string, number>;
  finished?: boolean;
  onPick?: (cp: Checkpoint) => void;
  size?: number;
}) => {
  const cx = size / 2, cy = size / 2;
  const r = size * 0.4;
  const segs = segments(topics);
  const cps = checkpoints(topics);
  const current = cps[currentIndex];
  // The filled stretch runs from the start line to the runner (or all the way when finished).
  const progressTo = finished ? 1 : current ? current.t : 0;
  const start = pointAt(0, cx, cy, r);
  const runner = finished ? start : current ? pointAt(current.t, cx, cy, r) : start;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" className="max-h-[70vh]" role="img" aria-label="The lap">
      {/* The dim track, per pillar. */}
      {segs.map((s) => (
        <path key={`dim-${s.pillar}`} d={arcPath(s.from, s.to, cx, cy, r)} fill="none" stroke={PILLAR_COLOR[s.pillar]} strokeOpacity={0.22} strokeWidth={size * 0.055} strokeLinecap="butt" />
      ))}
      {/* The stretch already run, solid. */}
      {segs.map((s) => {
        const to = Math.min(s.to, progressTo);
        if (to <= s.from) return null;
        return <path key={`on-${s.pillar}`} d={arcPath(s.from, to, cx, cy, r)} fill="none" stroke={PILLAR_COLOR[s.pillar]} strokeWidth={size * 0.055} strokeLinecap="butt" />;
      })}
      {/* Pillar boundaries. */}
      {segs.map((s) => {
        const p1 = pointAt(s.from, cx, cy, r * 0.93), p2 = pointAt(s.from, cx, cy, r * 1.07);
        return <line key={`b-${s.pillar}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#0a0a0a" strokeWidth={size * 0.012} />;
      })}
      {/* The start / finish line. */}
      <line x1={pointAt(0, cx, cy, r * 0.9).x} y1={pointAt(0, cx, cy, r * 0.9).y} x2={pointAt(0, cx, cy, r * 1.1).x} y2={pointAt(0, cx, cy, r * 1.1).y} stroke="#ffffff" strokeWidth={size * 0.008} strokeDasharray={`${size * 0.012} ${size * 0.008}`} />
      {/* Checkpoints. */}
      {cps.map((cp) => {
        const p = pointAt(cp.t, cx, cy, r);
        const done = visited.has(cp.id);
        const isCurrent = cp.index === currentIndex && !finished;
        const n = flags[cp.id] ?? 0;
        return (
          <g key={cp.id} onClick={onPick ? () => onPick(cp) : undefined} style={onPick ? { cursor: "pointer" } : undefined}>
            <circle cx={p.x} cy={p.y} r={size * (isCurrent ? 0.024 : 0.016)} fill={done || isCurrent ? PILLAR_COLOR[cp.pillar] : "#0a0a0a"} stroke={done || isCurrent ? "#ffffff" : PILLAR_COLOR[cp.pillar]} strokeOpacity={done || isCurrent ? 1 : 0.6} strokeWidth={size * 0.005} />
            {n > 0 && (
              <g transform={`translate(${pointAt(cp.t, cx, cy, r * 1.16).x} ${pointAt(cp.t, cx, cy, r * 1.16).y})`}>
                <circle r={size * 0.02} fill="#ffffff" />
                <text textAnchor="middle" dominantBaseline="central" fontSize={size * 0.024} fontWeight={800} fill="#0a0a0a">{n}</text>
              </g>
            )}
            <title>{cp.title}</title>
          </g>
        );
      })}
      {/* The runner. */}
      <circle cx={runner.x} cy={runner.y} r={size * 0.034} fill="#ffffff" stroke="#0a0a0a" strokeWidth={size * 0.006}>
        {!finished && <animate attributeName="r" values={`${size * 0.03};${size * 0.038};${size * 0.03}`} dur="1.6s" repeatCount="indefinite" />}
      </circle>
    </svg>
  );
};

export default LapRing;
