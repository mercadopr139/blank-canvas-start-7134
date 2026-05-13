import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Pillar } from "@/pages/admin/AdminMessageBoard";
import { PILLAR_COLOR } from "@/pages/admin/AdminMessageBoard";

interface Props {
  conversationId: string;
  currentUserId: string;
  pillar: Pillar;
  onSent: () => void;
}

const MessageInput = ({ conversationId, currentUserId, pillar, onSent }: Props) => {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  // "Send as important" resets to OFF after every send so it can never
  // fire by accident on the next message.
  const [important, setImportant] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pillarColor = PILLAR_COLOR[pillar];

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const { data: inserted, error } = await supabase
        .from("mb_messages")
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: trimmed,
          is_important: important,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Reset input + flag before firing the email so the UX feels
      // instant even if Resend takes a moment.
      setText("");
      setImportant(false);
      onSent();
      textareaRef.current?.focus();

      if (important && inserted?.id) {
        // Fire the per-conversation email blast. Failures here surface
        // in a toast but don't roll back the message — it's already in
        // the thread for everyone to see.
        const res = await supabase.functions.invoke("send-important-message", {
          body: { message_id: inserted.id },
        });
        if (res.error) {
          toast({
            title: "Message saved, but email failed",
            description: res.error.message,
            variant: "destructive",
            duration: 8000,
          });
        } else if (res.data?.sent !== undefined) {
          toast({
            title: `Important email sent`,
            description: `Delivered to ${res.data.sent} of ${res.data.attempted} ${res.data.attempted === 1 ? "person" : "people"}.`,
          });
        }
      }
    } catch (err) {
      toast({
        title: "Failed to send message",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-4 py-3 border-t border-white/[0.06] space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <div
            className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
            style={{ background: pillarColor }}
          />
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={important ? "Type an important message — recipients will be emailed..." : "Type a message... (Enter to send)"}
            rows={1}
            className="resize-none bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 text-sm pr-2 min-h-[42px] max-h-32 pl-3"
          />
        </div>

        <Button
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="h-9 w-9 text-white disabled:opacity-30 border-0 transition-colors"
          style={{ background: important ? "#f59e0b" : pillarColor }}
          title={important ? "Send + email recipients" : "Send"}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Send-as-important toggle — small, quiet, resets after each send */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={important}
          onChange={(e) => setImportant(e.target.checked)}
          className="sr-only peer"
        />
        <span
          className="w-7 h-4 bg-white/[0.08] rounded-full relative transition-colors peer-checked:bg-amber-500"
          aria-hidden="true"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${important ? "translate-x-3" : ""}`}
          />
        </span>
        <Flag
          className={`w-3 h-3 transition-colors ${important ? "text-amber-400" : "text-zinc-600"}`}
        />
        <span className={`text-[11px] transition-colors ${important ? "text-amber-300" : "text-zinc-500"}`}>
          Send as important {important && "· recipients will be emailed"}
        </span>
      </label>
    </div>
  );
};

export default MessageInput;
