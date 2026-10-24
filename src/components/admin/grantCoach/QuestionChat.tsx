// Grant Coach, in the question (Josh, 2026-10-22): open a question and talk
// it through the way you would with Claude — which program is strongest,
// what the numbers say, "write it", "fill in the amount and total cost too".
// The answer lands in the box above; other questions on the screen fill only
// when asked. One thread per question, kept with the folder.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Loader2, Send, Sparkles, Library } from "lucide-react";
import ResourcePanel from "@/components/admin/grantCoach/ResourcePanel";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { StoryDraftCard } from "@/components/admin/grantCoach/StoryBank";
import { draftWithGrantCoach, type DraftFolder, type LibraryEntry, type FunderBrief, type WriterStory } from "@/lib/grantCoach/writer";
import type { Fact } from "@/lib/grantCoach/liveFacts";
import type { StoryDraft } from "@/lib/grantCoach/stories";

interface Msg { id: string; role: "user" | "coach"; content: string; payload: { story_draft?: StoryDraft; story_done?: boolean; /** A draft answer Grant Coach wrote; it goes to the box only when Josh clicks. */ draft?: string; draft_story_id?: string | null; draft_words?: number } | null }
interface Q { id: string; section: string; label: string; detail: string | null; kind: string; answer: string | null; limit_kind?: "words" | "characters" | null; limit_value?: number | null; needs_case?: boolean }

interface Props {
  folderId: string;
  item: Q;
  /** What is in the box right now (it may not be saved yet). */
  draft: string;
  /** The other questions on the same screen, which Grant Coach fills only when asked. */
  siblings: Q[];
  folder: DraftFolder;
  library: LibraryEntry[];
  getFacts: () => Promise<Fact[]>;
  answered: () => { section: string; label: string; answer: string }[];
  funderBrief: FunderBrief | null;
  stories: WriterStory[];
  usedStoryIds: string[];
  userId: string | null;
  onAnswer: (text: string, storyId: string | null) => void;
  onFills: (fills: { id: string; answer: string }[]) => Promise<void>;
  /** Wipe this question clean: its conversation and its answer. */
  onStartOver: () => Promise<void>;
}

/** The draft's words: click to edit in place; the edit is kept when focus leaves. */
function DraftText({ text, onSave }: { text: string; onSave: (t: string) => void }) {
  const [value, setValue] = useState(text);
  useEffect(() => { setValue(text); }, [text]);
  const grow = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; };
  return (
    <Textarea
      value={value}
      onChange={(e) => { setValue(e.target.value); grow(e.currentTarget); }}
      onFocus={(e) => grow(e.currentTarget)}
      onBlur={() => onSave(value)}
      ref={(el) => { if (el) grow(el); }}
      rows={3}
      title="Click to edit this draft in place"
      className="px-3 py-2 text-sm text-white leading-relaxed bg-transparent border-0 rounded-none shadow-none resize-none min-h-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-white/[0.04]"
    />
  );
}

export default function QuestionChat({ folderId, item, draft, siblings, folder, library, getFacts, answered, funderBrief, stories, usedStoryIds, userId, onAnswer, onFills, onStartOver }: Props) {
  const qc = useQueryClient();
  const key = ["grant-chat", item.id];
  const [line, setLine] = useState("");
  const [thinking, setThinking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resources, setResources] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const startOver = async () => {
    const { error } = await supabase.from("grant_messages" as never).delete().eq("item_id", item.id);
    if (error) { toast.error(error.message); return; }
    qc.setQueryData<Msg[]>(key, []);
    await onStartOver();
    setConfirming(false);
    toast.success("Wiped clean. Start the conversation again.");
  };
  const listRef = useRef<HTMLDivElement>(null);
  const { data: msgs = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_messages" as never).select("id, role, content, payload").eq("item_id", item.id).order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Msg[];
    },
  });
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length, thinking]);

  const save = async (role: "user" | "coach", content: string, payload: Msg["payload"] = null) => {
    const { error } = await supabase.from("grant_messages" as never).insert({ folder_id: folderId, item_id: item.id, role, content, payload, created_by: userId } as never);
    if (error) throw new Error(error.message);
  };

  const send = async (text: string) => {
    const said = text.trim();
    if (!said || thinking) return;
    setLine("");
    setThinking(true);
    qc.setQueryData<Msg[]>(key, (old = []) => [...old, { id: `tmp-${Date.now()}`, role: "user", content: said, payload: null }]);
    try {
      await save("user", said);
      const sibs = siblings.map((q, k) => ({ i: k + 1, label: q.label, help: q.detail, kind: q.kind, answer: q.answer, limit_kind: q.limit_kind, limit_value: q.limit_value }));
      // The last draft card is the text a requested change is applied to.
      const currentDraft = [...msgs].reverse().find((m) => m.payload?.draft)?.payload?.draft ?? null;
      const res = await draftWithGrantCoach({
        mode: "chat", folder, library, facts: await getFacts(), answered: answered(), funderBrief, stories, usedStoryIds, currentDraft,
        item: { id: item.id, section: item.section, label: item.label, detail: item.detail, kind: item.kind, answer: draft.trim() || item.answer, limit_kind: item.limit_kind, limit_value: item.limit_value },
        messages: [...msgs.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: said }],
        siblings: sibs,
      });
      // Nothing left out silently: if the reply did not say it, the list is added to it.
      const left = res.left_out ?? [];
      const reply = (res.reply ?? "Here it is.") + (left.length && !/left out/i.test(res.reply ?? "") ? `

Left out: ${left.join("; ")}` : "");
      // The draft stays in the chat until Josh says it is the answer.
      const payload: Msg["payload"] = {
        ...(res.story_draft ? { story_draft: res.story_draft } : {}),
        ...(res.answer ? { draft: res.answer, draft_story_id: res.story_id ?? null, draft_words: res.words } : {}),
      };
      await save("coach", reply, Object.keys(payload ?? {}).length ? payload : null);
      if (res.fills?.length) {
        const mapped = res.fills.map((f) => ({ id: siblings[f.i - 1]?.id, answer: f.answer })).filter((f): f is { id: string; answer: string } => !!f.id);
        if (mapped.length) { await onFills(mapped); toast.success(`Filled ${mapped.length} more question${mapped.length === 1 ? "" : "s"} on this screen. Approve them when you get there.`); }
      }
    } catch (e) {
      toast.error(`Grant Coach: ${(e as Error).message}`);
    } finally {
      setThinking(false);
      qc.invalidateQueries({ queryKey: key });
    }
  };

  // An edit typed into a draft card is kept on the message, so it survives a reload
  // and is what "Use this as my answer" sends.
  const editDraft = async (m: Msg, text: string) => {
    const next = text.trim();
    if (!next || next === (m.payload?.draft ?? "").trim()) return;
    const payload = { ...(m.payload ?? {}), draft: next, draft_words: next.split(/\s+/).filter(Boolean).length };
    qc.setQueryData<Msg[]>(key, (old = []) => old.map((x) => (x.id === m.id ? { ...x, payload } : x)));
    const { error } = await supabase.from("grant_messages" as never).update({ payload } as never).eq("id", m.id);
    if (error) toast.error(`Couldn't keep that edit: ${error.message}`);
  };

  const settle = async (m: Msg) => {
    await supabase.from("grant_messages" as never).update({ payload: { ...(m.payload ?? {}), story_done: true } } as never).eq("id", m.id);
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${GC_BLUE}66`, backgroundColor: `${GC_BLUE}0f` }}>
      {/* The chat wears the Finance blue: a header band and a tint, so it never reads as the answer box under it. */}
      <div className="px-3 py-2 border-b flex items-center justify-between gap-2" style={{ backgroundColor: `${GC_BLUE}26`, borderColor: `${GC_BLUE}55` }}>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] inline-flex items-center gap-1.5" style={{ color: GC_BLUE }}>
          <Sparkles className="w-3.5 h-3.5" /> Grant Coach · the conversation
        </p>
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-white/45 hidden md:block">Drafts land here first · "Use this as my answer" puts one in the box below</p>
          <button
            type="button"
            onClick={() => setResources(true)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold ${resources ? "text-black" : "text-white/85 hover:bg-white/10"}`}
            style={resources ? { backgroundColor: GC_BLUE, borderColor: GC_BLUE } : { borderColor: `${GC_BLUE}88` }}
          >
            <Library className="w-3.5 h-3.5" /> Resources
          </button>
        </div>
      </div>
      {(msgs.length > 0 || !!draft.trim()) && (
        <div className="px-3 pt-2 flex justify-end items-center gap-2 text-[11px]">
          {confirming ? (
            <>
              <span className="text-white/60">Clear this conversation and the answer box?</span>
              <button type="button" onClick={() => void startOver()} disabled={thinking} className="font-semibold text-red-300 hover:text-red-200">Yes, start over</button>
              <button type="button" onClick={() => setConfirming(false)} className="text-white/50 hover:text-white">Keep it</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} disabled={thinking} className="text-white/45 hover:text-white underline underline-offset-2">Start over</button>
          )}
        </div>
      )}
      {(msgs.length > 0 || thinking) && (
        <div ref={listRef} className="max-h-[420px] overflow-y-auto p-3 space-y-2.5">
          {msgs.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "space-y-2"}>
              {m.role === "user" ? (
                <p className="max-w-[85%] rounded-xl bg-white/[0.1] px-3 py-1.5 text-sm text-white whitespace-pre-wrap">{m.content}</p>
              ) : (
                <>
                  <p className="max-w-[92%] text-sm text-white/90 whitespace-pre-wrap leading-relaxed"><span className="font-bold mr-1.5" style={{ color: GC_BLUE }}>Grant Coach</span>{m.content}</p>
                  {m.payload?.draft && (
                    <div className="max-w-[92%] rounded-lg border bg-black/40 overflow-hidden" style={{ borderColor: `${GC_BLUE}66` }}>
                      <div className="px-3 py-1.5 border-b flex items-center justify-between gap-2" style={{ borderColor: `${GC_BLUE}33`, backgroundColor: `${GC_BLUE}14` }}>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: GC_BLUE }}>Draft{m.payload.draft_words ? ` · ${m.payload.draft_words} words` : ""}<span className="ml-2 font-semibold normal-case tracking-normal text-white/40">click to edit · Enter for a new paragraph</span></p>
                        {draft.trim() === m.payload.draft.trim() ? (
                          <p className="text-[11px] font-semibold text-emerald-300 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> In the answer box</p>
                        ) : (
                          <button type="button" onClick={() => onAnswer(m.payload!.draft!, m.payload!.draft_story_id ?? null)} className="rounded-md px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
                            Use this as my answer
                          </button>
                        )}
                      </div>
                      <DraftText text={m.payload.draft} onSave={(t) => void editDraft(m, t)} />
                    </div>
                  )}
                  {m.payload?.story_draft && !m.payload.story_done && (
                    <StoryDraftCard draft={m.payload.story_draft} folderId={folderId} onSaved={() => void settle(m)} onDismiss={() => void settle(m)} />
                  )}
                </>
              )}
            </div>
          ))}
          {thinking && <p className="text-sm text-white/50 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" style={{ color: GC_BLUE }} /> Grant Coach is thinking…</p>}
        </div>
      )}
      <ResourcePanel open={resources} onOpenChange={setResources} stories={stories} />
      <div className="p-3 flex gap-2 items-end">
        {/* Room to see whole paragraphs while typing; the box grows with the text. */}
        <div className="flex-1 min-w-0">
          <Textarea
            ref={inputRef}
            value={line}
            onChange={(e) => {
              setLine(e.target.value);
              e.currentTarget.style.height = "auto";
              e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 560)}px`;
            }}
            // Enter is a new paragraph (Josh, 2026-10-24: paste a whole answer with its paragraphs); Ctrl+Enter sends.
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(line); } }}
            rows={8}
            placeholder="Ask Grant Coach anything about this question, or say “write it”…"
            className="min-h-[200px] max-h-[560px] bg-black/50 text-white text-base leading-relaxed resize-y"
            style={{ borderColor: `${GC_BLUE}66` }}
          />
          <p className="mt-1 text-[11px] text-white/35">Enter for a new paragraph · Ctrl+Enter or the arrow sends</p>
        </div>
        <Button onClick={() => void send(line)} disabled={thinking || !line.trim()} className="font-bold shrink-0 mb-5" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }} aria-label="Send"><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
