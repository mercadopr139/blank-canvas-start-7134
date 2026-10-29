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
import { SITE_TEXT } from "@/lib/grantCoach/siteText";
import { approvedSnapshotForWriter } from "@/lib/grantCoach/snapshot";
import { attachmentsForWriter } from "@/lib/grantCoach/attachments";

export interface Review {
  overall: number; verdict: string;
  criteria: { name: string; score: number; max: number; why: string }[];
  weakest: { i: number; problem: string; fix: string; instruction: string }[];
  contradictions: string[]; wrong_numbers: string[]; model: string | null;
  /** Notes the reviewer withdrew in a Reply thread (Josh, 2026-10-29), by note key. */
  withdrawn?: Record<string, { at: string; why: string }>;
}

/** One note of the review a Reply thread is about. Keys: "w:<i>" weakest, "c:<n>" contradiction, "n:<n>" wrong number. */
export interface ReviewNote { key: string; text: string; criterion?: string }
export const noteKeys = {
  weakest: (i: number) => `w:${i}`,
  contradiction: (n: number) => `c:${n}`,
  wrongNumber: (n: number) => `n:${n}`,
};

/** A message in the reviewer's conversation (grant_messages, item_id null, payload.scope "review"). */
export interface ReviewerMsg {
  id: string; role: "user" | "coach"; content: string;
  payload: { scope?: string; note?: string; draft?: string; draft_i?: number; draft_words?: number; sent?: boolean; withdrawn?: boolean; clarification?: boolean } | null;
}
export async function reviewerMessages(folderId: string): Promise<ReviewerMsg[]> {
  const { data, error } = await supabase.from("grant_messages" as never).select("id, role, content, payload").eq("folder_id", folderId).is("item_id", null).eq("payload->>scope", "review").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ReviewerMsg[];
}
/** The facts Josh has settled with the reviewer; the next review treats them as true. */
export const clarificationsOf = (msgs: ReviewerMsg[]) => msgs.filter((m) => m.payload?.clarification).map((m) => m.content);

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
  folder: DraftFolder; library: LibraryEntry[]; facts: Fact[]; caseBrief: CaseBrief | null; funderBrief?: FunderBrief | null; clarifications?: string[];
  application: { i: number; section: string; label: string; help: string | null; kind: string; required: boolean; answer: string | null; limit_kind?: string | null; limit_value?: number | null }[];
}): Promise<Review> {
  const [snapshot, attachments] = await Promise.all([approvedSnapshotForWriter(), attachmentsForWriter()]);
  const { data, error } = await supabase.functions.invoke("grant-writer", { body: { mode: "review", answered: [], ...req, siteText: SITE_TEXT, snapshot, attachments } });
  if (error) {
    let reason = error.message;
    try { const res = (error as { context?: Response }).context; const said = res ? await res.clone().json() : null; if (said?.error) reason = said.error; } catch { /* generic */ }
    throw new Error(reason);
  }
  if (data?.error) throw new Error(data.error);
  return data.review as Review;
}

/** Talk to the reviewer (Josh, 2026-10-29): questions, pushback, and "write it". */
export async function chatWithReviewer(req: {
  folder: DraftFolder; library: LibraryEntry[]; facts: Fact[]; caseBrief: CaseBrief | null; funderBrief?: FunderBrief | null; review: Review | null;
  application: { i: number; section: string; label: string; help: string | null; kind: string; required: boolean; answer: string | null; limit_kind?: string | null; limit_value?: number | null }[];
  messages: { role: "user" | "coach"; content: string }[];
  /** A Reply thread under one note. */
  note?: ReviewNote;
  clarifications?: string[];
}): Promise<{ reply: string; draft: { i: number; text: string; words: number } | null; withdraw: boolean; clarification: string | null; revised: { criterion: string; score: number; overall: number } | null }> {
  const [snapshot, attachments] = await Promise.all([approvedSnapshotForWriter(), attachmentsForWriter()]);
  const { data, error } = await supabase.functions.invoke("grant-writer", { body: { mode: "review_chat", answered: [], ...req, siteText: SITE_TEXT, snapshot, attachments } });
  if (error) {
    let reason = error.message;
    try { const res = (error as { context?: Response }).context; const said = res ? await res.clone().json() : null; if (said?.error) reason = said.error; } catch { /* generic */ }
    throw new Error(reason);
  }
  if (data?.error) throw new Error(data.error);
  return {
    reply: data.reply as string,
    draft: (data.draft ?? null) as { i: number; text: string; words: number } | null,
    withdraw: !!data.withdraw,
    clarification: (data.clarification ?? null) as string | null,
    revised: (data.revised ?? null) as { criterion: string; score: number; overall: number } | null,
  };
}
