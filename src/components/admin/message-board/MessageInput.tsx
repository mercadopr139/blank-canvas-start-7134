import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, CheckSquare, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MessageTaskForm from "./MessageTaskForm";

interface Props {
  conversationId: string;
  currentUserId: string;
  onSent: () => void;
}

const MessageInput = ({ conversationId, currentUserId, onSent }: Props) => {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const { error } = await (supabase.from("mb_messages") as any).insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: trimmed,
        message_type: "text",
      });
      if (error) throw error;
      setText("");
      onSent();
      textareaRef.current?.focus();
    } catch (err: any) {
      toast({ title: "Failed to send message", description: err.message, variant: "destructive" });
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

  const handleTaskCreated = (taskId: string) => {
    setTaskFormOpen(false);
    onSent();
  };

  return (
    <>
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="resize-none bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-[#bf0f3e]/50 text-sm pr-2 min-h-[42px] max-h-32"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 pb-0.5">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setTaskFormOpen(true)}
              className="h-9 w-9 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
              title="Create task"
            >
              <CheckSquare className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="h-9 w-9 bg-[#bf0f3e] hover:bg-[#a00d34] text-white disabled:opacity-30"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <MessageTaskForm
        open={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        conversationId={conversationId}
        currentUserId={currentUserId}
        onCreated={handleTaskCreated}
      />
    </>
  );
};

export default MessageInput;
