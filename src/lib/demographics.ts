// Single source of truth for how "minority" is counted across the app.
//
// Minority is defined by EXCLUSION: a youth is a minority if their race/ethnicity
// is anything other than "White". This automatically includes every non-white
// category on the registration form — Hispanic or Latino, Black or African
// American, Asian, American Indian or Alaska Native, Native Hawaiian or Other
// Pacific Islander, and Two or More Races — and any category added later, with
// no list to keep in sync. Youth with no race recorded are excluded from both
// sides so percentages stay honest (White % + Minority % = 100%).
//
// Every report that shows a "minority" number should use these helpers so the
// definition lives in exactly one place and can never drift.

export const NON_MINORITY_RACE = "White";

/** True when a recorded race counts as a minority (i.e. anything but White). */
export const isMinorityRace = (race: string | null | undefined): boolean =>
  !!race && race !== NON_MINORITY_RACE;

export interface MinoritySummary {
  total: number;        // youth with a recorded race
  white: number;
  minority: number;
  whitePct: number;     // rounded %, 0 when no data
  minorityPct: number;  // rounded %, 0 when no data
}

/** Summarize minority vs. white across a list of race values. */
export function summarizeMinority(
  races: Array<string | null | undefined>
): MinoritySummary {
  let total = 0;
  let white = 0;
  let minority = 0;
  for (const r of races) {
    if (!r) continue; // no race recorded → excluded from both sides
    total++;
    if (r === NON_MINORITY_RACE) white++;
    else minority++;
  }
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return { total, white, minority, whitePct: pct(white), minorityPct: pct(minority) };
}
