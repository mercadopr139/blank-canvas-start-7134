// Talk to Grant Coach on a standard paragraph (Josh, 2026-11-19: "I want to
// say, hey, add a line about safety being a priority — where would you put
// it?"). An editor's conversation under the paragraph: it answers, and when a
// change is asked for it shows the paragraph with that ONE change marked and
// a "Use this" that puts it in the box as a draft. Nothing is approved here.
// The thread is kept per paragraph per year once its table exists (migration
// 20261119150000); until then it lives for the session and the card says so.
// A screenshot or a PDF can be pasted, dropped or picked with the paperclip
// (Josh, 2026-11-20); Grant Coach reads it with the message.
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, MessageSquare, Check, ArrowDownCircle, Pencil, Eye, Paperclip, X, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import DraftDiff from "@/components/admin/grantCoach/DraftDiff";
import {
  paragraphMessages, saveParagraphMessage, markParagraphMessageUsed, deleteParagraphMessage, purposeOf, shortYear, type ParagraphMsg, type SnapshotSection,
} from "@/lib/grantCoach/snapshot";
import {
  MAX_ATTACHMENTS, attachmentProblem, attachmentUrls, filesFrom, isImage, removeParagraphAttachments, uploadParagraphAttachment, type ParagraphAttachment,
} from "@/lib/grantCoach/paragraphAttachments";
import { loadLibrary, paragraphChat } from "@/lib/grantCoach/writer";
import { gatherLiveFacts } from "@/lib/grantCoach/liveFacts";

const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

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
  /** A proposal being edited in place before it is used (Josh, 2026-11-19): the message id → the text as he has it. */
  const [edits, setEdits] = useState<Record<string, string>>({});
  /** The proposal open in the big editing pop-up (Josh, 2026-11-19: "I need to see the box to edit it"). */
  const [editing, setEditing] = useState<string | null>(null);
  const [showMarks, setShowMarks] = useState(false);
  /** Files pasted, dropped or picked, waiting under the box to go with the next message (2026-11-20). */
  const [pending, setPending] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  /** Signed links for the thread's files, by path. */
  const [urls, setUrls] = useState<Record<string, string>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  // Signed links for any file in the thread that has none yet.
  useEffect(() => {
    const paths = msgs.flatMap((m) => m.payload?.attachments ?? []).map((a) => a.path).filter((p) => !urls[p]);
    if (!paths.length) return;
    let on = true;
    attachmentUrls(paths).then((got) => { if (on && Object.keys(got).length) setUrls((old) => ({ ...old, ...got })); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs]);

  // Previews of the files waiting under the box.
  const previews = useMemo(() => pending.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)), [pending]);
  useEffect(() => () => { previews.forEach((u) => { if (u) URL.revokeObjectURL(u); }); }, [previews]);

  const addFiles = (files: File[]) => {
    if (!files.length || thinking) return;
    const ok: File[] = [];
    for (const f of files) {
      const problem = attachmentProblem(f);
      if (problem) { toast.error(problem); continue; }
      ok.push(f);
    }
    setPending((old) => {
      const next = [...old, ...ok];
      if (next.length > MAX_ATTACHMENTS) toast.error(`Up to ${MAX_ATTACHMENTS} files per message.`);
      return next.slice(0, MAX_ATTACHMENTS);
    });
  };

  const keep = async (role: "user" | "coach", content: string, payload: ParagraphMsg["payload"]) => {
    const id = await saveParagraphMessage(section.program_year, section.section_key, role, content, payload, userId);
    if (!id) setKept(false);
    const m: ParagraphMsg = { id: id ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, content, payload };
    setMsgs((old) => [...old, m]);
    return m;
  };

  const forWriter = (a: ParagraphAttachment[] | undefined) => (a?.length ? a.map((x) => ({ path: x.path, title: x.name })) : undefined);

  const send = async () => {
    const said = line.trim();
    const files = pending;
    if ((!said && !files.length) || thinking) return;
    setLine("");
    setPending([]);
    setThinking(true);
    let saved: ParagraphMsg | null = null;
    const uploaded: ParagraphAttachment[] = [];
    try {
      for (const f of files) uploaded.push(await uploadParagraphAttachment(section.program_year, section.section_key, f));
      const mine = { role: "user" as const, content: said, attachments: forWriter(uploaded) };
      const history = [...msgs.map((m) => ({ role: m.role, content: m.content, attachments: forWriter(m.payload?.attachments) })), mine];
      saved = await keep("user", said, uploaded.length ? { attachments: uploaded } : null);
      const [library, facts] = await Promise.all([loadLibrary(), gatherLiveFacts()]);
      const res = await paragraphChat({
        year: shortYear(section.program_year), title: section.title, purpose: purposeOf(section.section_key), current,
        others: others.filter((o) => o.section_key !== section.section_key && o.body.trim()).map((o) => ({ title: o.title, body: o.body })),
        messages: history, library, facts,
      });
      await keep("coach", res.reply, res.after ? { after: res.after, before: current, ...(res.why ? { why: res.why } : {}) } : null);
    } catch (e) {
      toast.error(`Grant Coach: ${(e as Error).message}`);
      // The question goes back in the box instead of staying in the thread unanswered
      // (Josh, 2026-11-20: a failed send showed it twice after the retry).
      if (saved) {
        const id = saved.id;
        if (!id.startsWith("tmp-")) await deleteParagraphMessage(id).catch(() => undefined);
        setMsgs((old) => old.filter((m) => m.id !== id));
      }
      await removeParagraphAttachments(uploaded.map((a) => a.path)).catch(() => undefined);
      setLine(said);
      setPending(files);
    } finally {
      setThinking(false);
    }
  };

  /** The proposal as Josh has it: his in-place edits over what Grant Coach proposed. */
  const textOf = (m: ParagraphMsg) => edits[m.id] ?? m.payload?.after ?? "";

  const use = async (m: ParagraphMsg) => {
    const after = textOf(m).trim();
    if (!after) return;
    setUsing(m.id);
    try {
      await onUse(after);
      const payload = { ...(m.payload ?? {}), after };
      if (!m.id.startsWith("tmp-")) await markParagraphMessageUsed(m.id, payload);
      setMsgs((old) => old.map((x) => (x.id === m.id ? { ...x, payload: { ...payload, used: true } } : x)));
      setEditing(null);
    } catch (e) {
      toast.error(`Couldn't put it in: ${(e as Error).message}`);
    } finally {
      setUsing(null);
    }
  };

  /* A message's files in the thread: a thumbnail for an image, a chip for a PDF; either opens full size in a new tab. */
  const attachmentsOf = (m: ParagraphMsg) => {
    const list = m.payload?.attachments ?? [];
    if (!list.length) return null;
    return (
      <div className="flex flex-wrap gap-1.5 justify-end">
        {list.map((a) => {
          const url = urls[a.path];
          const open = () => { if (url) window.open(url, "_blank", "noopener"); };
          return isImage(a) ? (
            <button key={a.path} type="button" onClick={open} title={`${a.name} · open full size`} className="rounded-md overflow-hidden border border-white/15 bg-black/40 hover:border-white/40">
              {url ? <img src={url} alt={a.name} className="max-h-40 max-w-[260px] object-contain" /> : <span className="block h-20 w-28 animate-pulse bg-white/5" />}
            </button>
          ) : (
            <button key={a.path} type="button" onClick={open} title={`${a.name} · open`} className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[12px] text-white/80 hover:border-white/40">
              <FileText className="w-3.5 h-3.5" /> {a.name}
            </button>
          );
        })}
      </div>
    );
  };

  /* The big editing pop-up: the whole proposal in one tall box, the marks a toggle away, Use this at the bottom. */
  const open = editing ? msgs.find((m) => m.id === editing) ?? null : null;
  const editor = open && (
    <Dialog open onOpenChange={(o) => { if (!o) setEditing(null); }}>
      <DialogContent className="max-w-4xl w-[min(96vw,56rem)] bg-neutral-900 border-white/10 text-white p-0 gap-0 max-h-[92vh] flex flex-col">
        <DialogHeader className="px-5 py-3 border-b border-white/10 space-y-0">
          <DialogTitle className="text-white text-base">{section.title} · the paragraph with the change</DialogTitle>
          <p className="text-[12px] text-white/50">{open.payload?.why ?? "Change anything, then Use this. Nothing is approved until you approve the draft."}</p>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {showMarks ? (
            <DraftDiff before={open.payload?.before ?? current} after={textOf(open)} className="text-[15px] text-white whitespace-pre-wrap leading-relaxed" />
          ) : (
            <Textarea
              value={textOf(open)}
              onChange={(e) => setEdits((all) => ({ ...all, [open.id]: e.target.value }))}
              autoFocus
              className="w-full min-h-[60vh] bg-black/40 border-white/15 text-[15px] leading-relaxed text-white"
            />
          )}
        </div>
        <div className="px-4 py-3 border-t border-white/10 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowMarks((s) => !s)} className="bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white">
            {showMarks ? <><Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit</> : <><Eye className="w-3.5 h-3.5 mr-1.5" /> Show the marks</>}
          </Button>
          {edits[open.id] != null && edits[open.id] !== open.payload?.after && (
            <span className="text-[11px] text-amber-300">Edited by you · Use this puts your version in the box</span>
          )}
          <span className="ml-auto inline-flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(null)} className="bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white">Cancel</Button>
            <Button size="sm" onClick={() => void use(open)} disabled={using != null || !textOf(open).trim()} className="font-bold" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
              {using === open.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ArrowDownCircle className="w-4 h-4 mr-1.5" />} Use this
            </Button>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );

  const canSend = !thinking && (!!line.trim() || pending.length > 0);

  return (
    <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: GC_BLUE, backgroundColor: "#0a2238", boxShadow: `0 0 0 4px ${GC_BLUE}26, 0 16px 40px -12px ${GC_BLUE}99` }}>
      {editor}
      <div className="px-3 py-2 border-b flex items-center justify-between gap-2" style={{ backgroundColor: `${GC_BLUE}26`, borderColor: `${GC_BLUE}55` }}>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] inline-flex items-center gap-1.5" style={{ color: GC_BLUE }}>
          <MessageSquare className="w-3.5 h-3.5" /> Talk to Grant Coach about this paragraph
        </p>
        {thinking ? (
          <p className="text-[11px] font-bold inline-flex items-center gap-1.5 rounded-md px-2 py-0.5" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading it…</p>
        ) : (
          <p className="text-[11px] text-white/45 hidden md:block">Ask where a line goes, what to cut, or for a change · paste a screenshot · nothing changes until you click Use this, then approve</p>
        )}
      </div>
      {!kept && <p className="px-3 pt-2 text-[11px] text-amber-300">This conversation is not being saved yet — the table for it has not been added. It still works for now.</p>}
      {(msgs.length > 0 || thinking) && (
        <div ref={listRef} className="relative max-h-[480px] overflow-y-auto p-3 space-y-2.5">
          {msgs.map((m) => (
            <div key={m.id} data-msg className={m.role === "user" ? "flex flex-col items-end gap-1.5" : "space-y-2"}>
              {m.role === "user" ? (
                <>
                  {attachmentsOf(m)}
                  {m.content.trim() && (
                    <p className="max-w-[85%] rounded-xl px-3 py-1.5 text-sm text-white whitespace-pre-wrap border" style={{ backgroundColor: `${GC_BLUE}2e`, borderColor: `${GC_BLUE}55` }}>{m.content}</p>
                  )}
                </>
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
                          <span className="inline-flex items-center gap-1.5">
                            {/* Edit the proposal in place before using it (Josh, 2026-11-19). */}
                            <button type="button" onClick={() => { setShowMarks(false); setEditing(m.id); }} className="rounded-md px-2 py-1 text-[11px] font-semibold inline-flex items-center gap-1 border border-white/20 text-white/80 hover:bg-white/10 hover:text-white" title="Open it big and change the wording yourself before using it">
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button type="button" onClick={() => void use(m)} disabled={using != null || !textOf(m).trim()} className="rounded-md px-2.5 py-1 text-[11px] font-bold hover:opacity-90 inline-flex items-center gap-1 disabled:opacity-50" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
                              {using === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownCircle className="w-3.5 h-3.5" />} Use this
                            </button>
                          </span>
                        )}
                      </div>
                      {/* The marks against the paragraph as it stood when this was asked, not the box as it is now. */}
                      <DraftDiff before={m.payload.before ?? current} after={textOf(m)} className="px-3 py-2 text-sm text-white whitespace-pre-wrap leading-relaxed" />
                      {edits[m.id] != null && edits[m.id] !== m.payload.after && !m.payload.used && (
                        <p className="px-3 pb-2 text-[11px] text-amber-300">Edited by you · Use this puts your version in the box.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {thinking && <p className="text-sm text-white/50 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" style={{ color: GC_BLUE }} /> Reading the paragraph…</p>}
        </div>
      )}
      {/* The box: Ctrl+V with a screenshot on the clipboard, a drop, or the paperclip adds a file under it. */}
      <div
        className="p-3 flex gap-2 items-end"
        onDragOver={(e) => { if (Array.from(e.dataTransfer.types).includes("Files")) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(filesFrom(e.dataTransfer)); }}
        style={dragging ? { outline: `2px dashed ${GC_BLUE}`, outlineOffset: -6 } : undefined}
      >
        <div className="flex-1 min-w-0">
          {pending.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pending.map((f, i) => (
                <span key={`${f.name}-${i}`} className="relative inline-flex items-center rounded-md border border-white/15 bg-black/40 overflow-hidden">
                  {previews[i] ? <img src={previews[i]!} alt={f.name} className="h-20 max-w-[160px] object-contain" /> : <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-white/80"><FileText className="w-3.5 h-3.5" /> {f.name}</span>}
                  <button type="button" onClick={() => setPending((old) => old.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="absolute top-0.5 right-0.5 rounded-full bg-black/70 p-0.5 text-white/80 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Textarea
            value={line}
            onChange={(e) => setLine(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }}
            onPaste={(e) => { const files = filesFrom(e.clipboardData); if (files.length) { e.preventDefault(); addFiles(files); } }}
            rows={2}
            autoFocus
            placeholder='e.g. "Add a line that safety is a priority — where would you put it?" · "Is that too many numbers for an opening?" · or paste a screenshot'
            disabled={thinking}
            className="bg-neutral-950 border-white/15 text-white text-sm min-h-[56px]"
          />
          <p className="mt-1 text-[10px] text-white/30">Enter for a new line · Ctrl+Enter or the arrow sends · Ctrl+V pastes a screenshot · PNG, JPG, WebP or PDF, up to {MAX_ATTACHMENTS} a message</p>
        </div>
        <input ref={fileRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={thinking || pending.length >= MAX_ATTACHMENTS} aria-label="Attach a screenshot or a PDF" title="Attach a screenshot or a PDF" className="h-10 w-10 shrink-0 rounded-md inline-flex items-center justify-center border border-white/20 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40">
          <Paperclip className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => void send()} disabled={!canSend} aria-label="Send" className="h-10 w-10 shrink-0 rounded-md inline-flex items-center justify-center disabled:opacity-40" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
          {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
