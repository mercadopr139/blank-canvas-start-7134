import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pillarColor = PILLAR_COLOR[pillar];

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from("mb_messages")
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: trimmed,
        });
      if (error) throw error;
      setText("");
      onSent();
      textareaRef.current?.focus();
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
    <div className="px-4 py-3 border-t border-white/[0.06]">
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
            placeholder="Type a message... (Enter to send)"
            rows={1}
            className="resize-none bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 text-sm pr-2 min-h-[42px] max-h-32 pl-3"
          />
        </div>

        <Button
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="h-9 w-9 text-white disabled:opacity-30 border-0"
          style={{ background: pillarColor }}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
