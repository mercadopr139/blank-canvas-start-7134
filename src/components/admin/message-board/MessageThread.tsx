import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, User } from "lucide-react";
import MessageInput from "./MessageInput";
import MessageTaskCard from "./MessageTaskCard";
import type { Conversation, ConversationTopic } from "@/pages/admin/AdminMessageBoard";
import { TOPIC_COLORS } from "@/pages/admin/AdminMessageBoard";

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

interface Props {
  conversation: Conversation;
  currentUserId: string;
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

const MessageThread = ({ conversation, currentUserId }: Props) => {
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const convLabel = conversation.is_group && conversation.name
    ? conversation.name
    : (conversation.member_names?.join(", ") || "Conversation");

  const convTopicColor = TOPIC_COLORS[conversation.topic] || TOPIC_COLORS.General;

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

  const handleMessageSent = () => {
    queryClient.invalidateQueries({ queryKey: ["mb-messages", conversation.id] });
    queryClient.invalidateQueries({ queryKey: ["mb-conversations"] });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Thread header — colored by conversation topic */}
      <div
        className="px-4 py-3 border-b flex items-center gap-3"
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
      </div>

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

              {msg.message_type === "task" && (() => { try { return JSON.parse(msg.content)?.task_id; } catch { return msg.task_id; } })() ? (
                <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-2`}>
                  <div className="max-w-sm w-full">
                    {showSender && (
                      <p className="text-[10px] text-zinc-500 mb-1 ml-1">{msg.sender_name}</p>
                    )}
                    <MessageTaskCard
                      taskId={(() => { try { return JSON.parse(msg.content)?.task_id || msg.task_id; } catch { return msg.task_id; } })()}
                      currentUserId={currentUserId}
                      isMe={isMe}
                    />
                  </div>
                </div>
              ) : (
                <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}>
                  <div className="max-w-[70%]">
                    {showSender && (
                      <p className="text-[10px] text-zinc-500 mb-1 ml-1">{msg.sender_name}</p>
                    )}
                    <div
                      className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed relative"
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
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        conversationId={conversation.id}
        currentUserId={currentUserId}
        defaultTopic={conversation.topic || "General"}
        onSent={handleMessageSent}
      />
    </div>
  );
};

export default MessageThread;
