// Which partner program a Finance billing client is. The Service Calendar uses
// this to overlay real attendance on the days you bill, so an invoice can't
// quietly include a day nobody came (a school cancellation you weren't told
// about) or miss a day they did.
//
// Linked by client NAME for now -- no database change needed. If a client is
// ever renamed, update the keywords here (or we add a proper field later).
import { PROGRAMS, type ProgramConfig } from "@/lib/programs";

const RULES: Array<{ test: RegExp; program: ProgramConfig }> = [
  { test: /cape may (county )?tech|technical high|hawk squad/i, program: PROGRAMS.hawk },
  { test: /special services|\bbam\b/i, program: PROGRAMS.bam },
];

/** The program behind a billing client, or null if it isn't a partner program. */
export const programForClient = (clientName: string | null | undefined): ProgramConfig | null => {
  const name = (clientName ?? "").trim();
  if (!name) return null;
  return RULES.find((r) => r.test.test(name))?.program ?? null;
};

/** Marker kept at the front of a service entry's notes when a day was billed without attendance. */
export const OVERRIDE_PREFIX = "Override:";
export const isOverrideNote = (notes: string | null | undefined) => (notes ?? "").trimStart().startsWith(OVERRIDE_PREFIX);
