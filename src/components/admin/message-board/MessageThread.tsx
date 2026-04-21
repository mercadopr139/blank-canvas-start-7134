import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, User, MoreHorizontal, Trash2, Pencil, X } from "lucide-react";
import MessageInput from "./MessageInput";
import MessageTaskCard from "./MessageTaskCard";
import type { Conversation, ConversationTopic } from "@/pages/admin/AdminMessageBoard";
import { TOPIC_COLORS } from "@/pages/admin/AdminMessageBoard";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: "text" | "task" | "event";
  topic?: ConversationTopic;
  created_at: string;
  sender_name?: string;
  task_id?: string;
};

const TOPICS: ConversationTopic[] = ["General", "Operations", "Sales & Marketing", "Finance"];

/* ── Action menu — uses DropdownMenuItem (onSelect) so clicks fire before menu closes ── */
const MessageActionMenu = ({
  msgId,
  msgTopic,
  onChangeTopic,
  onDelete,
}: {
  msgId: string;
  msgTopic: ConversationTopic;
  onChangeTopic: (id: string, t: ConversationTopic) => void;
  onDelete: (id: string) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.08] transition-colors outline-none">
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      side="top"
      align="end"
      className="w-52 bg-neutral-900 border-white/[0.08] shadow-2xl"
    >
      <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider px-2 py-1.5">
        Change Pillar
      </p>
      {(["General", "Operations", "Sales & Marketing", "Finance"] as ConversationTopic[]).map((t) => {
        const color = TOPIC_COLORS[t];
        const active = msgTopic === t;
        return (
          <DropdownMenuItem
            key={t}
            onSelect={() => onChangeTopic(msgId, t)}
            className="cursor-pointer focus:bg-white/[0.06]"
            style={{ color: active ? color : "#71717a" }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0 mr-2"
              style={{ background: color }}
            />
            {t}
            {active && <span className="ml-auto text-[10px]">✓</span>}
          </DropdownMenuItem>
        );
      })}
      <DropdownMenuSeparator className="bg-white/[0.06]" />
      <DropdownMenuItem
        onSelect={() => onDelete(msgId)}
        className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-500/10"
      >
        <Trash2 className="w-3.5 h-3.5 mr-2" />
        Delete message
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

interface Props {
  conversation: Conversation;
  currentUserId: string;
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

const MessageThread = ({ conversation, currentUserId, onConversationUpdated }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [editingConv, setEditingConv] = useState(false);
  const [convName, setConvName] = useState(conversation.name || "");
  const [convTopic, setConvTopic] = useState<ConversationTopic>(conversation.topic || "General");
  const [savingConv, setSavingConv] = useState(false);

  const convLabel = conversation.is_group && conversation.name
    ? conversation.name
    : (conversation.member_names?.join(", ") || "Conversation");

  const convTopicColor = TOPIC_COLORS[convTopic] || TOPIC_COLORS.General;

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["mb-messages", conversation.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("mb_messages") as any)
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const senderIds = [...new Set((data || []).map((m: any) => m.sender_id))] as string[];
      const { data: profiles } = await (supabase.from("staff_profiles") as any)
        .select("user_id, full_name")
        .in("user_id", senderIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name; });

      return (data || []).map((m: any) => ({
        ...m,
        sender_name: nameMap[m.sender_id] || "Unknown",
        topic: (m.topic as ConversationTopic) || conversation.topic || "General",
      })) as Message[];
    },
    enabled: !!conversation.id,
  });

  useEffect(() => {
    if (!conversation.id || !currentUserId) return;
    (supabase.from("mb_conversation_members") as any)
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversation.id)
      .eq("user_id", currentUserId);
  }, [conversation.id, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sync local state when conversation prop changes
  useEffect(() => {
    setConvTopic(conversation.topic || "General");
    setConvName(conversation.name || "");
  }, [conversation.id, conversation.topic, conversation.name]);

  const handleMessageSent = () => {
    queryClient.invalidateQueries({ queryKey: ["mb-messages", conversation.id] });
    queryClient.invalidateQueries({ queryKey: ["mb-conversations"] });
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      const { error } = await (supabase.from("mb_messages") as any)
        .delete()
        .eq("id", msgId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["mb-messages", conversation.id] });
      queryClient.invalidateQueries({ queryKey: ["mb-conversations"] });
    } catch (err: any) {
      toast({ title: "Failed to delete message", description: err.message, variant: "destructive" });
    }
  };

  const handleChangeMessageTopic = async (msgId: string, newTopic: ConversationTopic) => {
    try {
      const { error } = await (supabase.from("mb_messages") as any)
        .update({ topic: newTopic })
        .eq("id", msgId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["mb-messages", conversation.id] });
    } catch (err: any) {
      toast({ title: "Failed to update message", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveConversation = async () => {
    setSavingConv(true);
    try {
      const { error } = await (supabase.from("mb_conversations") as any)
        .update({
          topic: convTopic,
          ...(conversation.is_group ? { name: convName.trim() || null } : {}),
        })
        .eq("id", conversation.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["mb-conversations"] });
      onConversationUpdated?.();
      setEditingConv(false);
      toast({ title: "Conversation updated" });
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
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
          style={{ borderColor: `${convTopicColor}30` }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Edit Conversation</span>
            <button onClick={() => setEditingConv(false)} className="text-zinc-600 hover:text-zinc-400 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Topic selector */}
          <div>
            <p className="text-[11px] text-zinc-500 mb-1.5">Pillar</p>
            <div className="flex gap-2 flex-wrap">
              {TOPICS.map((t) => {
                const color = TOPIC_COLORS[t];
                const active = convTopic === t;
                return (
                  <button
                    key={t}
                    onClick={() => setConvTopic(t)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                    style={{
                      background: active ? `${color}20` : "transparent",
                      borderColor: active ? color : "rgba(255,255,255,0.08)",
                      color: active ? color : "#71717a",
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group name (only for group convs) */}
          {conversation.is_group && (
            <div>
              <p className="text-[11px] text-zinc-500 mb-1.5">Group Name</p>
              <input
                value={convName}
                onChange={(e) => setConvName(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-white/20"
                placeholder="Group name..."
              />
            </div>
          )}

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
              style={{ background: convTopicColor }}
            >
              {savingConv ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="px-4 py-3 border-b flex items-center gap-3 group/header"
          style={{ borderColor: `${convTopicColor}30` }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: `${convTopicColor}18`, color: convTopicColor }}
          >
            {conversation.is_group ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-200">{convLabel}</p>
            {conversation.is_group && conversation.member_names && (
              <p className="text-xs text-zinc-600 truncate">{conversation.member_names.join(", ")}</p>
            )}
          </div>
          {conversation.topic && conversation.topic !== "General" && (
            <span
              className="text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wide flex-shrink-0"
              style={{ background: `${convTopicColor}18`, color: convTopicColor }}
            >
              {conversation.topic}
            </span>
          )}
          <button
            onClick={() => setEditingConv(true)}
            className="opacity-0 group-hover/header:opacity-100 p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
            title="Edit conversation"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Messages area */}
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
          const msgTopic = msg.topic || conversation.topic || "General";
          const msgColor = TOPIC_COLORS[msgTopic] || TOPIC_COLORS.General;
          const isGeneral = msgTopic === "General";
          const isTask = msg.message_type === "task";
          const taskId = (() => { try { return JSON.parse(msg.content)?.task_id || msg.task_id; } catch { return msg.task_id; } })();

          return (
            <div key={msg.id}>
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
                {/* Action button — left of bubble for my messages */}
                {isMe && (
                  <div className={`flex items-center mr-1 transition-opacity ${hoveredMsgId === msg.id ? "opacity-100" : "opacity-0"}`}>
                    <MessageActionMenu
                      msgId={msg.id}
                      msgTopic={msgTopic}
                      onChangeTopic={handleChangeMessageTopic}
                      onDelete={handleDeleteMessage}
                    />
                  </div>
                )}

                <div className={`${isTask ? "max-w-sm w-full" : "max-w-[70%]"}`}>
                  {showSender && (
                    <p className="text-[10px] text-zinc-500 mb-1 ml-1">{msg.sender_name}</p>
                  )}

                  {isTask && taskId ? (
                    <MessageTaskCard taskId={taskId} currentUserId={currentUserId} isMe={isMe} />
                  ) : (
                    <>
                      <div
                        className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                        style={
                          isMe
                            ? { background: msgColor, color: "white", borderBottomRightRadius: "4px" }
                            : {
                                background: isGeneral ? "rgba(255,255,255,0.06)" : `${msgColor}12`,
                                color: "#e4e4e7",
                                borderBottomLeftRadius: "4px",
                                borderLeft: isGeneral ? undefined : `2px solid ${msgColor}60`,
                              }
                        }
                      >
                        {msg.content}
                      </div>
                      <p className={`text-[9px] text-zinc-700 mt-0.5 ${isMe ? "text-right" : "text-left ml-1"}`}>
                        {formatMessageTime(msg.created_at)}
                        {!isGeneral && (
                          <span className="ml-1.5 font-medium" style={{ color: `${msgColor}80` }}>
                            · {msgTopic}
                          </span>
                        )}
                      </p>
                    </>
                  )}
                </div>

                {/* Action button — right of bubble for received messages */}
                {!isMe && (
                  <div className={`flex items-center ml-1 transition-opacity ${hoveredMsgId === msg.id ? "opacity-100" : "opacity-0"}`}>
                    <MessageActionMenu
                      msgId={msg.id}
                      msgTopic={msgTopic}
                      onChangeTopic={handleChangeMessageTopic}
                      onDelete={handleDeleteMessage}
                    />
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
        defaultTopic={convTopic}
        onSent={handleMessageSent}
      />
    </div>
  );
};

export default MessageThread;
