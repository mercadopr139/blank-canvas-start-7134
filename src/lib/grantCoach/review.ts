// Grant Coach's reviewer (2026-10-22): before Josh submits, the application is
// read the way the funder's panel will read it. Two layers:
//   1. preSubmitChecks — plain rules, no AI, instant: blank required
//      questions, answers over the limit, answers not yet approved.
//   2. reviewApplication — the skeptical reviewer: a score per criterion, the
//      three weakest answers with fixes, contradictions, numbers that don't
//      match the back end.
import { supabase } from "@/integrations/supabase/client";
import { measure, type CaseBrief, type DraftFolder, type LibraryEntry, type FunderBrief } from "@/lib/grantCoach/writer";
import type { Fact } from "@/lib/grantCoach/liveFacts";
import { LEAVE_BLANK } from "@/lib/grantCoach/answers";

export interface Review {
  overall: number; verdict: string;
  criteria: { name: string; score: number; max: number; why: string }[];
  weakest: { i: number; problem: string; fix: string; instruction: string }[];
  contradictions: string[]; wrong_numbers: string[]; model: string | null;
}

interface Checkable {
  id: string; label: string; required: boolean; status: string; answer: string | null;
  limit_kind?: "words" | "characters" | null; limit_value?: number | null; needs?: string | null;
}

export interface PreSubmit { blank: Checkable[]; over: Checkable[]; unapproved: Checkable[]; needYou: Checkable[] }

/** What would get the application bounced or marked down before anyone reads it. */
export const preSubmitChecks = (items: Checkable[]): PreSubmit => {
  const live = items.filter((i) => i.status !== "na");
  const answered = (i: Checkable) => !!i.answer?.trim() && i.answer.trim() !== LEAVE_BLANK;
  return {
    blank: live.filter((i) => i.required && !answered(i)),
    over: live.filter((i) => answered(i) && !!i.limit_value && measure(i.answer, i.limit_kind) > i.limit_value),
    unapproved: live.filter((i) => answered(i) && i.status !== "done"),
    needYou: live.filter((i) => !!i.needs),
  };
};

/** The skeptical reviewer, on the whole application in portal order. */
export async function reviewApplication(req: {
  folder: DraftFolder; library: LibraryEntry[]; facts: Fact[]; caseBrief: CaseBrief | null; funderBrief?: FunderBrief | null;
  application: { i: number; section: string; label: string; help: string | null; kind: string; required: boolean; answer: string | null; limit_kind?: string | null; limit_value?: number | null }[];
}): Promise<Review> {
  const { data, error } = await supabase.functions.invoke("grant-writer", { body: { mode: "review", answered: [], ...req } });
  if (error) {
    let reason = error.message;
    try { const res = (error as { context?: Response }).context; const said = res ? await res.clone().json() : null; if (said?.error) reason = said.error; } catch { /* generic */ }
    throw new Error(reason);
  }
  if (data?.error) throw new Error(data.error);
  return data.review as Review;
}
