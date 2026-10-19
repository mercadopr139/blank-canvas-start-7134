// The Lap's ring: where every checkpoint sits, and which stretch belongs to
// which pillar. Pure geometry, so the screen and the tests agree.
//
// The ring is divided among the pillars in proportion to how many
// checkpoints each has (Operations 11, Sales & Marketing 6, Finance 4 of 21
// → Operations is about half the track). The start line is at the top and
// the lap runs clockwise: Operations, then Sales & Marketing, then Finance,
// and the finish line, the Vision, is back at the top.

export type Pillar = "operations" | "sales_marketing" | "finance";
export const PILLAR_ORDER: Pillar[] = ["operations", "sales_marketing", "finance"];
export const PILLAR_LABEL: Record<Pillar, string> = {
  operations: "Operations",
  sales_marketing: "Sales & Marketing",
  finance: "Finance",
};

export interface RingTopic {
  id: string;
  pillar: Pillar;
  title: string;
}

export interface Segment {
  pillar: Pillar;
  /** Fraction of the lap, 0–1, where this pillar's stretch starts and ends. */
  from: number;
  to: number;
  count: number;
}

export interface Checkpoint extends RingTopic {
  /** Position along the lap, 0–1 (0 = the start line, clockwise). */
  t: number;
  /** Index along the whole lap, in running order. */
  index: number;
}

/** The topics in running order: pillar by pillar, each in its own order. */
export const runningOrder = (topics: RingTopic[]): RingTopic[] =>
  PILLAR_ORDER.flatMap((p) => topics.filter((t) => t.pillar === p));

/** Each pillar's stretch of the ring, in proportion to its checkpoints. */
export const segments = (topics: RingTopic[]): Segment[] => {
  const total = topics.length;
  let from = 0;
  return PILLAR_ORDER.map((pillar) => {
    const count = topics.filter((t) => t.pillar === pillar).length;
    const span = total ? count / total : 1 / PILLAR_ORDER.length;
    const seg = { pillar, from, to: from + span, count };
    from += span;
    return seg;
  });
};

/**
 * Where each checkpoint sits: evenly spaced inside its pillar's stretch,
 * the first a half-step in so no marker sits on a pillar boundary.
 */
export const checkpoints = (topics: RingTopic[]): Checkpoint[] => {
  const segs = segments(topics);
  const out: Checkpoint[] = [];
  let index = 0;
  for (const seg of segs) {
    const mine = topics.filter((t) => t.pillar === seg.pillar);
    mine.forEach((t, i) => {
      const t01 = seg.from + ((i + 0.5) / Math.max(1, mine.length)) * (seg.to - seg.from);
      out.push({ ...t, t: t01, index: index++ });
    });
  }
  return out;
};

/** A point on a circle for a lap fraction, with 0 at the top and clockwise. */
export const pointAt = (t: number, cx: number, cy: number, r: number) => {
  const a = t * Math.PI * 2 - Math.PI / 2;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

/** An SVG arc path from lap fraction `from` to `to` on a circle. */
export const arcPath = (from: number, to: number, cx: number, cy: number, r: number): string => {
  const span = Math.max(0, Math.min(1, to) - Math.max(0, from));
  if (span <= 0) return "";
  // A full circle has no single arc; draw it as two halves.
  if (span >= 0.9999) {
    const a = pointAt(0, cx, cy, r), b = pointAt(0.5, cx, cy, r);
    return `M ${a.x} ${a.y} A ${r} ${r} 0 1 1 ${b.x} ${b.y} A ${r} ${r} 0 1 1 ${a.x} ${a.y}`;
  }
  const a = pointAt(from, cx, cy, r), b = pointAt(to, cx, cy, r);
  const large = span > 0.5 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
};

/** Has the runner crossed from one pillar into the next between two checkpoint indexes? */
export const crossedPillar = (order: RingTopic[], fromIndex: number, toIndex: number): Pillar | null => {
  const a = order[fromIndex]?.pillar, b = order[toIndex]?.pillar;
  return a && b && a !== b ? b : null;
};

/**
 * Laps in a row: finished laps whose meeting dates are at most ten days
 * apart, counted back from the most recent. Dates are YYYY-MM-DD.
 */
export const streak = (finishedMeetingDates: string[]): number => {
  const days = [...new Set(finishedMeetingDates)].sort().reverse();
  if (days.length === 0) return 0;
  let n = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = (Date.parse(`${days[i - 1]}T12:00:00Z`) - Date.parse(`${days[i]}T12:00:00Z`)) / 86_400_000;
    if (gap <= 10) n++;
    else break;
  }
  return n;
};
