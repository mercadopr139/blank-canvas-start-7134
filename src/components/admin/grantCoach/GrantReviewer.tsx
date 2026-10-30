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
import { Loader2, Gavel, AlertTriangle, Check, Wand2, ArrowDownCircle, MessageSquare, Undo2, PartyPopper, Wrench, SendHorizontal, Printer, Ban } from "lucide-react";
import { Input } from "@/components/ui/input";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { preSubmitChecks, reviewApplication, rejectAdvice, reviewerMessages, clarificationsOf, type Review, type ReviewNote, type ReviewFocus, type Criterion, type Advice } from "@/lib/grantCoach/review";
import type { CaseBrief, DraftFolder, LibraryEntry, FunderBrief } from "@/lib/grantCoach/writer";
import type { Fact } from "@/lib/grantCoach/liveFacts";
import type { AppItem } from "@/components/admin/grantCoach/GrantApplication";
import ReviewerChat from "@/components/admin/grantCoach/ReviewerChat";
import type { SiblingContext } from "@/lib/grantCoach/sibling";

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
  /** The grant went in: the review is a record — score and last word, nothing to run or ask. */
  submitted?: boolean;
  /** The sister application (2026-10-29): the reviewer reads the two as the panel will, side by side. */
  sibling?: SiblingContext | null;
  /** Take Josh to a question on the page. */
  onJump: (id: string) => void;
  /** Draft it: the rewrite goes to the question's conversation as a draft card. */
  onFix: (it: AppItem, w: { problem: string; fix: string; instruction: string }) => Promise<void>;
  userId: string | null;
  /** Print the copy — the same Print as the application header, one click from the finish line. */
  onPrint: () => void;
  printing: boolean;
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

/** The score as a share of the points: green best, yellow second, blue third, red bad (Josh, 2026-10-29). */
const tone = (pct: number) => (pct >= 85 ? "#34d399" : pct >= 70 ? "#fcd34d" : pct >= 55 ? GC_BLUE : "#fca5a5");
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

export default function GrantReviewer({ folderId, folder, items, library, getFacts, caseBrief, review, reviewedAt, funderBrief, lastChange, busy, onJump, onFix, userId, onDraftToQuestion, onPrint, printing, submitted = false, sibling = null }: Props) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
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
  /** A line of advice Josh has handled: ticked by hand, or its questions changed since the review (2026-10-29: "lightly cross out so I can stay organized"). */
  const adviceDone = review?.adviceDone ?? {};
  const changedSinceReview = new Set(reviewedAt ? live.map((it, i) => (it.updated_at && it.updated_at > reviewedAt ? i + 1 : 0)).filter(Boolean) : []);
  const isDone = (a: { text: string; i: number[] }) => adviceDone[a.text] ?? a.i.some((n) => changedSinceReview.has(n));
  const toggleDone = async (a: { text: string; i: number[] }) => {
    if (!review) return;
    await saveReview({ ...review, adviceDone: { ...adviceDone, [a.text]: !isDone(a) } });
  };
  /** Not applicable (2026-10-30): which line is being rejected, the reason typed, and the call in flight. */
  const rejected = review?.adviceRejected ?? {};
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);
  const notApplicable = async (c: Criterion, a: Advice) => {
    if (!review) return;
    setRejectBusy(true);
    try {
      const res = await rejectAdvice({
        folder, library, facts: await getFacts(), funderBrief, review, clarifications,
        reject: { criterion: c.name, advice: a.text, reason: reason.trim() },
        application: live.map((it, i) => ({ i: i + 1, section: it.section, label: it.label, help: it.detail, kind: it.kind, required: it.required, answer: it.answer, limit_kind: it.limit_kind, limit_value: it.limit_value })),
      });
      const criteria = review.criteria.map((x) => (x.name === res.revised.criterion ? { ...x, score: res.revised.score, why: res.revised.why } : x));
      const next: Review = { ...review, criteria, overall: res.revised.overall, adviceRejected: { ...rejected, [a.text]: { at: new Date().toISOString(), reason: reason.trim() } } };
      if (res.clarification) {
        await supabase.from("grant_messages" as never).insert({ folder_id: folderId, item_id: null, role: "user", content: res.clarification, payload: { scope: "review", clarification: true }, created_by: userId } as never);
        qc.invalidateQueries({ queryKey: ["grant-reviewer-chat", folderId] });
      }
      if (await saveReview(next)) toast.success(`Not applicable. ${c.name} is now ${res.revised.score}/${c.max}; the score is ${res.revised.overall}/100.`);
      setRejecting(null); setReason("");
    } catch (e) {
      toast.error(`The reviewer: ${(e as Error).message}`);
    } finally {
      setRejectBusy(false);
    }
  };
  const putBack = async (a: Advice) => {
    if (!review) return;
    const next = { ...rejected }; delete next[a.text];
    if (await saveReview({ ...review, adviceRejected: next })) toast("Put back. The score refreshes on Review again.");
  };
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
      const dismissed = prev ? [...prev.criteria.filter((c) => prev.decisions?.[c.name]?.status === "as_is").flatMap((c) => (c.advice ?? []).map((a) => a.text)), ...Object.keys(prev.adviceRejected ?? {})] : [];
      let r: Review;
      if (prev && changedSince.length === 0) {
        r = prev; // Nothing changed: the review stands. No AI, no churn.
        toast.success("No answer has changed since the last review, so it stands.");
      } else {
        const fromAi = await reviewApplication({
          folder, library, facts: await getFacts(), caseBrief, funderBrief, clarifications,
          previousReview: prev, changedSince, dismissed, focus,
          sibling: sibling ? { name: sibling.name, program: sibling.program, application: [...sibling.answers.values()].filter((a) => a.answer?.trim()).map((a) => ({ label: a.label, answer: a.answer!.trim() })) } : undefined,
          application: live.map((it, i) => ({ i: i + 1, section: it.section, label: it.label, help: it.detail, kind: it.kind, required: it.required, answer: it.answer, limit_kind: it.limit_kind, limit_value: it.limit_value })),
        });
        if (prev) {
          // Enforced: advice is new only on a question changed since the last review; the rest carries over word for word.
          const changed = new Set(changedSince);
          const cites = (a: { i: number[] }) => a.i.some((n) => changed.has(n));
          const merged = fromAi.criteria.map((c) => {
            const old = prev.criteria.find((o) => o.name === c.name);
            const gone = new Set(Object.keys(prev.adviceRejected ?? {}));
            const keep = (old?.advice ?? []).filter((a) => !cites(a) && !gone.has(a.text));
            const fresh = (c.advice ?? []).filter((a) => (cites(a) || !old) && !gone.has(a.text));
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
          r = { ...fromAi, criteria: merged, decisions: kept, withdrawn: prev.withdrawn ?? {}, adviceRejected: prev.adviceRejected ?? {} };
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

  /** Draft it: one line of advice becomes a draft card on ONE question it names — the one Josh picks when it names several (2026-10-29: a draft sent to the first number landed on a one-word field). */
  /** The one question a line of advice changes. */
  const targetOf = (a: Advice): number | null => a.target ?? (a.text.match(/\[(\d+)\]/) ? Number(a.text.match(/\[(\d+)\]/)![1]) : a.i[0] ?? null);
  const draftIt = async (c: Criterion, a: Advice, key: string) => {
    const n = targetOf(a);
    const it = n ? live[n - 1] : undefined;
    if (!it || !n) { toast.error("That advice doesn't point at a question. Open the question yourself and ask Grant Coach there."); return; }
    setDrafting(key);
    const only = a.i.length > 1 ? ` Change only [${n}] "${it.label}"; the other questions named are only context.` : "";
    try { await onFix(it, { problem: `${c.name}: ${a.text}`, fix: a.text, instruction: a.text + only }); toast.success(`The rewrite for ${n} is in its conversation. Read it there; Use this puts it in the answer.`); } finally { setDrafting(null); }
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

  // Submitted (Josh, 2026-10-29): the reviewer's job is over. One folded line — the score, how many
  // settled, when — and inside, read-only, the score and the last word: next year's head start.
  if (submitted) {
    if (!review) return null;
    const when = reviewedAt ? new Date(reviewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "";
    return (
      <GcCard
        icon={<Gavel className="w-4 h-4" />}
        title="The reviewer"
        blurb={`${review.overall}/100 · ${settledCount} of ${criteria.length} settled${when ? ` · reviewed ${when}` : ""} · the record of the review before this went in`}
        open={recordOpen}
        onToggle={() => setRecordOpen((o) => !o)}
      >
        <div className="p-4 flex flex-wrap items-start gap-4">
          <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 shrink-0" style={{ borderColor: tone(review.overall) }}>
            <span className="text-2xl font-black leading-none" style={{ color: tone(review.overall) }}>{review.overall}</span>
            <span className="text-[10px] text-white/45">of 100</span>
          </div>
          <div className="flex-1 min-w-[220px] space-y-3">
            {review.verdict?.trim() && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">The reviewer's last word</p>
                <p className="text-sm text-white/85 mt-0.5"><Refs text={review.verdict} live={live} onJump={onJump} /></p>
              </div>
            )}
            <ul className="space-y-1">
              {criteria.map((c) => (
                <li key={c.name} className="flex justify-between gap-3 text-[13px]">
                  <span className="text-white/75">{c.name}</span>
                  <span className="tabular-nums font-semibold shrink-0" style={{ color: tone(c.max ? Math.round((c.score / c.max) * 100) : 0) }}>{c.score}/{c.max}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </GcCard>
    );
  }

  return (
    <GcCard
      icon={<Gavel className="w-4 h-4" />}
      title="The reviewer"
      blurb={review ? `${review.overall}/100 · ${settledCount} of ${criteria.length} settled${reviewedAt ? ` · reviewed ${new Date(reviewedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}` : ""}${stale ? " · answers changed since" : ""}` : "Read the application the way the funder's panel will, before you submit"}
      right={
        <>
          <div className="hidden sm:flex rounded-md border overflow-hidden text-[11px] font-bold" style={{ borderColor: `${GC_BLUE}66` }} title="How much the reviewer flags">
            {(["must_fix", "all"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setFocus(v)} className="px-2.5 py-1.5" style={focus === v ? { backgroundColor: GC_BLUE, color: "#0a0a0a" } : { color: "rgba(255,255,255,0.6)" }}>
                {v === "must_fix" ? "Must-fix only" : "Everything"}
              </button>
            ))}
          </div>
          {review && (
            <Button size="sm" variant="outline" onClick={() => void run(true)} disabled={running || busy} title="A fresh full read: every criterion open again" className="h-8 bg-transparent border-white/20 text-white/75 hover:bg-white/10 hover:text-white"><Undo2 className="w-4 h-4 mr-1.5" /> Start over</Button>
          )}
          <Button size="sm" onClick={() => void run()} disabled={running || busy || waitingForCase > 0 || !live.some((i) => i.answer?.trim())} title={waitingForCase ? "Review again re-reads only what you changed and keeps what you settled" : "Re-reads only what you changed and keeps what you settled"} className="font-bold h-8" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
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
                  <p className="text-sm text-white/75 mt-1">Every criterion is fixed or going in as is. What's left:</p>
                  <ol className="mt-1.5 space-y-0.5 text-[13px] text-white/80 list-decimal list-inside">
                    <li><span className="font-semibold text-white">Print</span> — one PDF with every answer and the attached files; a copy files under Ours.</li>
                    <li><span className="font-semibold text-white">Fill the portal</span> — copy each answer from its row (or View application → Copy all); upload each attachment from the documents card.</li>
                    <li><span className="font-semibold text-white">Submit on the portal.</span></li>
                    <li><span className="font-semibold text-white">Mark submitted</span> in the card at the top of this folder, so the folder is the record.</li>
                  </ol>
                  <Button size="sm" onClick={onPrint} disabled={printing} className="mt-3 font-bold h-9" style={{ backgroundColor: "#34d399", color: "#0a0a0a" }}>
                    {printing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Printer className="w-4 h-4 mr-1.5" />} Print the copy
                  </Button>
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
                          const tn = targetOf(a); const target = tn ? live[tn - 1] : undefined;
                          return (
                            rejected[a.text] ? (
                              <li key={j} className="flex items-start gap-2 text-[13px] text-white/40">
                                <Ban className="mt-[3px] w-4 h-4 shrink-0 text-white/30" />
                                <span className="flex-1">
                                  <span className="line-through decoration-white/30"><Refs text={a.text} live={live} onJump={onJump} /></span>
                                  <span className="block mt-0.5 text-[11px] text-emerald-300/80">Not applicable{rejected[a.text].reason ? ` · ${rejected[a.text].reason}` : ""} · <button type="button" onClick={() => void putBack(a)} className="underline underline-offset-2 text-white/50 hover:text-white">Put it back</button></span>
                                </span>
                              </li>
                            ) : (
                            <li key={j} className={`flex items-start gap-2 text-[13px] ${isDone(a) ? "text-white/40" : "text-white/85"}`}>
                              <button type="button" onClick={() => void toggleDone(a)} title={isDone(a) ? "Handled — click to put it back" : "Click when you have handled this"} className="mt-[3px] w-4 h-4 rounded-full border shrink-0 inline-flex items-center justify-center" style={isDone(a) ? { borderColor: "#34d399", backgroundColor: "#34d39933" } : { borderColor: `${GC_BLUE}99` }}>
                                {isDone(a) && <Check className="w-3 h-3 text-emerald-300" />}
                              </button>
                              <span className={`flex-1 ${isDone(a) ? "line-through decoration-white/30" : ""}`}>
                                <Refs text={a.text} live={live} onJump={onJump} />
                                {rejecting === key ? (
                                  <span className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <Input value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !rejectBusy) void notApplicable(c, a); if (e.key === "Escape") { setRejecting(null); setReason(""); } }} autoFocus disabled={rejectBusy} placeholder="Why it doesn't apply (remembered for every later review)" className="h-8 flex-1 min-w-[220px] bg-neutral-950 border-white/15 text-white text-[12px]" />
                                    <Button size="sm" onClick={() => void notApplicable(c, a)} disabled={rejectBusy} className="h-8 font-bold" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>{rejectBusy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Ban className="w-3.5 h-3.5 mr-1.5" />} {rejectBusy ? "Re-scoring…" : "Confirm · re-score"}</Button>
                                    <button type="button" onClick={() => { setRejecting(null); setReason(""); }} disabled={rejectBusy} className="text-[11px] text-white/50 hover:text-white">Cancel</button>
                                  </span>
                                ) : !isDone(a) && (
                                  <button type="button" onClick={() => { setRejecting(key); setReason(""); }} title="Not applicable: the reviewer re-scores this criterion without this note, and remembers why" className="ml-2 inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white align-baseline"><Ban className="w-3 h-3" /> Not applicable</button>
                                )}
                              </span>
                              {isWorking && target && (
                                <button type="button" onClick={() => void draftIt(c, a, key)} disabled={busy || drafting != null} title={`Drafts the change in ${targetOf(a)}. ${target.label}`} className="shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold hover:bg-white/10 disabled:opacity-50" style={{ borderColor: `${GC_BLUE}88`, color: GC_BLUE }}>
                                  {drafting === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Draft it
                                </button>
                              )}
                            </li>
                            )
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

            {clarifications.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">Settled with the reviewer ({clarifications.length}) · every review from now on takes these as true</p>
                <ul className="mt-0.5 space-y-0.5">{clarifications.map((c, i) => <li key={i} className="text-[12px] text-white/70">• {c}</li>)}</ul>
              </div>
            )}
          </>
        )}
      </div>
    </GcCard>
  );
}
