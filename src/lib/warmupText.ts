// The Battle Team warm-up ⇄ bullet text.
//
// The warm-up is a list of movements, each with an optional detail
// ("Bar only", "95 × 5"). In the bullet editor a movement is a main bullet
// and its detail sits under it as a sub-bullet (Josh, 2026-10-13: the same
// bullet rule as the Practice Plan). A coach who types "Name — detail" on
// one line, the way the old box asked, still gets both halves.
import { parseBullets, serializeBullets } from "@/lib/bulletText";

export interface WarmupItem {
  name: string;
  detail: string;
}

/** Each movement a main bullet; its detail the sub-bullet under it. */
export const warmupToText = (w: WarmupItem[] | null | undefined): string | null =>
  serializeBullets(
    (w ?? []).flatMap((x) => [
      { text: x.name, level: 0 as const },
      ...(x.detail ? [{ text: x.detail, level: 1 as const }] : []),
    ])
  );

/**
 * Bullets back to the list. A main bullet starts a movement; anything
 * nested under it joins its detail. A main bullet written "Name — detail"
 * (or "Name - detail") is split the way the old box did.
 */
export const textToWarmup = (v: string | null | undefined): WarmupItem[] => {
  const out: WarmupItem[] = [];
  for (const line of parseBullets(v)) {
    if (line.level === 0 || out.length === 0) {
      const [name, ...rest] = line.text.split(/\s+—\s+|\s+-\s+/);
      out.push({ name: name.trim(), detail: rest.join(" — ").trim() });
    } else {
      const last = out[out.length - 1];
      last.detail = last.detail ? `${last.detail} · ${line.text}` : line.text;
    }
  }
  return out;
};
