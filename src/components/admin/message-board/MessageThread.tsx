import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, User, MoreHorizontal, Trash2, Pencil, X } from "lucide-react";
import MessageInput from "./MessageInput";
import type { Conversation } from "@/pages/admin/AdminMessageBoard";
import { PILLAR_COLOR, PILLAR_LABEL } from "@/pages/admin/AdminMessageBoard";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_important: boolean;
  created_at: string;
  sender_name?: string;
};

interface Props {
  conversation: Conversation;
  currentUserId: string;
  isSuperAdmin: boolean;
  onConversationUpdated?: () => void;
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

const MessageThread = ({ conversation, currentUserId, isSuperAdmin, onConversationUpdated }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [editingConv, setEditingConv] = useState(false);
  const [convName, setConvName] = useState(conversation.name || "");
  const [savingConv, setSavingConv] = useState(false);

  const convLabel = conversation.is_group && conversation.name
    ? conversation.name
    : (conversation.member_names?.join(", ") || "Conversation");

  const pillarColor = PILLAR_COLOR[conversation.pillar];
  const pillarLabel = PILLAR_LABEL[conversation.pillar];

  // Only the conversation creator or super admin can edit the group name.
  // DMs never show the edit affordance — there's nothing to rename.
  const canEditConv = conversation.is_group && (conversation.created_by === currentUserId || isSuperAdmin);

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["mb-messages", conversation.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mb_messages")
        .select("id, conversation_id, sender_id, content, is_important, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const senderIds = [...new Set((data || []).map((m) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("staff_profiles")
        .select("user_id, full_name")
        .in("user_id", senderIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p) => { nameMap[p.user_id] = p.full_name; });

      return (data || []).map((m) => ({
        ...m,
        sender_name: nameMap[m.sender_id] || "Unknown",
      })) as Message[];
    },
    enabled: !!conversation.id,
  });

  // Mark this conversation as read for the current user whenever they
  // switch to it. (Unread count surfacing comes in a later phase; the
  // last_read_at column already exists and gets updated here.)
  useEffect(() => {
    if (!conversation.id || !currentUserId) return;
    supabase
      .from("mb_conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversation.id)
      .eq("user_id", currentUserId);
  }, [conversation.id, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
            <p className="text-[11px] text-zinc-500 mb-1.5">Group Name</p>
            <input
              value={convName}
              onChange={(e) => setConvName(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/20"
              placeholder="Group name..."
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
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: `${pillarColor}18`, color: pillarColor }}
          >
            {conversation.is_group ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-200">{convLabel}</p>
            {conversation.is_group && conversation.member_names && (
              <p className="text-xs text-zinc-600 truncate">{conversation.member_names.join(", ")}</p>
            )}
          </div>
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
          const showSender = !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id || showDate);

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
                className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1 group/msg`}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
              >
                {isMe && isSuperAdmin && (
                  <div className={`flex items-center mr-1 transition-opacity ${hoveredMsgId === msg.id ? "opacity-100" : "opacity-0"}`}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.08] transition-colors outline-none">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="top" align="end" className="w-48 bg-neutral-900 border-white/[0.08] shadow-2xl">
                        <DropdownMenuItem
                          onSelect={() => handleDeleteMessage(msg.id)}
                          className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Delete message
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                <div className="max-w-[70%]">
                  {showSender && (
                    <p className="text-[10px] text-zinc-500 mb-1 ml-1">{msg.sender_name}</p>
                  )}

                  <div
                    className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                    style={
                      isMe
                        ? { background: pillarColor, color: "white", borderBottomRightRadius: "4px" }
                        : {
                            background: `${pillarColor}12`,
                            color: "#e4e4e7",
                            borderBottomLeftRadius: "4px",
                            borderLeft: `2px solid ${pillarColor}60`,
                          }
                    }
                  >
                    {msg.content}
                  </div>
                  <p className={`text-[9px] text-zinc-700 mt-0.5 ${isMe ? "text-right" : "text-left ml-1"}`}>
                    {formatMessageTime(msg.created_at)}
                  </p>
                </div>

                {!isMe && isSuperAdmin && (
                  <div className={`flex items-center ml-1 transition-opacity ${hoveredMsgId === msg.id ? "opacity-100" : "opacity-0"}`}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.08] transition-colors outline-none">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="top" align="end" className="w-48 bg-neutral-900 border-white/[0.08] shadow-2xl">
                        <DropdownMenuItem
                          onSelect={() => handleDeleteMessage(msg.id)}
                          className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          Delete message
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        conversationId={conversation.id}
        currentUserId={currentUserId}
        pillar={conversation.pillar}
        onSent={handleMessageSent}
      />
    </div>
  );
};

export default MessageThread;
