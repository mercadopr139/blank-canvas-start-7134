import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Flag, Paperclip, X, FileText, Image as ImageIcon, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Pillar } from "@/pages/admin/AdminMessageBoard";
import { PILLAR_COLOR } from "@/pages/admin/AdminMessageBoard";

interface Props {
  conversationId: string;
  currentUserId: string;
  pillar: Pillar;
  onSent: () => void;
}

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100MB per file — sized for the scanned PDFs Josh + Chrissy share for review
const ACCEPTED = "image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,.doc";

const formatBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const fileIcon = (mime: string) => {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime === "application/pdf") return FileText;
  return File;
};

const safeFilename = (name: string) =>
  `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80)}`;

const MessageInput = ({ conversationId, currentUserId, pillar, onSent }: Props) => {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [important, setImportant] = useState(false);
  const [queue, setQueue] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pillarColor = PILLAR_COLOR[pillar];

  const handlePickFiles = () => fileInputRef.current?.click();

  const handleFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    const tooBig = picked.filter((f) => f.size > MAX_FILE_BYTES);
    if (tooBig.length > 0) {
      toast({
        title: `${tooBig.length} file${tooBig.length === 1 ? "" : "s"} too large`,
        description: `Max ${formatBytes(MAX_FILE_BYTES)} per file.`,
        variant: "destructive",
      });
    }
    const ok = picked.filter((f) => f.size <= MAX_FILE_BYTES);
    setQueue((prev) => [...prev, ...ok]);
    // Reset input so picking the same file twice in a row still fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeQueued = (idx: number) =>
    setQueue((prev) => prev.filter((_, i) => i !== idx));

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && queue.length === 0) return;
    setSending(true);
    try {
      // 1. Insert the message row first so we have a message_id to scope
      //    the attachment storage paths and FK references.
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
      const messageId = inserted.id;

      // 2. Upload each queued file under <conversation_id>/<message_id>/<safe>.
      //    Storage RLS keys off the first path segment as conversation_id,
      //    so this convention is load-bearing — don't reshape without
      //    updating the storage policies in the phase 1 migration.
      let uploadFailures = 0;
      if (queue.length > 0) {
        const uploads = await Promise.allSettled(
          queue.map(async (file) => {
            const safe = safeFilename(file.name);
            const path = `${conversationId}/${messageId}/${safe}`;
            const { error: upErr } = await supabase.storage
              .from("message-attachments")
              .upload(path, file, {
                contentType: file.type || "application/octet-stream",
                upsert: false,
              });
            if (upErr) throw upErr;
            const { error: rowErr } = await supabase
              .from("mb_attachments")
              .insert({
                message_id: messageId,
                storage_path: path,
                filename: file.name,
                mime_type: file.type || "application/octet-stream",
                size_bytes: file.size,
              });
            if (rowErr) throw rowErr;
          })
        );
        uploadFailures = uploads.filter((r) => r.status === "rejected").length;
      }

      // 3. Reset the composer before firing the important-email so the
      //    UX feels instant even if Resend takes a moment.
      setText("");
      setImportant(false);
      setQueue([]);
      onSent();
      textareaRef.current?.focus();

      if (uploadFailures > 0) {
        toast({
          title: `${uploadFailures} attachment${uploadFailures === 1 ? "" : "s"} failed to upload`,
          description: "The message was sent, but some files didn't attach.",
          variant: "destructive",
          duration: 8000,
        });
      }

      if (important) {
        const res = await supabase.functions.invoke("send-important-message", {
          body: { message_id: messageId },
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

  const canSend = (text.trim().length > 0 || queue.length > 0) && !sending;

  return (
    <div className="px-4 py-3 border-t border-white/[0.06] space-y-2 w-full min-w-0">
      {/* Pending attachments queue */}
      {queue.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {queue.map((file, i) => {
            const Icon = fileIcon(file.type);
            return (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] rounded-md pl-2 pr-1 py-1 text-xs text-zinc-300 max-w-[220px]"
              >
                <Icon className="w-3 h-3 text-zinc-500 shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="text-[10px] text-zinc-500 shrink-0">{formatBytes(file.size)}</span>
                <button
                  onClick={() => removeQueued(i)}
                  className="text-zinc-500 hover:text-zinc-200 p-0.5 rounded shrink-0"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-2 w-full min-w-0">
        {/* min-w-0 on both the wrapper AND the textarea, plus cols={1},
            lets the textarea actually shrink below its default 20-col
            intrinsic width. Without this, iOS Safari pushes the
            paperclip + send buttons past the viewport edge on narrow
            screens. */}
        <div className="flex-1 min-w-0 relative">
          <div
            className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r pointer-events-none"
            style={{ background: pillarColor }}
          />
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={important ? "Important message — recipients will be emailed..." : "Type a message..."}
            rows={1}
            cols={1}
            className="resize-none bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 text-sm pr-2 min-h-[42px] max-h-32 pl-3 w-full min-w-0"
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          onChange={handleFilesChosen}
          className="hidden"
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handlePickFiles}
          disabled={sending}
          className="h-9 w-9 shrink-0 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] border-0"
          title="Attach files (image, PDF, Word doc — up to 25MB each)"
        >
          <Paperclip className="w-4 h-4" />
        </Button>

        <Button
          size="icon"
          onClick={handleSend}
          disabled={!canSend}
          className="h-9 w-9 shrink-0 text-white disabled:opacity-30 border-0 transition-colors"
          style={{ background: important ? "#f59e0b" : pillarColor }}
          title={important ? "Send + email recipients" : "Send"}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

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
        <span className={`text-[11px] transition-colors ${important ? "text-amber-300" : "text-zinc-500"} truncate`}>
          Send as important{important && <span className="hidden sm:inline"> · recipients will be emailed</span>}
        </span>
      </label>
    </div>
  );
};

export default MessageInput;
