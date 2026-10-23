// One question, one conversation. Grant Coach asks first, recommends, and
// writes when told; the answer lands in the box, Josh approves it, copies
// it into the funder's portal, and marks it pasted. The folder keeps all of
// it as NLA's copy of the application. (Josh, 2026-10-17.)
import { useEffect, useRef, useState } from "react";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, Check, Copy, ClipboardCheck } from "lucide-react";
import { draftWithGrantCoach, measure, type ChatMessage, type DraftFolder, type DraftItem, type LibraryEntry } from "@/lib/grantCoach/writer";
import type { Fact } from "@/lib/grantCoach/liveFacts";


interface StoredMessage { id: string; role: "user" | "coach"; content: string; created_at: string }

export interface QuestionItem extends DraftItem {
  status: "todo" | "in_progress" | "done" | "na";
  pasted_at?: string | null;
}

interface Props {
  folderId: string;
  folder: DraftFolder;
  /** The open question, or null for a conversation about the grant as a whole. */
  item: QuestionItem | null;
  library: LibraryEntry[];
  facts: Fact[];
  /** Everything answered elsewhere in the folder, for consistency. */
  answered: { section: string; label: string; answer: string }[];
  /** Save an answer or a status onto the item. */
  onPatch: (patch: Partial<QuestionItem>) => Promise<void>;
}

const OPENERS = [
  "I'm opening this question. What do you recommend, and what do you need from me?",
  "Which of our programs is the strongest request for this funder, and why?",
];

const GrantQuestionPanel = ({ folderId, folder, item, library, facts, answered, onPatch }: Props) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ["grant-messages", folderId, item?.id ?? "grant"];
  const { data: messages = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = supabase.from("grant_messages" as never).select("id, role, content, created_at").eq("folder_id", folderId).order("created_at");
      q = item ? q.eq("item_id", item.id) : q.is("item_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as StoredMessage[];
    },
  });

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [messages.length, busy]);

  const say = async (content: string) => {
    const line = content.trim();
    if (!line || busy) return;
    setBusy(true);
    setText("");
    try {
      const { error: e1 } = await supabase.from("grant_messages" as never).insert({ folder_id: folderId, item_id: item?.id ?? null, role: "user", content: line, created_by: user?.id ?? null } as never);
      if (e1) throw e1;
      await qc.invalidateQueries({ queryKey: key });
      const history: ChatMessage[] = [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: line }];
      const res = await draftWithGrantCoach({ mode: "chat", folder, item: item ?? undefined, answered, library, facts, messages: history });
      const reply = res.reply ?? "";
      const { error: e2 } = await supabase.from("grant_messages" as never).insert({ folder_id: folderId, item_id: item?.id ?? null, role: "coach", content: reply, created_by: user?.id ?? null } as never);
      if (e2) throw e2;
      if (res.answer && item) {
        // A new draft is new text: it needs approving again, and is not in the portal yet.
        await onPatch(item.status === "done" ? { answer: res.answer, status: "in_progress", pasted_at: null } : { answer: res.answer, status: item.status === "todo" ? "in_progress" : item.status });
        toast.success(`Answer drafted · ${res.words ?? measure(res.answer, "words")} words. Read it, then Approve.`);
      }
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error(`Grant Coach: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!item?.answer) return;
    try { await navigator.clipboard.writeText(item.answer); toast.success("Copied. Paste it into the portal."); }
    catch { toast.error("Couldn't copy. Select the text and copy it by hand."); }
  };

  const count = item ? measure(item.answer, item.limit_kind ?? "words") : 0;
  const over = !!(item?.limit_value && count > item.limit_value);

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950/60 p-3 space-y-3">
      {/* The transcript */}
      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-[12px] text-white/50">Grant Coach asks first, then writes when you say so. Start with one of these, or type your own.</p>
            <div className="flex flex-wrap gap-2">
              {(item ? [OPENERS[0]] : OPENERS).map((o) => (
                <button key={o} type="button" onClick={() => void say(o)} disabled={busy} className="text-left text-[12px] rounded-lg border border-white/15 px-2.5 py-1.5 text-white/75 hover:bg-white/10 hover:text-white">
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`text-[13px] leading-snug rounded-lg px-3 py-2 ${m.role === "user" ? "bg-white/[0.06] text-white ml-8" : "bg-[#38bdf8]/10 border border-[#38bdf8]/25 text-white/90 mr-8"}`}>
            <span className="block text-[10px] uppercase tracking-wide text-white/35 mb-0.5">{m.role === "user" ? "You" : "Grant Coach"}</span>
            {m.content}
          </div>
        ))}
        {busy && <p className="text-[12px] text-white/40 inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Grant Coach is thinking…</p>}
        <div ref={endRef} />
      </div>

      {/* Say something */}
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void say(text); } }}
          placeholder={item ? "Answer its questions, ask for a number, or say “draft it”." : "Ask about this grant: which program, how much, what to lead with."}
          rows={2}
          className="bg-neutral-950 border-neutral-800 text-white text-sm"
        />
        <div className="flex flex-col gap-1.5">
          <Button size="sm" onClick={() => void say(text)} disabled={busy || !text.trim()} className="font-bold" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }} aria-label="Send">
            <Send className="w-3.5 h-3.5" />
          </Button>
          {item && (
            <Button size="sm" variant="outline" onClick={() => void say(item.answer ? "Rewrite the answer now, keeping what works." : "Please draft the answer now.")} disabled={busy} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white" title="Skip the questions and write it">
              <Sparkles className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* The answer's state */}
      {item && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/[0.06]">
          <span className={`text-[11px] tabular-nums ${over ? "text-amber-300" : "text-white/45"}`}>
            {count.toLocaleString()}{item.limit_value ? ` / ${item.limit_value.toLocaleString()}` : ""} {item.limit_kind ?? "words"}{over ? " · over the limit" : ""}
          </span>
          <span className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => void copy()} disabled={!item.answer?.trim()} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white">
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
          </Button>
          {item.status !== "done" ? (
            <Button size="sm" onClick={() => void onPatch({ status: "done" })} disabled={!item.answer?.trim()} className="text-white bg-emerald-700 hover:bg-emerald-600">
              <Check className="w-3.5 h-3.5 mr-1.5" /> Approve
            </Button>
          ) : (
            <span className="text-[11px] text-emerald-300 inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Approved
              <button type="button" onClick={() => void onPatch({ status: "in_progress", pasted_at: null })} title="Take the approval back; the answer stays" className="text-white/45 hover:text-white underline underline-offset-2">Undo</button>
            </span>
          )}
          {item.pasted_at ? (
            <span className="text-[11px] text-sky-300 inline-flex items-center gap-1.5">
              <ClipboardCheck className="w-3.5 h-3.5" /> Pasted into the portal
              <button type="button" onClick={() => void onPatch({ pasted_at: null })} title="Not pasted after all; it stays approved" className="text-white/45 hover:text-white underline underline-offset-2">Undo</button>
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={() => void onPatch({ pasted_at: new Date().toISOString(), status: "done" })} disabled={!item.answer?.trim()} className="bg-transparent border-sky-400/40 text-sky-300 hover:bg-sky-400/10 hover:text-sky-200">
              <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" /> Mark pasted
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default GrantQuestionPanel;
