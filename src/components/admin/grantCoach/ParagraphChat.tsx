// Talk to Grant Coach on a standard paragraph (Josh, 2026-11-19: "I want to
// say, hey, add a line about safety being a priority — where would you put
// it?"). An editor's conversation under the paragraph: it answers, and when a
// change is asked for it shows the paragraph with that ONE change marked and
// a "Use this" that puts it in the box as a draft. Nothing is approved here.
// The thread is kept per paragraph per year once its table exists (migration
// 20261119150000); until then it lives for the session and the card says so.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, MessageSquare, Check, ArrowDownCircle } from "lucide-react";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import DraftDiff from "@/components/admin/grantCoach/DraftDiff";
import {
  paragraphMessages, saveParagraphMessage, markParagraphMessageUsed, purposeOf, shortYear, type ParagraphMsg, type SnapshotSection,
} from "@/lib/grantCoach/snapshot";
import { loadLibrary, paragraphChat } from "@/lib/grantCoach/writer";
import { gatherLiveFacts } from "@/lib/grantCoach/liveFacts";

export default function ParagraphChat({ section, current, others, userId, onUse }: {
  section: SnapshotSection;
  /** The paragraph as it stands: the box while a draft is being edited, the approved text when locked. */
  current: string;
  /** The year's other paragraphs, so a sentence stays in one place. */
  others: SnapshotSection[];
  userId: string | null;
  /** The paragraph with the change, into the box as a draft. */
  onUse: (after: string) => Promise<void>;
}) {
  const [msgs, setMsgs] = useState<ParagraphMsg[]>([]);
  const [kept, setKept] = useState(true);
  const [line, setLine] = useState("");
  const [thinking, setThinking] = useState(false);
  const [using, setUsing] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let on = true;
    paragraphMessages(section.program_year, section.section_key).then((m) => { if (on) setMsgs(m); });
    return () => { on = false; };
  }, [section.program_year, section.section_key]);

  // A new reply is read from its first line; while Grant Coach is thinking, the pill stays in view.
  useEffect(() => {
    const el = listRef.current; if (!el) return;
    if (thinking) { el.scrollTop = el.scrollHeight; return; }
    const last = el.querySelector<HTMLElement>("[data-msg]:last-of-type");
    if (last) el.scrollTop = Math.max(0, last.offsetTop - 8); else el.scrollTop = el.scrollHeight;
  }, [msgs.length, thinking]);

  const keep = async (role: "user" | "coach", content: string, payload: ParagraphMsg["payload"]) => {
    const id = await saveParagraphMessage(section.program_year, section.section_key, role, content, payload, userId);
    if (!id) setKept(false);
    const m: ParagraphMsg = { id: id ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, content, payload };
    setMsgs((old) => [...old, m]);
    return m;
  };

  const send = async () => {
    const said = line.trim();
    if (!said || thinking) return;
    setLine("");
    setThinking(true);
    try {
      const history = [...msgs.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: said }];
      await keep("user", said, null);
      const [library, facts] = await Promise.all([loadLibrary(), gatherLiveFacts()]);
      const res = await paragraphChat({
        year: shortYear(section.program_year), title: section.title, purpose: purposeOf(section.section_key), current,
        others: others.filter((o) => o.section_key !== section.section_key && o.body.trim()).map((o) => ({ title: o.title, body: o.body })),
        messages: history, library, facts,
      });
      await keep("coach", res.reply, res.after ? { after: res.after, ...(res.why ? { why: res.why } : {}) } : null);
    } catch (e) {
      toast.error(`Grant Coach: ${(e as Error).message}`);
    } finally {
      setThinking(false);
    }
  };

  const use = async (m: ParagraphMsg) => {
    if (!m.payload?.after) return;
    setUsing(m.id);
    try {
      await onUse(m.payload.after);
      if (!m.id.startsWith("tmp-")) await markParagraphMessageUsed(m.id, m.payload);
      setMsgs((old) => old.map((x) => (x.id === m.id ? { ...x, payload: { ...(x.payload ?? {}), used: true } } : x)));
    } catch (e) {
      toast.error(`Couldn't put it in: ${(e as Error).message}`);
    } finally {
      setUsing(null);
    }
  };

  return (
    <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: GC_BLUE, backgroundColor: "#0a2238", boxShadow: `0 0 0 4px ${GC_BLUE}26, 0 16px 40px -12px ${GC_BLUE}99` }}>
      <div className="px-3 py-2 border-b flex items-center justify-between gap-2" style={{ backgroundColor: `${GC_BLUE}26`, borderColor: `${GC_BLUE}55` }}>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] inline-flex items-center gap-1.5" style={{ color: GC_BLUE }}>
          <MessageSquare className="w-3.5 h-3.5" /> Talk to Grant Coach about this paragraph
        </p>
        {thinking ? (
          <p className="text-[11px] font-bold inline-flex items-center gap-1.5 rounded-md px-2 py-0.5" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading it…</p>
        ) : (
          <p className="text-[11px] text-white/45 hidden md:block">Ask where a line goes, what to cut, or for a change · nothing changes until you click Use this, then approve</p>
        )}
      </div>
      {!kept && <p className="px-3 pt-2 text-[11px] text-amber-300">This conversation is not being saved yet — the table for it has not been added. It still works for now.</p>}
      {(msgs.length > 0 || thinking) && (
        <div ref={listRef} className="relative max-h-[480px] overflow-y-auto p-3 space-y-2.5">
          {msgs.map((m) => (
            <div key={m.id} data-msg className={m.role === "user" ? "flex justify-end" : "space-y-2"}>
              {m.role === "user" ? (
                <p className="max-w-[85%] rounded-xl px-3 py-1.5 text-sm text-white whitespace-pre-wrap border" style={{ backgroundColor: `${GC_BLUE}2e`, borderColor: `${GC_BLUE}55` }}>{m.content}</p>
              ) : (
                <>
                  <p className="max-w-[92%] text-sm text-white/90 whitespace-pre-wrap leading-relaxed"><span className="font-bold mr-1.5" style={{ color: GC_BLUE }}>Grant Coach</span>{m.content}</p>
                  {m.payload?.after && (
                    <div className="max-w-[92%] rounded-lg border bg-black/40 overflow-hidden" style={{ borderColor: `${GC_BLUE}66` }}>
                      <div className="px-3 py-1.5 border-b flex items-center justify-between gap-2" style={{ borderColor: `${GC_BLUE}33`, backgroundColor: `${GC_BLUE}14` }}>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: GC_BLUE }}>The paragraph with the change{m.payload.why ? <span className="normal-case tracking-normal font-normal text-white/60"> · {m.payload.why}</span> : null}</p>
                        {m.payload.used ? (
                          <span className="text-[11px] font-semibold text-emerald-300 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> In the box</span>
                        ) : (
                          <button type="button" onClick={() => void use(m)} disabled={using != null} className="rounded-md px-2.5 py-1 text-[11px] font-bold hover:opacity-90 inline-flex items-center gap-1 disabled:opacity-50" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
                            {using === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownCircle className="w-3.5 h-3.5" />} Use this
                          </button>
                        )}
                      </div>
                      <DraftDiff before={current} after={m.payload.after} className="px-3 py-2 text-sm text-white whitespace-pre-wrap leading-relaxed" />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {thinking && <p className="text-sm text-white/50 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" style={{ color: GC_BLUE }} /> Reading the paragraph…</p>}
        </div>
      )}
      <div className="p-3 flex gap-2 items-end">
        <div className="flex-1 min-w-0">
          <Textarea
            value={line}
            onChange={(e) => setLine(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }}
            rows={2}
            autoFocus
            placeholder='e.g. "Add a line that safety is a priority — where would you put it?" · "Is that too many numbers for an opening?"'
            disabled={thinking}
            className="bg-neutral-950 border-white/15 text-white text-sm min-h-[56px]"
          />
          <p className="mt-1 text-[10px] text-white/30">Enter for a new line · Ctrl+Enter or the arrow sends</p>
        </div>
        <button type="button" onClick={() => void send()} disabled={thinking || !line.trim()} aria-label="Send" className="h-10 w-10 shrink-0 rounded-md inline-flex items-center justify-center disabled:opacity-40" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
          {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
