import { Fragment, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, User, MoreHorizontal, Trash2, Pencil, X, ArrowLeft, Eye, Flag, FileText, File as FileIcon, Download, Signal as SignalIcon } from "lucide-react";
import MessageInput from "./MessageInput";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Conversation } from "@/pages/admin/AdminMessageBoard";
import { PILLAR_COLOR, PILLAR_LABEL } from "@/pages/admin/AdminMessageBoard";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// Turn http(s) URLs into clickable anchors while preserving everything
// else as plain text. Returns an array of strings + JSX elements that
// React can render inline.
const URL_REGEX = /\bhttps?:\/\/[^\s<>"'`)]+/gi;
const linkify = (text: string): (string | JSX.Element)[] => {
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a
        key={`link-${match.index}`}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-current/40 hover:decoration-current break-all"
      >
        {match[0]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
};

const formatBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

// JS-based blob download. The `<a download>` attribute is silently
// ignored on cross-origin URLs, and Supabase storage lives on its own
// `*.supabase.co` domain — so the previous `<a href={signedUrl} download>`
// just opened the file in a new tab. Fetching as a blob and triggering
// a same-origin object-URL download works for any mime type.
const triggerBlobDownload = async (url: string, filename: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the click has had a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

// Per-attachment renderer. Images load via short-lived signed URLs from
// the private bucket; clicking expands to a lightbox. Non-image files
// render as a download card and produce a signed URL on demand.
const MessageAttachmentView = ({ attachment }: { attachment: Attachment }) => {
  const isImage = attachment.mime_type.startsWith("image/");
  const isPdf = attachment.mime_type === "application/pdf";
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const { data: signedUrl } = useQuery<string | null>({
    queryKey: ["mb-attachment-url", attachment.storage_path],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("message-attachments")
        .createSignedUrl(attachment.storage_path, 60 * 60);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
    // Refresh well before the 1-hour expiry so long-open threads don't
    // serve dead URLs.
    staleTime: 50 * 60 * 1000,
  });

  const handleDownload = async () => {
    if (!signedUrl || downloading) return;
    setDownloading(true);
    try {
      await triggerBlobDownload(signedUrl, attachment.filename);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  if (isImage) {
    return (
      <>
        <button
          type="button"
          onClick={() => signedUrl && setLightboxOpen(true)}
          className="block max-w-xs overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04] hover:border-white/[0.16] transition-colors"
          title={attachment.filename}
        >
          {signedUrl ? (
            <img
              src={signedUrl}
              alt={attachment.filename}
              className="block max-h-60 w-auto object-contain"
            />
          ) : (
            <div className="w-48 h-32 flex items-center justify-center text-zinc-600 text-xs">
              Loading…
            </div>
          )}
        </button>
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="bg-neutral-950 border-white/[0.08] text-white max-w-4xl w-[95vw] max-h-[90vh] p-2 flex flex-col">
            {signedUrl && (
              <img
                src={signedUrl}
                alt={attachment.filename}
                className="max-h-[85vh] w-auto mx-auto object-contain"
              />
            )}
            <div className="flex items-center justify-between px-2 pt-1 text-xs text-zinc-400">
              <span className="truncate">{attachment.filename}</span>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!signedUrl || downloading}
                className="flex items-center gap-1 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3 h-3" /> {downloading ? "Downloading…" : "Download"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const Icon = isPdf ? FileText : FileIcon;
  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={!signedUrl || downloading}
      className="inline-flex items-center gap-3 max-w-xs px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.06] transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
      title={`Download ${attachment.filename}`}
    >
      <Icon className="w-5 h-5 text-zinc-400 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-zinc-200 font-medium truncate">{attachment.filename}</p>
        <p className="text-[10px] text-zinc-500">
          {downloading ? "Downloading…" : formatBytes(attachment.size_bytes)}
        </p>
      </div>
      <Download className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
    </button>
  );
};

export type Attachment = {
  id: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_important: boolean;
  created_at: string;
  sender_name?: string;
  attachments?: Attachment[];
};

interface Props {
  conversation: Conversation;
  currentUserId: string;
  isSuperAdmin: boolean;
  /** False when super admin is auditing a conversation they're not a member of */
  canPost: boolean;
  /** When set, scroll that message into view once messages load (search jump) */
  scrollToMessageId: string | null;
  /** Mobile back-to-list action (hidden on lg+) */
  onBackToList: () => void;
  onConversationUpdated?: () => void;
  /** Fire after last_read_at is updated so the parent can refresh unread badges */
  onMessageRead?: () => void;
  /** Opens the Add-to-Workbench modal pre-filled from this specific message */
  onAddMessageToWorkbench: (messageId: string, content: string) => void;
}

const formatMessageTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const formatDateDivider = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
};

const isSameDay = (a: string, b: string) =>
  new Date(a).toDateString() === new Date(b).toDateString();

const MessageThread = ({ conversation, currentUserId, isSuperAdmin, canPost, scrollToMessageId, onBackToList, onConversationUpdated, onMessageRead, onAddMessageToWorkbench }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [editingConv, setEditingConv] = useState(false);
  const [convName, setConvName] = useState(conversation.name || "");
  const [savingConv, setSavingConv] = useState(false);

  const convTitle = conversation.name?.trim() || "Untitled conversation";
  const recipients = conversation.member_names?.join(", ") || "";

  const pillarColor = PILLAR_COLOR[conversation.pillar];
  const pillarLabel = PILLAR_LABEL[conversation.pillar];

  // All conversations have titles now — both DMs and groups. Rename is
  // gated to the creator or super admin.
  const canEditConv = conversation.created_by === currentUserId || isSuperAdmin;

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["mb-messages", conversation.id],
    queryFn: async () => {
      // Nested select pulls each message's attachments in one round-trip
      // via the FK relationship on mb_attachments.message_id.
      const { data, error } = await supabase
        .from("mb_messages")
        .select(
          "id, conversation_id, sender_id, content, is_important, created_at, " +
          "mb_attachments(id, storage_path, filename, mime_type, size_bytes)"
        )
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const senderIds = [...new Set((data || []).map((m) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("staff_profiles")
        .select("user_id, full_name, display_name")
        .in("user_id", senderIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p) => {
        nameMap[p.user_id] = (p.display_name?.trim() || p.full_name) as string;
      });

      return (data || []).map((m) => ({
        ...m,
        sender_name: nameMap[m.sender_id] || "Unknown",
        attachments: ((m as { mb_attachments?: Attachment[] }).mb_attachments || []) as Attachment[],
      })) as Message[];
    },
    enabled: !!conversation.id,
  });

  // Mark this conversation as read for the current user whenever they
  // switch to it. Skipped when super admin is auditing as non-member
  // (RLS would reject the update anyway, but we save the round trip).
  useEffect(() => {
    if (!conversation.id || !currentUserId || !canPost) return;
    (async () => {
      await supabase
        .from("mb_conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversation.id)
        .eq("user_id", currentUserId);
      onMessageRead?.();
    })();
  }, [conversation.id, currentUserId, canPost, onMessageRead]);

  // Scroll behavior: if the parent passed a specific message id (from a
  // search hit), jump there with a brief highlight. Otherwise, scroll to
  // the bottom whenever new messages arrive.
  useEffect(() => {
    if (scrollToMessageId && messages.length > 0) {
      const el = document.getElementById(`message-${scrollToMessageId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-amber-400/60", "rounded-2xl");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-amber-400/60", "rounded-2xl");
        }, 2000);
        return;
      }
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, scrollToMessageId]);

  useEffect(() => {
    setConvName(conversation.name || "");
  }, [conversation.id, conversation.name]);

  const handleMessageSent = () => {
    queryClient.invalidateQueries({ queryKey: ["mb-messages", conversation.id] });
    queryClient.invalidateQueries({ queryKey: ["mb-conversations"] });
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      const { error } = await supabase
        .from("mb_messages")
        .delete()
        .eq("id", msgId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["mb-messages", conversation.id] });
      queryClient.invalidateQueries({ queryKey: ["mb-conversations"] });
    } catch (err) {
      toast({
        title: "Failed to delete message",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  // Flag a sent message as important. Mirrors the compose-time toggle:
  // sets is_important and fires the email blast. One-way per spec —
  // no unflag — so the menu hides the option for already-important
  // messages.
  const handleFlagImportant = async (msgId: string) => {
    try {
      const { error: rpcErr } = await supabase.rpc("mb_mark_message_important", { msg_id: msgId });
      if (rpcErr) throw rpcErr;
      queryClient.invalidateQueries({ queryKey: ["mb-messages", conversation.id] });
      queryClient.invalidateQueries({ queryKey: ["mb-conversations"] });

      const res = await supabase.functions.invoke("send-important-message", {
        body: { message_id: msgId },
      });
      if (res.error) {
        toast({
          title: "Flagged, but email failed",
          description: res.error.message,
          variant: "destructive",
          duration: 8000,
        });
      } else if (res.data?.sent !== undefined) {
        toast({
          title: `Flagged as important · email sent`,
          description: `Delivered to ${res.data.sent} of ${res.data.attempted} ${res.data.attempted === 1 ? "person" : "people"}.`,
        });
      }
    } catch (err) {
      toast({
        title: "Failed to flag message",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleSaveConversation = async () => {
    setSavingConv(true);
    try {
      const { error } = await supabase
        .from("mb_conversations")
        .update({ name: convName.trim() || null })
        .eq("id", conversation.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["mb-conversations"] });
      onConversationUpdated?.();
      setEditingConv(false);
      toast({ title: "Conversation updated" });
    } catch (err) {
      toast({
        title: "Failed to update",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingConv(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Thread header */}
      {editingConv ? (
        <div
          className="px-4 py-3 border-b space-y-3"
          style={{ borderColor: `${pillarColor}30` }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Edit Conversation</span>
            <button onClick={() => setEditingConv(false)} className="text-zinc-600 hover:text-zinc-400 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Pillar is locked once set — display only, no picker */}
          <div>
            <p className="text-[11px] text-zinc-500 mb-1.5">Pillar (locked)</p>
            <span
              className="inline-block text-xs font-medium px-2.5 py-1 rounded-lg border"
              style={{ background: `${pillarColor}20`, borderColor: pillarColor, color: pillarColor }}
            >
              {pillarLabel}
            </span>
          </div>

          <div>
            <p className="text-[11px] text-zinc-500 mb-1.5">Title</p>
            <input
              value={convName}
              onChange={(e) => setConvName(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/20"
              placeholder="Conversation title..."
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEditingConv(false)}
              className="flex-1 py-1.5 rounded-lg text-xs text-zinc-500 border border-white/[0.08] hover:bg-white/[0.04] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveConversation}
              disabled={savingConv}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
              style={{ background: pillarColor }}
            >
              {savingConv ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="px-4 py-3 border-b flex items-center gap-3 group/header"
          style={{ borderColor: `${pillarColor}30` }}
        >
          {/* Back arrow removed: the conversation sidebar is now
              always visible at every viewport size, so there's no
              "single-panel mobile" mode to escape from. onBackToList
              is still passed in case a future caller wants to close
              the thread programmatically. */}

          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: `${pillarColor}18`, color: pillarColor }}
          >
            {conversation.is_group ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-white truncate">{convTitle}</p>
            {recipients && (
              <p className="text-xs text-zinc-500 truncate">
                with {recipients}
              </p>
            )}
          </div>
          {!canPost && (
            <span
              className="text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wide flex-shrink-0 bg-amber-500/15 text-amber-300 flex items-center gap-1"
              title="You are viewing as super admin; you are not a member of this conversation."
            >
              <Eye className="w-3 h-3" />
              Auditing
            </span>
          )}
          <span
            className="text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wide flex-shrink-0"
            style={{ background: `${pillarColor}18`, color: pillarColor }}
          >
            {pillarLabel}
          </span>
          {canEditConv && (
            <button
              onClick={() => setEditingConv(true)}
              className="opacity-0 group-hover/header:opacity-100 p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
              title="Rename group"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {isLoading && (
          <div className="text-center text-zinc-600 text-xs py-8">Loading messages...</div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-600 text-sm">No messages yet.</p>
            <p className="text-zinc-700 text-xs mt-1">Send the first message below.</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMe = msg.sender_id === currentUserId;
          const showDate = idx === 0 || !isSameDay(messages[idx - 1].created_at, msg.created_at);
          // Now that every message is left-aligned, show the sender name
          // above the first message in any streak — including the current
          // user's own messages. Otherwise it can be unclear who said what.
          const showSender = idx === 0 || messages[idx - 1].sender_id !== msg.sender_id || showDate;

          return (
            <div key={msg.id} id={`message-${msg.id}`}>
              {showDate && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 border-t border-white/[0.05]" />
                  <span className="text-[10px] text-zinc-600 font-medium px-2">
                    {formatDateDivider(msg.created_at)}
                  </span>
                  <div className="flex-1 border-t border-white/[0.05]" />
                </div>
              )}

              <div
                className="flex justify-start mb-1 group/msg"
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
              >
                <div className="max-w-[80%]">
                  {showSender && (
                    <p className="text-[10px] text-zinc-500 mb-1 ml-7">{msg.sender_name}</p>
                  )}

                  <div className="flex items-start gap-2">
                    {/* Important flag — visible to everyone, signals this message also fired email */}
                    {msg.is_important ? (
                      <span
                        className="shrink-0 mt-2 flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/15 text-amber-400"
                        title="Marked important — recipients were emailed"
                      >
                        <Flag className="w-2.5 h-2.5" />
                      </span>
                    ) : (
                      <span className="shrink-0 w-5" aria-hidden="true" />
                    )}

                    <div className="min-w-0 space-y-1.5">
                      {msg.content.trim() && (
                        <div
                          className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words"
                          style={
                            isMe
                              ? {
                                  background: pillarColor,
                                  color: "#ffffff",
                                  borderBottomLeftRadius: "4px",
                                }
                              : {
                                  background: `${pillarColor}12`,
                                  color: "#e4e4e7",
                                  borderBottomLeftRadius: "4px",
                                  borderLeft: `2px solid ${pillarColor}60`,
                                }
                          }
                        >
                          {linkify(msg.content).map((part, i) => (
                            <Fragment key={i}>{part}</Fragment>
                          ))}
                        </div>
                      )}

                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          {msg.attachments.map((att) => (
                            <MessageAttachmentView key={att.id} attachment={att} />
                          ))}
                        </div>
                      )}

                      <p className="text-[9px] text-zinc-700 ml-1">
                        {formatMessageTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`flex items-center ml-1 mt-2 transition-opacity ${hoveredMsgId === msg.id ? "opacity-100" : "opacity-0 group-hover/msg:opacity-100"}`}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.08] transition-colors outline-none">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-52 bg-neutral-900 border-white/[0.08] shadow-2xl">
                      <DropdownMenuItem
                        onSelect={() => onAddMessageToWorkbench(msg.id, msg.content)}
                        className="cursor-pointer text-emerald-400 focus:text-emerald-300 focus:bg-emerald-500/10"
                      >
                        <SignalIcon className="w-3.5 h-3.5 mr-2" />
                        Add to my Workbench
                      </DropdownMenuItem>
                      {!msg.is_important && (
                        <DropdownMenuItem
                          onSelect={() => handleFlagImportant(msg.id)}
                          className="cursor-pointer text-amber-400 focus:text-amber-300 focus:bg-amber-500/10"
                        >
                          <Flag className="w-3.5 h-3.5 mr-2" />
                          Flag as important
                        </DropdownMenuItem>
                      )}
                      {isSuperAdmin && (
                        <DropdownMenuItem
                          onSelect={() => handleDeleteMessage(msg.id)}
                          className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Delete message
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {canPost ? (
        <MessageInput
          conversationId={conversation.id}
          currentUserId={currentUserId}
          pillar={conversation.pillar}
          onSent={handleMessageSent}
        />
      ) : (
        <div className="px-4 py-3 border-t border-white/[0.06] bg-amber-500/[0.04] text-center">
          <p className="text-xs text-amber-300/80">
            You're viewing this conversation as super admin. You can't post here because you're not a member.
          </p>
        </div>
      )}
    </div>
  );
};

export default MessageThread;
