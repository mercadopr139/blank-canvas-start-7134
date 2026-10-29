// Grant Coach's reviewer card: the plain pre-submit checks, and the skeptical
// funder's read — a score per criterion, the three weakest answers with a
// one-click fix, contradictions and numbers that don't match the back end.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Gavel, AlertTriangle, Check, Wand2, XCircle, ArrowDownCircle, MessageSquare, Undo2 } from "lucide-react";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { preSubmitChecks, reviewApplication, reviewerMessages, clarificationsOf, noteKeys, type Review, type ReviewNote } from "@/lib/grantCoach/review";
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
  /** Fix it: the rewrite goes to the question's conversation as a draft card. */
  onFix: (it: AppItem, w: { problem: string; fix: string; instruction: string }) => Promise<void>;
  userId: string | null;
  /** The reviewer's conversation: a rewrite goes to that question as a draft card. */
  onDraftToQuestion: (it: AppItem, note: string, text: string, words: number) => Promise<void>;
}

/** The Reply button and, open, the thread — under any note of the review. A top-level component, so the open thread keeps its state while the reviewer is thinking. */
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

/** The reviewer writes "[45]" for the 45th question. Each one becomes a chip
    that names the question and takes you to it. */
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
  const [fixing, setFixing] = useState<string | null>(null);
  /** Which note's Reply thread is open. */
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const { data: reviewerMsgs = [] } = useQuery({ queryKey: ["grant-reviewer-chat", folderId], queryFn: () => reviewerMessages(folderId) });
  const clarifications = clarificationsOf(reviewerMsgs);
  const withdrawn = review?.withdrawn ?? {};
  const threadCount = (key: string) => reviewerMsgs.filter((m) => m.payload?.note === key).length;
  const refreshReview = () => qc.invalidateQueries({ queryKey: ["grant-folder", folderId] });
  const Withdrawn = ({ k }: { k: string }) => withdrawn[k] ? (
    <p className="text-[11px] font-semibold text-emerald-300 inline-flex items-center gap-1"><Undo2 className="w-3.5 h-3.5" /> Withdrawn by the reviewer after your reply · {new Date(withdrawn[k].at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}</p>
  ) : null;
  const live = items.filter((i) => i.status !== "na");
  const checks = preSubmitChecks(live);
  const stale = !!review && !!reviewedAt && !!lastChange && lastChange > reviewedAt;
  // The reviewer reads the finished application: not while story questions still wait for the case.
  const waitingForCase = live.filter((i) => i.needs_case && !i.answer?.trim()).length;
  const openIds = new Set([...checks.blank, ...checks.over, ...checks.needYou, ...checks.unapproved].map((i) => i.id));
  const openInOrder = live.filter((i) => openIds.has(i.id));
  const [cursor, setCursor] = useState(0);
  const next = () => { if (!openInOrder.length) return; const k = cursor % openInOrder.length; onJump(openInOrder[k].id); setCursor(k + 1); };
  const ready = !checks.blank.length && !checks.over.length && !checks.unapproved.length && !checks.needYou.length;
  const chatProps = { folderId, folder, live, library, getFacts, caseBrief, funderBrief, review, userId, busy, onJump, onDraftToQuestion, onReviewChanged: refreshReview };

  const run = async () => {
    setRunning(true);
    try {
      const r = await reviewApplication({
        folder, library, facts: await getFacts(), caseBrief, funderBrief, clarifications,
        application: live.map((it, i) => ({ i: i + 1, section: it.section, label: it.label, help: it.detail, kind: it.kind, required: it.required, answer: it.answer, limit_kind: it.limit_kind, limit_value: it.limit_value })),
      });
      const { error } = await supabase.from("grant_folders" as never).update({ review: r, reviewed_at: new Date().toISOString() } as never).eq("id", folderId);
      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ["grant-folder", folderId] });
      toast.success(`Reviewed: ${r.overall}/100.`);
    } catch (e) {
      toast.error(`The reviewer: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  const fix = async (w: Review["weakest"][number]) => {
    const it = live[w.i - 1];
    if (!it) { toast.error("That question isn't in the application any more."); return; }
    setFixing(it.id);
    try { await onFix(it, w); toast.success("The rewrite is in the question's conversation. Read it there; Use this puts it in the answer."); } finally { setFixing(null); }
  };

  // Each item is a link to its question.
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

  return (
    <GcCard
      icon={<Gavel className="w-4 h-4" />}
      title="The reviewer"
      blurb={review ? `${review.overall}/100${stale ? " · answers changed since this review" : ""}` : "Read the application the way the funder's panel will, before you submit"}
      right={
        <Button size="sm" onClick={() => void run()} disabled={running || busy || waitingForCase > 0 || !live.some((i) => i.answer?.trim())} title={waitingForCase ? "Answer the open questions first" : undefined} className="font-bold h-8" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
          {running ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Gavel className="w-4 h-4 mr-1.5" />} {review ? "Review again" : "Review the application"}
        </Button>
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
        {running && <p className="text-sm text-white/55 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" style={{ color: GC_BLUE }} /> Reading every answer the way a skeptical reviewer would, and checking every number against the back end…</p>}

        {review && !running && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 shrink-0" style={{ borderColor: tone(review.overall) }}>
                <span className="text-2xl font-black leading-none" style={{ color: tone(review.overall) }}>{review.overall}</span>
                <span className="text-[10px] text-white/45">of 100</span>
              </div>
              <p className="flex-1 min-w-[220px] text-sm text-white/85"><Refs text={review.verdict} live={live} onJump={onJump} /></p>
            </div>
            {stale && <p className="text-[12px] text-amber-300">Answers have changed since this review. Review again for a current score.</p>}

            {review.criteria.length > 0 && (
              <div className="space-y-2">
                {review.criteria.map((c) => {
                  const pct = c.max ? Math.round((c.score / c.max) * 100) : 0;
                  return (
                    <div key={c.name}>
                      <div className="flex justify-between gap-2 text-[13px]"><span className="text-white/85">{c.name}</span><span className="tabular-nums font-semibold" style={{ color: tone(pct) }}>{c.score}/{c.max}</span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone(pct) }} /></div>
                      <p className="mt-0.5 text-[12px] text-white/50"><Refs text={c.why} live={live} onJump={onJump} /></p>
                    </div>
                  );
                })}
              </div>
            )}

            {review.weakest.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">Where it loses the most points</p>
                {review.weakest.map((w) => {
                  const it = live[w.i - 1];
                  const k = noteKeys.weakest(w.i);
                  const gone = !!withdrawn[k];
                  return (
                    <div key={w.i} className={`rounded-xl border border-white/10 bg-black/30 p-3 space-y-1 ${gone ? "opacity-60" : ""}`}>
                      <p className="text-sm font-semibold text-white">
                        {it ? <button type="button" onClick={() => onJump(it.id)} className="text-left hover:underline underline-offset-2"><span className="tabular-nums text-[11px] mr-1.5" style={{ color: GC_BLUE }}>{w.i}</span>{it.label}</button> : `Question ${w.i}`}
                      </p>
                      <p className="text-[13px] text-red-200/90 inline-flex gap-1.5"><XCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span><Refs text={w.problem} live={live} onJump={onJump} /></span></p>
                      <p className="text-[13px] text-emerald-200/90 inline-flex gap-1.5"><Check className="w-4 h-4 shrink-0 mt-0.5" /> <span><Refs text={w.fix} live={live} onJump={onJump} /></span></p>
                      <Withdrawn k={k} />
                      {it && !gone && (
                        <Button size="sm" onClick={() => void fix(w)} disabled={busy || fixing != null} variant="outline" className="mt-1 bg-transparent border-white/20 text-white hover:bg-white/10">
                          {fixing === it.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />} Fix it · draft in the conversation
                        </Button>
                      )}
                      {!gone && <ReplyThread open={replyTo === k} count={threadCount(k)} onToggle={() => setReplyTo((r) => (r === k ? null : k))} chat={chatProps} note={{ key: k, text: `[${w.i}] ${it?.label ?? ""}: ${w.problem} FIX: ${w.fix}` }} />}
                    </div>
                  );
                })}
              </div>
            )}

            {(review.contradictions.length > 0 || review.wrong_numbers.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {review.contradictions.length > 0 && (
                  <div><p className="text-[11px] font-bold uppercase tracking-wide text-red-300">Answers that disagree</p><ul className="mt-0.5 space-y-0.5">{review.contradictions.map((c, n) => { const k = noteKeys.contradiction(n); return (
                    <li key={c} className={`text-[12px] text-white/70 ${withdrawn[k] ? "opacity-60" : ""}`}>• <Refs text={c} live={live} onJump={onJump} /><Withdrawn k={k} />{!withdrawn[k] && <ReplyThread open={replyTo === k} count={threadCount(k)} onToggle={() => setReplyTo((r) => (r === k ? null : k))} chat={chatProps} note={{ key: k, text: `Answers that disagree: ${c}` }} />}</li>
                  ); })}</ul></div>
                )}
                {review.wrong_numbers.length > 0 && (
                  <div><p className="text-[11px] font-bold uppercase tracking-wide text-red-300">Numbers that don't match the back end</p><ul className="mt-0.5 space-y-0.5">{review.wrong_numbers.map((c, n) => { const k = noteKeys.wrongNumber(n); return (
                    <li key={c} className={`text-[12px] text-white/70 ${withdrawn[k] ? "opacity-60" : ""}`}>• <Refs text={c} live={live} onJump={onJump} /><Withdrawn k={k} />{!withdrawn[k] && <ReplyThread open={replyTo === k} count={threadCount(k)} onToggle={() => setReplyTo((r) => (r === k ? null : k))} chat={chatProps} note={{ key: k, text: `Numbers that don't match the back end: ${c}` }} />}</li>
                  ); })}</ul></div>
                )}
              </div>
            )}
            {clarifications.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">Settled with the reviewer ({clarifications.length}) · every review from now on takes these as true</p>
                <ul className="mt-0.5 space-y-0.5">{clarifications.map((c, i) => <li key={i} className="text-[12px] text-white/70">• {c}</li>)}</ul>
              </div>
            )}
            <ReviewerChat folderId={folderId} folder={folder} live={live} library={library} getFacts={getFacts} caseBrief={caseBrief} funderBrief={funderBrief} review={review} userId={userId} busy={busy} onJump={onJump} onDraftToQuestion={onDraftToQuestion} onReviewChanged={refreshReview} />
            <p className="text-[11px] text-white/35">Every question is numbered from the top of the application; the same number sits beside it above. Click a number here to go to that question. Reviewed {reviewedAt ? new Date(reviewedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : ""}.</p>
          </>
        )}
      </div>
    </GcCard>
  );
}
