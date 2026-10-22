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
import { Loader2, Send, Sparkles } from "lucide-react";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { StoryDraftCard } from "@/components/admin/grantCoach/StoryBank";
import { draftWithGrantCoach, type DraftFolder, type LibraryEntry, type FunderBrief, type WriterStory } from "@/lib/grantCoach/writer";
import type { Fact } from "@/lib/grantCoach/liveFacts";
import type { StoryDraft } from "@/lib/grantCoach/stories";

interface Msg { id: string; role: "user" | "coach"; content: string; payload: { story_draft?: StoryDraft; story_done?: boolean } | null }
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

export default function QuestionChat({ folderId, item, draft, siblings, folder, library, getFacts, answered, funderBrief, stories, usedStoryIds, userId, onAnswer, onFills, onStartOver }: Props) {
  const qc = useQueryClient();
  const key = ["grant-chat", item.id];
  const [line, setLine] = useState("");
  const [thinking, setThinking] = useState(false);
  const [confirming, setConfirming] = useState(false);
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
      const res = await draftWithGrantCoach({
        mode: "chat", folder, library, facts: await getFacts(), answered: answered(), funderBrief, stories, usedStoryIds,
        item: { id: item.id, section: item.section, label: item.label, detail: item.detail, kind: item.kind, answer: draft.trim() || item.answer, limit_kind: item.limit_kind, limit_value: item.limit_value },
        messages: [...msgs.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: said }],
        siblings: sibs,
      });
      // Nothing left out silently: if the reply did not say it, the list is added to it.
      const left = res.left_out ?? [];
      const reply = (res.reply ?? "Here it is.") + (left.length && !/left out/i.test(res.reply ?? "") ? `

Left out: ${left.join("; ")}` : "");
      await save("coach", reply, res.story_draft ? { story_draft: res.story_draft } : null);
      if (res.answer) onAnswer(res.answer, res.story_id ?? null);
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

  const settle = async (m: Msg) => {
    await supabase.from("grant_messages" as never).update({ payload: { ...(m.payload ?? {}), story_done: true } } as never).eq("id", m.id);
    qc.invalidateQueries({ queryKey: key });
  };

  // A few ways in, for a question with no conversation yet.
  const starters = item.needs_case
    ? ["Which of our programs is strongest for this funder?", "What numbers back that up?", "Write it"]
    : ["Write it", "What should this say?", "Make it stronger"];

  return (
    <div className="rounded-xl border bg-black/30" style={{ borderColor: `${GC_BLUE}40` }}>
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
                <p className="max-w-[85%] rounded-xl bg-white/[0.08] px-3 py-1.5 text-sm text-white whitespace-pre-wrap">{m.content}</p>
              ) : (
                <>
                  <p className="max-w-[92%] text-sm text-white/90 whitespace-pre-wrap leading-relaxed"><span className="font-bold mr-1.5" style={{ color: GC_BLUE }}>Grant Coach</span>{m.content}</p>
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
      {msgs.length === 0 && !thinking && (
        <div className="px-3 pt-3 flex flex-wrap gap-1.5">
          {starters.map((t) => (
            <button key={t} type="button" onClick={() => void send(t)} className="rounded-full border border-white/15 px-2.5 py-1 text-[12px] text-white/75 hover:bg-white/10 hover:text-white inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" style={{ color: GC_BLUE }} /> {t}
            </button>
          ))}
        </div>
      )}
      <div className="p-3 flex gap-2 items-end">
        <Textarea
          value={line}
          onChange={(e) => setLine(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(line); } }}
          rows={1}
          placeholder="Ask Grant Coach anything about this question, or say “write it”…"
          className="min-h-[40px] bg-neutral-950 border-white/15 text-white text-sm"
        />
        <Button onClick={() => void send(line)} disabled={thinking || !line.trim()} className="text-white shrink-0" style={{ backgroundColor: "#bf0f3e" }} aria-label="Send"><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
