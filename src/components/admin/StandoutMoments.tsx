import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

// A bulleted notepad (same feel as Trip Overview / Trip Debrief) for short, real
// "standout moments" — participant wins, quotes, breakthroughs. Each non-empty
// line is stored as one discrete story in the row's `highlights` JSON array, so
// the Program Highlights report can feature them specifically. Self-contained:
// loads and autosaves on its own.
interface Props {
  table: "excursions" | "program_events";
  rowId: string | null; // null = unsaved item; nothing to attach to yet
}

const EMOJI = ["🥊", "⭐", "🏆", "🎉", "🙌", "💬", "❤️", "✅"];

// Bulleted text ⇆ clean string[] (one story per line, bullet markers stripped).
const arrayToText = (arr: string[]): string => (arr.length ? arr.map((s) => "• " + s).join("\n") : "");
const textToArray = (text: string): string[] =>
  text.split("\n").map((l) => l.replace(/^\s*•\s?/, "").trim()).filter((l) => l.length > 0);

const StandoutMoments = ({ table, rowId }: Props) => {
  const queryClient = useQueryClient();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const initedFor = useRef<string | null>(null);
  const lastSavedRef = useRef("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  const { data: saved = [] } = useQuery({
    queryKey: ["standout-moments", table, rowId],
    enabled: !!rowId,
    queryFn: async () => {
      const { data, error } = await (supabase.from(table as never) as any)
        .select("highlights").eq("id", rowId).single();
      if (error) throw error;
      return Array.isArray(data?.highlights) ? (data.highlights as string[]) : [];
    },
  });

  // Seed the textarea from the saved value once per rowId; don't re-sync on later
  // refetches so autosave never clobbers what's being typed.
  useEffect(() => {
    if (rowId && initedFor.current !== rowId && Array.isArray(saved)) {
      const seeded = arrayToText(saved);
      setText(seeded);
      lastSavedRef.current = seeded;
      initedFor.current = rowId;
    }
    if (!rowId) { initedFor.current = null; setText(""); lastSavedRef.current = ""; }
  }, [rowId, saved]);

  const save = async () => {
    if (!rowId) return;
    const current = text;
    setStatus("saving");
    const { error } = await (supabase.from(table as never) as any)
      .update({ highlights: textToArray(current) }).eq("id", rowId);
    if (error) { toast.error("Couldn't save standout moments"); setStatus("idle"); return; }
    lastSavedRef.current = current;
    setStatus("saved");
    // Let the Program Highlights report pick up the change.
    queryClient.invalidateQueries({ queryKey: ["highlights-excursions"] });
    queryClient.invalidateQueries({ queryKey: ["highlights-events"] });
  };

  // Autosave ~1.2s after the last change (typing OR voice-to-text), so content
  // persists even if the field never loses focus. The onBlur save stays too.
  useEffect(() => {
    if (!rowId || text === lastSavedRef.current) return;
    const t = setTimeout(() => { void save(); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, rowId]);

  // Enter starts a new bullet — mirrors the Overview/Debrief notepads.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const el = e.currentTarget;
      const pos = el.selectionStart ?? text.length;
      const next = text.slice(0, pos) + "\n• " + text.slice(pos);
      setText(next);
      requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = pos + 3; });
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = ref.current;
    if (!el) { setText(text + emoji); return; }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + emoji.length; });
  };

  if (!rowId) {
    return <p className="text-xs text-white/30 italic">Save this first, then reopen to add standout moments.</p>;
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="text-xs px-2 py-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-white/70 transition-colors">
              😀 Emoji
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 bg-neutral-900 border-white/15 p-2">
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJI.map((em) => (
                <button key={em} type="button" onClick={() => insertEmoji(em)}
                  className="text-lg leading-none w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center">
                  {em}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {status === "saving" ? (
          <span className="text-[10px] text-white/40">Saving…</span>
        ) : status === "saved" ? (
          <span className="text-[10px] text-emerald-300/80">Saved ✓</span>
        ) : null}
      </div>
      <Textarea
        ref={ref}
        value={text}
        onChange={(e) => { setStatus("idle"); setText(e.target.value); }}
        onFocus={() => { if (!text) setText("• "); }}
        onKeyDown={onKeyDown}
        onBlur={save}
        rows={4}
        placeholder="e.g. Justin Banks won the most-spirited award…"
        className="bg-white/5 border-white/15 text-white placeholder:text-white/30 min-h-[96px]"
      />
      <p className="text-[10px] text-white/30 mt-1">Autosaves · Enter = new bullet · each line becomes a featured story in the Program Highlights report.</p>
    </div>
  );
};

export default StandoutMoments;
