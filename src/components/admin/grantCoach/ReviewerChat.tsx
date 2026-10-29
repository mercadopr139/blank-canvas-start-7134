// Talk to the reviewer (Josh, 2026-10-29: "I need to interact with it… ask
// questions in the review before making changes"). The same skeptical
// reviewer, in conversation, with the whole application and its own review
// in front of it. Question numbers in its replies are chips that jump to the
// question. "Write it" lands a draft card on that question's conversation —
// nothing changes until Josh clicks "Use this" there.
//
// Two shapes of the same panel:
//  - the open conversation under the review (no `note`);
//  - a Reply thread under ONE note (`note` set) — Josh explains, the reviewer
//    holds or concedes. A concession withdraws the note, revises the points
//    for that criterion and the overall, and is saved as a standing
//    clarification the next Review again reads (Josh, 2026-10-29: "maybe we
//    don't need to fix anything and just need to get on the same page").
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Gavel, ArrowDownCircle, Check, MessageSquare } from "lucide-react";
import { GC_BLUE, GC_SHADE } from "@/components/admin/grantCoach/GcCard";
import { chatWithReviewer, reviewerMessages, type Review, type ReviewerMsg, type ReviewNote } from "@/lib/grantCoach/review";
import type { CaseBrief, DraftFolder, LibraryEntry, FunderBrief } from "@/lib/grantCoach/writer";
import type { Fact } from "@/lib/grantCoach/liveFacts";
import type { AppItem } from "@/components/admin/grantCoach/GrantApplication";

export default function ReviewerChat({ folderId, folder, live, library, getFacts, caseBrief, funderBrief, review, userId, busy, onJump, onDraftToQuestion, note, onReviewChanged }: {
  folderId: string; folder: DraftFolder; live: AppItem[]; library: LibraryEntry[]; getFacts: () => Promise<Fact[]>;
  caseBrief: CaseBrief | null; funderBrief: FunderBrief | null; review: Review | null; userId: string | null; busy: boolean;
  onJump: (id: string) => void;
  /** The reviewer's rewrite goes to that question's conversation as a draft card. */
  onDraftToQuestion: (it: AppItem, note: string, text: string, words: number) => Promise<void>;
  /** A Reply thread under one note of the review. */
  note?: ReviewNote;
  /** After a withdrawal changed the saved review. */
  onReviewChanged?: () => void;
}) {
  const qc = useQueryClient();
  const key = ["grant-reviewer-chat", folderId];
  const { data: all = [] } = useQuery({ queryKey: key, queryFn: () => reviewerMessages(folderId) });
  const msgs = all.filter((m) => (note ? m.payload?.note === note.key : !m.payload?.note && !m.payload?.clarification));
  const clarifications = all.filter((m) => m.payload?.clarification).map((m) => m.content);
  const [line, setLine] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // A new reply is read from its first line (Josh, 2026-10-29: landing at the
  // bottom of a long draft card meant scrolling back up to find the note).
  // While the reviewer is thinking, the "thinking…" line is kept in view.
  useEffect(() => {
    const el = listRef.current; if (!el) return;
    if (thinking) { el.scrollTop = el.scrollHeight; return; }
    const last = el.querySelector<HTMLElement>("[data-msg]:last-of-type");
    if (last) el.scrollTop = Math.max(0, last.offsetTop - el.offsetTop - 8); else el.scrollTop = el.scrollHeight;
  }, [msgs.length, thinking]);

  const save = async (role: "user" | "coach", content: string, payload: Omit<NonNullable<ReviewerMsg["payload"]>, "scope"> = {}) => {
    const { error } = await supabase.from("grant_messages" as never).insert({ folder_id: folderId, item_id: null, role, content, payload: { scope: "review", ...(note ? { note: note.key } : {}), ...payload }, created_by: userId } as never);
    if (error) throw new Error(error.message);
  };

  const send = async () => {
    const said = line.trim();
    if (!said || thinking) return;
    setLine("");
    setThinking(true);
    qc.setQueryData<ReviewerMsg[]>(key, (old = []) => [...old, { id: `tmp-${Date.now()}`, role: "user", content: said, payload: { scope: "review", ...(note ? { note: note.key } : {}) } }]);
    try {
      await save("user", said);
      const res = await chatWithReviewer({
        folder, library, facts: await getFacts(), caseBrief, funderBrief, review, note, clarifications,
        application: live.map((it, i) => ({ i: i + 1, section: it.section, label: it.label, help: it.detail, kind: it.kind, required: it.required, answer: it.answer, limit_kind: it.limit_kind, limit_value: it.limit_value })),
        messages: [...msgs.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: said }],
      });
      await save("coach", res.reply, { ...(res.draft ? { draft: res.draft.text, draft_i: res.draft.i, draft_words: res.draft.words } : {}), ...(res.withdraw ? { withdrawn: true } : {}) });
      // A concession: the note is withdrawn, the points revised, the fact remembered.
      if (note && res.withdraw && review) {
        if (res.clarification) await save("user", res.clarification, { clarification: true });
        const criteria = review.criteria.map((c) => (res.revised && c.name === res.revised.criterion ? { ...c, score: Math.max(0, Math.min(c.max, res.revised.score)) } : c));
        const overall = res.revised?.overall != null ? Math.max(0, Math.min(100, res.revised.overall)) : review.overall;
        const next: Review = { ...review, criteria, overall, withdrawn: { ...(review.withdrawn ?? {}), [note.key]: { at: new Date().toISOString(), why: res.reply } } };
        const { error } = await supabase.from("grant_folders" as never).update({ review: next } as never).eq("id", folderId);
        if (error) toast.error(`The note was withdrawn but the score didn't save: ${error.message}`);
        else { toast.success(res.revised ? `Withdrawn. Score now ${overall}/100.` : "Withdrawn."); onReviewChanged?.(); }
      }
    } catch (e) {
      toast.error(`The reviewer: ${(e as Error).message}`);
    } finally {
      setThinking(false);
      qc.invalidateQueries({ queryKey: key });
    }
  };

  /** The draft goes to the question's conversation; the card here remembers it went. */
  const sendDraft = async (m: ReviewerMsg) => {
    const it = m.payload?.draft_i ? live[m.payload.draft_i - 1] : null;
    if (!it || !m.payload?.draft) { toast.error("That question isn't in the application any more."); return; }
    setSending(m.id);
    try {
      await onDraftToQuestion(it, "The reviewer's rewrite, from the conversation under the review.", m.payload.draft, m.payload.draft_words ?? 0);
      await supabase.from("grant_messages" as never).update({ payload: { ...(m.payload ?? {}), sent: true } } as never).eq("id", m.id);
      qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error(`Couldn't send it: ${(e as Error).message}`);
    } finally {
      setSending(null);
    }
  };

  /** "[32]" in a reply is a chip that names the question and goes to it. */
  const Refs = ({ text }: { text: string }) => (
    <>
      {text.split(/(\[\d+\])/g).map((p, k) => {
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

  const thread = !!note;
  return (
    <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: GC_BLUE, backgroundColor: "#0a2238", boxShadow: `0 0 0 4px ${GC_BLUE}26, 0 16px 40px -12px ${GC_BLUE}99` }}>
      <div className="px-3 py-2 border-b flex items-center justify-between gap-2" style={{ backgroundColor: `${GC_BLUE}26`, borderColor: `${GC_BLUE}55` }}>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] inline-flex items-center gap-1.5" style={{ color: GC_BLUE }}>
          {thread ? <MessageSquare className="w-3.5 h-3.5" /> : <Gavel className="w-3.5 h-3.5" />} {thread ? "Reply to this note" : "Talk to the reviewer"}
        </p>
        {thinking ? (
          <p className="text-[11px] font-bold inline-flex items-center gap-1.5 rounded-md px-2 py-0.5" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}><Loader2 className="w-3.5 h-3.5 animate-spin" /> The reviewer is reading…</p>
        ) : (
          <p className="text-[11px] text-white/45 hidden md:block">
            {thread ? "Explain, and the reviewer holds or withdraws the note · a withdrawal revises the score and is remembered" : 'Ask why, push back, or say "write it" for a question · the score changes only with Review again'}
          </p>
        )}
      </div>
      {(msgs.length > 0 || thinking) && (
        <div ref={listRef} className={`relative ${thread ? "max-h-[360px]" : "max-h-[480px]"} overflow-y-auto p-3 space-y-2.5`}>
          {msgs.map((m) => (
            <div key={m.id} data-msg className={m.role === "user" ? "flex justify-end" : "space-y-2"}>
              {m.role === "user" ? (
                <p className="max-w-[85%] rounded-xl px-3 py-1.5 text-sm text-white whitespace-pre-wrap border" style={{ backgroundColor: `${GC_BLUE}2e`, borderColor: `${GC_BLUE}55` }}>{m.content}</p>
              ) : (
                <>
                  <p className="max-w-[92%] text-sm text-white/90 whitespace-pre-wrap leading-relaxed"><span className="font-bold mr-1.5" style={{ color: GC_BLUE }}>The reviewer</span><Refs text={m.content} /></p>
                  {m.payload?.withdrawn && <p className="text-[11px] font-semibold text-emerald-300 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Note withdrawn · the score is revised and this is remembered for the next review</p>}
                  {m.payload?.draft && (() => {
                    const it = m.payload.draft_i ? live[m.payload.draft_i - 1] : null;
                    return (
                      <div className="max-w-[92%] rounded-lg border bg-black/40 overflow-hidden" style={{ borderColor: `${GC_BLUE}66` }}>
                        <div className="px-3 py-1.5 border-b flex items-center justify-between gap-2" style={{ borderColor: `${GC_BLUE}33`, backgroundColor: `${GC_BLUE}14` }}>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: GC_BLUE }}>
                            Draft for {m.payload.draft_i}{it ? ` · ${it.label.length > 48 ? it.label.slice(0, 46).trimEnd() + "…" : it.label}` : ""}{m.payload.draft_words ? ` · ${m.payload.draft_words} words` : ""}
                          </p>
                          {m.payload.sent ? (
                            <button type="button" onClick={() => it && onJump(it.id)} className="text-[11px] font-semibold text-emerald-300 inline-flex items-center gap-1 hover:underline"><Check className="w-3.5 h-3.5" /> On the question · go there</button>
                          ) : (
                            <button type="button" onClick={() => void sendDraft(m)} disabled={sending != null || busy || !it} className="rounded-md px-2.5 py-1 text-[11px] font-bold hover:opacity-90 inline-flex items-center gap-1 disabled:opacity-50" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
                              {sending === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownCircle className="w-3.5 h-3.5" />} Send to the question
                            </button>
                          )}
                        </div>
                        <p className="px-3 py-2 text-sm text-white whitespace-pre-wrap leading-relaxed">{m.payload.draft}</p>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          ))}
          {thinking && <p className="text-sm text-white/50 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" style={{ color: GC_BLUE }} /> The reviewer is reading…</p>}
        </div>
      )}
      <div className="p-3 flex gap-2 items-end">
        <div className="flex-1 min-w-0">
          <Textarea
            value={line}
            onChange={(e) => setLine(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }}
            rows={thread ? 2 : 3}
            autoFocus={thread}
            placeholder={thread ? "Your side of it · e.g. “The budget is built per youth: about $1,600 each, 47 youth is $75,000”" : review ? 'Ask the reviewer anything · "Why is 32 a problem?" · "Which fix moves the score most?" · "Write 43"' : "Run the review first, then ask the reviewer about it"}
            disabled={thinking}
            className={`bg-neutral-950 border-white/15 text-white text-sm ${thread ? "min-h-[56px]" : "min-h-[72px]"}`}
          />
          <p className="mt-1 text-[10px] text-white/30">Enter for a new paragraph · Ctrl+Enter or the arrow sends</p>
        </div>
        <button type="button" onClick={() => void send()} disabled={thinking || !line.trim()} aria-label="Send" className="h-10 w-10 shrink-0 rounded-md inline-flex items-center justify-center disabled:opacity-40" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
          {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
