// Grant Coach's reviewer card (rebuilt 2026-10-29 on Josh's words: "When I
// click reviewer, you score. Under each section give me your advice. I have
// the option to address/fix or ignore/submit. Once that happens, this turns
// green and is hidden… I need to see this finished section with a dopamine
// hit so I can move forward").
//
// The plain pre-submit checks (no AI) stay on top. The review is the score
// and, under each of the funder's criteria, two or three short lines of
// advice. Each criterion is settled one of two ways — FIX (work the advice:
// Draft it, chips to the questions, then Done) or SUBMIT AS IS — and then
// turns green and folds away. "N of 7 settled"; at 7 of 7 the green banner.
// Settled stays settled through Review again; the score refreshes, the cards
// stay folded unless reopened. No note lists, no "cleared by you".
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Gavel, AlertTriangle, Check, Wand2, ArrowDownCircle, MessageSquare, Undo2, Eye, PartyPopper, Wrench, SendHorizontal } from "lucide-react";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { preSubmitChecks, reviewApplication, reviewerMessages, clarificationsOf, type Review, type ReviewNote, type ReviewFocus, type Criterion } from "@/lib/grantCoach/review";
import type { CaseBrief, DraftFolder, LibraryEntry, FunderBrief } from "@/lib/grantCoach/writer";
import type { Fact } from "@/lib/grantCoach/liveFacts";
import type { AppItem } from "@/components/admin/grantCoach/GrantApplication";
import ReviewerChat from "@/components/admin/grantCoach/ReviewerChat";

interface Props {
  folderId: string;
  folder: DraftFolder;
  items: AppItem[];
  library: LibraryEntry[];
  getFacts: () => Promise<Fact[]>;
  caseBrief: CaseBrief | null;
  review: Review | null;
  reviewedAt: string | null;
  funderBrief: FunderBrief | null;
  /** Latest change to any answer, to tell a stale review from a current one. */
  lastChange: string | null;
  busy: boolean;
  /** Take Josh to a question on the page. */
  onJump: (id: string) => void;
  /** Draft it: the rewrite goes to the question's conversation as a draft card. */
  onFix: (it: AppItem, w: { problem: string; fix: string; instruction: string }) => Promise<void>;
  userId: string | null;
  /** The reviewer's conversation: a rewrite goes to that question as a draft card. */
  onDraftToQuestion: (it: AppItem, note: string, text: string, words: number) => Promise<void>;
}

/** The Reply thread under a criterion. A top-level component, so an open thread keeps its state while the reviewer is thinking. */
function ReplyThread({ note, open, count, onToggle, chat }: { note: ReviewNote; open: boolean; count: number; onToggle: () => void; chat: Omit<React.ComponentProps<typeof ReviewerChat>, "note"> }) {
  return (
    <div className="mt-1.5 space-y-2">
      <button type="button" onClick={onToggle} className="inline-flex items-center gap-1.5 text-[11px] font-semibold hover:underline underline-offset-2" style={{ color: GC_BLUE }}>
        <MessageSquare className="w-3.5 h-3.5" /> {open ? "Close the reply" : count ? `Reply · ${count} in the thread` : "Reply to the reviewer"}
      </button>
      {open && <ReviewerChat {...chat} note={note} />}
    </div>
  );
}

const tone = (pct: number) => (pct >= 85 ? "#34d399" : pct >= 70 ? GC_BLUE : pct >= 55 ? "#fcd34d" : "#fca5a5");
const criterionKey = (n: number) => `k:${n}`;

/** The reviewer writes "[45]" for the 45th question. Each one becomes a chip that names the question and takes you to it. */
function Refs({ text, live, onJump }: { text: string; live: AppItem[]; onJump: (id: string) => void }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((p, k) => {
        const m = p.match(/^\[(\d+)\]$/);
        if (!m) return <span key={k}>{p}</span>;
        const n = Number(m[1]);
        const it = live[n - 1];
        if (!it) return <span key={k} className="text-white/40">[{n}]</span>;
        const short = it.label.length > 42 ? it.label.slice(0, 40).trimEnd() + "…" : it.label;
        return (
          <button key={k} type="button" onClick={() => onJump(it.id)} title={`Go to ${n}. ${it.label}`} className="inline-flex items-baseline gap-1 align-baseline rounded px-1 -my-0.5 mx-0.5 text-[11px] font-semibold leading-tight hover:bg-white/10" style={{ color: GC_BLUE }}>
            <span className="tabular-nums">{n}</span><span className="font-normal text-white/70">{short}</span>
          </button>
        );
      })}
    </>
  );
}

export default function GrantReviewer({ folderId, folder, items, library, getFacts, caseBrief, review, reviewedAt, funderBrief, lastChange, busy, onJump, onFix, userId, onDraftToQuestion }: Props) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [showSettled, setShowSettled] = useState(false);
  const live = items.filter((i) => i.status !== "na");
  const checks = preSubmitChecks(live);
  const stale = !!review && !!reviewedAt && !!lastChange && lastChange > reviewedAt;
  const waitingForCase = live.filter((i) => i.needs_case && !i.answer?.trim()).length;
  const openIds = new Set([...checks.blank, ...checks.over, ...checks.needYou, ...checks.unapproved].map((i) => i.id));
  const openInOrder = live.filter((i) => openIds.has(i.id));
  const [cursor, setCursor] = useState(0);
  const next = () => { if (!openInOrder.length) return; const k = cursor % openInOrder.length; onJump(openInOrder[k].id); setCursor(k + 1); };
  const ready = !checks.blank.length && !checks.over.length && !checks.unapproved.length && !checks.needYou.length;

  const { data: reviewerMsgs = [] } = useQuery({ queryKey: ["grant-reviewer-chat", folderId], queryFn: () => reviewerMessages(folderId) });
  const clarifications = clarificationsOf(reviewerMsgs);
  const threadCount = (key: string) => reviewerMsgs.filter((m) => m.payload?.note === key).length;
  const refreshReview = () => qc.invalidateQueries({ queryKey: ["grant-folder", folderId] });

  /** How much to flag: what costs points (default) or everything a panel might say. Remembered on this computer. */
  const focusKey = `grant-review-focus:${folderId}`;
  const [focus, setFocusState] = useState<ReviewFocus>(() => { try { return localStorage.getItem(focusKey) === "all" ? "all" : "must_fix"; } catch { return "must_fix"; } });
  const setFocus = (v: ReviewFocus) => { setFocusState(v); try { localStorage.setItem(focusKey, v); } catch { /* private window */ } };

  const decisions = review?.decisions ?? {};
  const criteria = review?.criteria ?? [];
  const settledCount = criteria.filter((c) => decisions[c.name]).length;
  const allSettled = criteria.length > 0 && settledCount === criteria.length;

  const saveReview = async (r: Review, touchedAt = false) => {
    const { error } = await supabase.from("grant_folders" as never).update({ review: r, ...(touchedAt ? { reviewed_at: new Date().toISOString() } : {}) } as never).eq("id", folderId);
    if (error) { toast.error(error.message); return false; }
    refreshReview();
    return true;
  };
  /** Settle a criterion: fixed, or submitted as is. Reopen takes it back. */
  const decide = async (c: Criterion, status: "fixed" | "as_is" | null) => {
    if (!review) return;
    const next = { ...decisions };
    if (status) next[c.name] = { status, at: new Date().toISOString() }; else delete next[c.name];
    setWorking((w) => (w === c.name ? null : w));
    if (await saveReview({ ...review, decisions: next })) {
      if (status === "fixed") toast.success(`${c.name} · fixed and settled.`);
      else if (status === "as_is") toast.success(`${c.name} · submitting as is.`);
    }
  };

  const run = async (fresh = false) => {
    setRunning(true);
    try {
      const changedSince = reviewedAt ? live.map((it, i) => (it.updated_at && it.updated_at > reviewedAt ? i + 1 : 0)).filter(Boolean) : [];
      // A review saved before advice existed (the old shape) is read fresh once.
      const oldShape = !!review && !review.criteria.some((c) => c.advice);
      const prev = !fresh && review && !oldShape ? review : null;
      // What Josh settled "as is" is not raised again: its advice goes to the reviewer as dismissed.
      const dismissed = prev ? prev.criteria.filter((c) => prev.decisions?.[c.name]?.status === "as_is").flatMap((c) => (c.advice ?? []).map((a) => a.text)) : [];
      let r: Review;
      if (prev && changedSince.length === 0) {
        r = prev; // Nothing changed: the review stands. No AI, no churn.
        toast.success("No answer has changed since the last review, so it stands.");
      } else {
        const fromAi = await reviewApplication({
          folder, library, facts: await getFacts(), caseBrief, funderBrief, clarifications,
          previousReview: prev, changedSince, dismissed, focus,
          application: live.map((it, i) => ({ i: i + 1, section: it.section, label: it.label, help: it.detail, kind: it.kind, required: it.required, answer: it.answer, limit_kind: it.limit_kind, limit_value: it.limit_value })),
        });
        if (prev) {
          // Enforced: advice is new only on a question changed since the last review; the rest carries over word for word.
          const changed = new Set(changedSince);
          const cites = (a: { i: number[] }) => a.i.some((n) => changed.has(n));
          const merged = fromAi.criteria.map((c) => {
            const old = prev.criteria.find((o) => o.name === c.name);
            const keep = (old?.advice ?? []).filter((a) => !cites(a));
            const fresh = (c.advice ?? []).filter((a) => cites(a) || !old);
            return { ...c, advice: [...keep, ...fresh].slice(0, 4) };
          });
          // Settled stays settled; a "fixed" criterion whose questions changed reopens only if new advice arrived.
          const kept: Review["decisions"] = {};
          for (const [name, d] of Object.entries(prev.decisions ?? {})) {
            const c = merged.find((x) => x.name === name);
            if (!c) continue;
            if (d.status === "as_is") kept[name] = d;
            else if (!(c.advice ?? []).some((a) => cites(a))) kept[name] = d;
          }
          r = { ...fromAi, criteria: merged, decisions: kept, withdrawn: prev.withdrawn ?? {} };
        } else {
          r = { ...fromAi, decisions: {}, withdrawn: {} };
        }
        toast.success(`Reviewed: ${r.overall}/100.`);
      }
      await saveReview(r, true);
    } catch (e) {
      toast.error(`The reviewer: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  /** Draft it: one line of advice becomes a draft card on the first question it cites. */
  const draftIt = async (c: Criterion, a: { text: string; i: number[] }, key: string) => {
    const it = a.i.map((n) => live[n - 1]).find(Boolean);
    if (!it) { toast.error("That advice doesn't point at a question. Open the question yourself and ask Grant Coach there."); return; }
    setDrafting(key);
    try { await onFix(it, { problem: `${c.name}: ${a.text}`, fix: a.text, instruction: a.text }); toast.success("The rewrite is in the question's conversation. Read it there; Use this puts it in the answer."); } finally { setDrafting(null); }
  };

  // Each pre-submit item is a link to its question.
  const List = ({ title, rows, color }: { title: string; rows: { id: string; label: string }[]; color: string }) => rows.length ? (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>{title} ({rows.length})</p>
      <ul className="mt-0.5 space-y-0.5">
        {rows.map((r) => (
          <li key={r.id}><button type="button" onClick={() => onJump(r.id)} className="text-left text-[12px] text-white/80 hover:text-white underline-offset-2 hover:underline">• {r.label}</button></li>
        ))}
      </ul>
    </div>
  ) : null;

  const chatProps = { folderId, folder, live, library, getFacts, caseBrief, funderBrief, review, userId, busy, onJump, onDraftToQuestion, onReviewChanged: refreshReview };

  return (
    <GcCard
      icon={<Gavel className="w-4 h-4" />}
      title="The reviewer"
      blurb={review ? `${review.overall}/100 · ${settledCount} of ${criteria.length} settled${stale ? " · answers changed since this review" : ""}` : "Read the application the way the funder's panel will, before you submit"}
      right={
        <>
          <div className="hidden sm:flex rounded-md border overflow-hidden text-[11px] font-bold" style={{ borderColor: `${GC_BLUE}66` }} title="How much the reviewer flags">
            {(["must_fix", "all"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setFocus(v)} className="px-2.5 py-1.5" style={focus === v ? { backgroundColor: GC_BLUE, color: "#0a0a0a" } : { color: "rgba(255,255,255,0.6)" }}>
                {v === "must_fix" ? "Must-fix only" : "Everything"}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => void run()} disabled={running || busy || waitingForCase > 0 || !live.some((i) => i.answer?.trim())} title={waitingForCase ? "Answer the open questions first" : undefined} className="font-bold h-8" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
            {running ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Gavel className="w-4 h-4 mr-1.5" />} {review ? "Review again" : "Review the application"}
          </Button>
        </>
      }
    >
      <div className="p-4 space-y-4">
        {/* The plain checks: no AI, always current. */}
        <div className={`rounded-xl border p-3 ${ready ? "border-emerald-400/30 bg-emerald-400/[0.04]" : "border-amber-400/30 bg-amber-400/[0.04]"}`}>
          <p className={`text-sm font-semibold inline-flex items-center gap-1.5 ${ready ? "text-emerald-300" : "text-amber-200"}`}>
            {ready ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {ready ? "Ready to submit: every required question answered, approved and inside its limit." : `Before you submit · ${openInOrder.length} to go`}
          </p>
          {!ready && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={next} className="h-8 font-bold" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}><ArrowDownCircle className="w-4 h-4 mr-1.5" /> {cursor === 0 ? "Start at the first one" : "Next"}</Button>
              <span className="text-[12px] text-white/50">Or click any question below to go straight to it.</span>
            </div>
          )}
          {!ready && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <List title="Required, not answered" rows={checks.blank} color="#fca5a5" />
              <List title="Over the funder's limit" rows={checks.over} color="#fca5a5" />
              <List title="Need you" rows={checks.needYou} color="#fcd34d" />
              <List title="Answered, not approved yet" rows={checks.unapproved} color="#fcd34d" />
            </div>
          )}
        </div>

        {waitingForCase > 0 && !running && (
          <p className="text-[12px] text-white/50">The reviewer reads the finished application. {waitingForCase} question{waitingForCase === 1 ? " still needs" : "s still need"} an answer: click {waitingForCase === 1 ? "it" : "one"} above, talk it through with Grant Coach, then review.</p>
        )}
        {running && <p className="text-sm text-white/55 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" style={{ color: GC_BLUE }} /> Reading every answer the way a skeptical reviewer would, and checking every number against the record…</p>}

        {review && !running && (
          <>
            {/* The score, and the finish line. */}
            {allSettled ? (
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/[0.08] p-4 flex flex-wrap items-center gap-4">
                <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 border-emerald-400 shrink-0">
                  <span className="text-2xl font-black leading-none text-emerald-300">{review.overall}</span>
                  <span className="text-[10px] text-white/45">of 100</span>
                </div>
                <div className="flex-1 min-w-[220px]">
                  <p className="text-lg font-black text-emerald-300 inline-flex items-center gap-2"><PartyPopper className="w-5 h-5" /> All {criteria.length} settled. This one is ready.</p>
                  <p className="text-sm text-white/75 mt-1">Every criterion is fixed or going in as is. Print the copy, then submit on the portal.</p>
                </div>
                {/* The reviewer's last word stays readable after the last settle (Josh, 2026-10-29:
                    "the message that talked about my next moves… is not viewable"). */}
                {review.verdict?.trim() && (
                  <div className="basis-full border-t border-emerald-400/20 pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300/80">The reviewer's last word</p>
                    <p className="text-sm text-white/85 mt-0.5"><Refs text={review.verdict} live={live} onJump={onJump} /></p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 shrink-0" style={{ borderColor: tone(review.overall) }}>
                  <span className="text-2xl font-black leading-none" style={{ color: tone(review.overall) }}>{review.overall}</span>
                  <span className="text-[10px] text-white/45">of 100</span>
                </div>
                <div className="flex-1 min-w-[220px]">
                  <p className="text-sm text-white/85"><Refs text={review.verdict} live={live} onJump={onJump} /></p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${criteria.length ? (settledCount / criteria.length) * 100 : 0}%` }} /></div>
                    <span className="text-[12px] font-bold text-emerald-300 tabular-nums">{settledCount} of {criteria.length} settled</span>
                  </div>
                </div>
              </div>
            )}
            {stale && <p className="text-[12px] text-amber-300">Answers have changed since this review. Review again re-reads only what you changed.</p>}

            {/* One card per criterion: the score, the advice, Fix or Submit as is. */}
            <div className="space-y-2">
              {criteria.map((c, n) => {
                const pct = c.max ? Math.round((c.score / c.max) * 100) : 0;
                const d = decisions[c.name];
                const k = criterionKey(n);
                const advice = c.advice ?? [];
                if (d && !showSettled) {
                  return null;
                }
                if (d) {
                  const inThread = threadCount(k);
                  return (
                    <div key={c.name} className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] px-3 py-2 space-y-2">
                      <div className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-emerald-300 shrink-0" />
                        <p className="flex-1 text-[13px] text-emerald-200"><span className="font-semibold">{c.name}</span> · {c.score}/{c.max} · {d.status === "fixed" ? "fixed" : "submitting as is"}</p>
                        {/* What was said under this criterion stays reachable once it is settled. */}
                        {inThread > 0 && (
                          <button type="button" onClick={() => setReplyTo((r) => (r === k ? null : k))} className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline underline-offset-2" style={{ color: GC_BLUE }}><MessageSquare className="w-3.5 h-3.5" /> {replyTo === k ? "Close" : `${inThread} in the thread`}</button>
                        )}
                        <button type="button" onClick={() => void decide(c, null)} className="inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-white"><Undo2 className="w-3.5 h-3.5" /> Reopen</button>
                      </div>
                      {replyTo === k && <ReviewerChat {...chatProps} note={{ key: k, criterion: c.name, text: `${c.name} (${c.score}/${c.max}): ${c.why}${advice.length ? ` ADVICE: ${advice.map((a) => a.text).join(" | ")}` : ""}` }} />}
                    </div>
                  );
                }
                const isWorking = working === c.name;
                return (
                  <div key={c.name} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                    <div className="flex justify-between gap-2 text-[13px]"><span className="text-white font-semibold">{c.name}</span><span className="tabular-nums font-semibold" style={{ color: tone(pct) }}>{c.score}/{c.max}</span></div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone(pct) }} /></div>
                    <p className="text-[12px] text-white/50"><Refs text={c.why} live={live} onJump={onJump} /></p>
                    {advice.length === 0 ? (
                      <p className="text-[12px] text-emerald-300 inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Nothing here would cost points.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {advice.map((a, j) => {
                          const key = `${k}:${j}`;
                          const target = a.i.map((x) => live[x - 1]).find(Boolean);
                          return (
                            <li key={j} className="flex items-start gap-2 text-[13px] text-white/85">
                              <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: GC_BLUE }} />
                              <span className="flex-1"><Refs text={a.text} live={live} onJump={onJump} /></span>
                              {isWorking && target && (
                                <button type="button" onClick={() => void draftIt(c, a, key)} disabled={busy || drafting != null} className="shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold hover:bg-white/10 disabled:opacity-50" style={{ borderColor: `${GC_BLUE}88`, color: GC_BLUE }}>
                                  {drafting === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Draft it
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {isWorking ? (
                        <>
                          <Button size="sm" onClick={() => void decide(c, "fixed")} className="h-8 font-bold bg-emerald-600 hover:bg-emerald-500 text-white"><Check className="w-4 h-4 mr-1.5" /> Done · fixed</Button>
                          <Button size="sm" variant="outline" onClick={() => setWorking(null)} className="h-8 bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white">Not yet</Button>
                          <span className="text-[11px] text-white/40">Draft it puts a rewrite on the question's conversation; click a question number to go there.</span>
                        </>
                      ) : (
                        <>
                          {advice.length > 0 && (
                            <Button size="sm" onClick={() => setWorking(c.name)} className="h-8 font-bold" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}><Wrench className="w-4 h-4 mr-1.5" /> Fix</Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => void decide(c, "as_is")} className="h-8 bg-transparent border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10 hover:text-emerald-200"><SendHorizontal className="w-4 h-4 mr-1.5" /> Submit as is</Button>
                          <ReplyThread open={replyTo === k} count={threadCount(k)} onToggle={() => setReplyTo((r) => (r === k ? null : k))} chat={chatProps} note={{ key: k, criterion: c.name, text: `${c.name} (${c.score}/${c.max}): ${c.why}${advice.length ? ` ADVICE: ${advice.map((a) => a.text).join(" | ")}` : ""}` }} />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {settledCount > 0 && (
              <button type="button" onClick={() => setShowSettled((v) => !v)} className="inline-flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white underline underline-offset-2"><Eye className="w-3.5 h-3.5" /> {showSettled ? "Hide the settled" : `Show the ${settledCount} settled`}</button>
            )}

            {clarifications.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">Settled with the reviewer ({clarifications.length}) · every review from now on takes these as true</p>
                <ul className="mt-0.5 space-y-0.5">{clarifications.map((c, i) => <li key={i} className="text-[12px] text-white/70">• {c}</li>)}</ul>
              </div>
            )}
            <ReviewerChat {...chatProps} />
            <p className="text-[11px] text-white/35">
              Review again re-reads only the answers you changed and keeps what you settled; <button type="button" onClick={() => void run(true)} disabled={running || busy} className="underline underline-offset-2 text-white/55 hover:text-white">start the review over</button> for a fresh full read.
              {" "}Reviewed {reviewedAt ? new Date(reviewedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : ""}.
            </p>
          </>
        )}
      </div>
    </GcCard>
  );
}
