// Grant Coach learns from Josh's edits (Josh, 2026-10-24): "if I modify it,
// there is a reason." When Josh approves an answer he changed, Grant Coach
// reads its own draft against his and writes down only the lessons that
// apply beyond this one answer ("year-round, never year around"). They go
// into the Grant Vault's "Josh's corrections" field, one per line, which
// every draft follows. Josh sees, edits and deletes them in the Vault.
import { supabase } from "@/integrations/supabase/client";

export const CORRECTIONS_KEY = "corrections";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** An edit worth learning from: Grant Coach wrote it, Josh changed it. */
export const isEdit = (before: string | null | undefined, after: string | null | undefined) =>
  !!before?.trim() && !!after?.trim() && norm(before) !== norm(after);

/** The rules on file, one per line, without bullets. */
export const parseRules = (value: string | null | undefined) =>
  (value ?? "").split("\n").map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()).filter(Boolean);

/** Add new rules to the list, skipping any already there (same words, any case or punctuation). */
export const mergeRules = (existing: string[], fresh: string[]) => {
  const seen = new Set(existing.map(norm));
  const out = [...existing];
  for (const r of fresh.map((x) => x.trim()).filter(Boolean)) {
    if (seen.has(norm(r))) continue;
    seen.add(norm(r));
    out.push(r);
  }
  return out;
};

export async function loadRules(): Promise<string[]> {
  const { data } = await supabase.from("grant_org_fields" as never).select("value").eq("key", CORRECTIONS_KEY).maybeSingle();
  return parseRules((data as { value: string | null } | null)?.value);
}

/** Save the new rules into the Vault; returns the ones actually added. */
export async function addRules(fresh: string[], userId: string | null): Promise<string[]> {
  const existing = await loadRules();
  const merged = mergeRules(existing, fresh);
  const added = merged.slice(existing.length);
  if (!added.length) return [];
  const { error } = await supabase.from("grant_org_fields" as never).upsert(
    { key: CORRECTIONS_KEY, value: merged.join("\n"), updated_at: new Date().toISOString(), updated_by: userId } as never,
    { onConflict: "key" } as never,
  );
  if (error) throw new Error(error.message);
  return added;
}
