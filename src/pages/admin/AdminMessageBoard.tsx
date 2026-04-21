import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Signal, Bell } from "lucide-react";
import ConversationList from "@/components/admin/message-board/ConversationList";
import MessageThread from "@/components/admin/message-board/MessageThread";
import NewConversationModal from "@/components/admin/message-board/NewConversationModal";
import MessageCalendarPanel from "@/components/admin/message-board/MessageCalendarPanel";

export type Conversation = {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  member_names?: string[];
};

export type StaffProfile = {
  id: string;
  user_id: string;
  full_name: string;
  role: string | null;
  task_manager_type: string | null;
};

const JOSH_EMAIL = "joshmercado@nolimitsboxingacademy.org";

const AdminMessageBoard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // Fetch current user's staff profile for task manager routing
  const { data: myProfile } = useQuery<StaffProfile | null>({
    queryKey: ["my-staff-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("staff_profiles") as any)
        .select("id, user_id, full_name, role, task_manager_type")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as StaffProfile | null;
    },
    enabled: !!user,
  });

  // Fetch conversations user belongs to
  const { data: conversations = [], isLoading: convsLoading } = useQuery<Conversation[]>({
    queryKey: ["mb-conversations", user?.id],
    queryFn: async () => {
      // Get conversation IDs this user is a member of
      const { data: memberships, error: memErr } = await (supabase.from("mb_conversation_members") as any)
        .select("conversation_id")
        .eq("user_id", user!.id);
      if (memErr) throw memErr;
      if (!memberships || memberships.length === 0) return [];

      const ids = memberships.map((m: any) => m.conversation_id);
      const { data: convs, error: convErr } = await (supabase.from("mb_conversations") as any)
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (convErr) throw convErr;

      // For each conversation, get member names
      const enriched = await Promise.all(
        (convs || []).map(async (c: any) => {
          const { data: members } = await (supabase.from("mb_conversation_members") as any)
            .select("user_id")
            .eq("conversation_id", c.id);
          const memberIds = (members || []).map((m: any) => m.user_id);
          const otherIds = memberIds.filter((id: string) => id !== user!.id);

          let member_names: string[] = [];
          if (otherIds.length > 0) {
            const { data: profiles } = await (supabase.from("staff_profiles") as any)
              .select("full_name, user_id")
              .in("user_id", otherIds);
            member_names = (profiles || []).map((p: any) => p.full_name);
          }

          // Get last message
          const { data: lastMsgs } = await (supabase.from("mb_messages") as any)
            .select("content, created_at")
            .eq("conversation_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1);
          const lastMsg = lastMsgs?.[0];

          return {
            ...c,
            member_names,
            last_message: lastMsg?.content,
            last_message_at: lastMsg?.created_at,
          } as Conversation;
        })
      );
      return enriched;
    },
    enabled: !!user,
  });

  // Unread count across all conversations
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  // Determine task manager route for "My Task Manager" button
  const taskManagerHref = (() => {
    if (!myProfile) return null;
    if (myProfile.task_manager_type === "PD") return "/admin/pd-task-manager";
    if (myProfile.task_manager_type === "PC") return "/admin/pc-task-manager";
    return null;
  })();

  // Real-time subscription for new messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("mb-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mb_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["mb-conversations", user.id] });
        if (activeConversationId) {
          queryClient.invalidateQueries({ queryKey: ["mb-messages", activeConversationId] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, activeConversationId, queryClient]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/dashboard")}
              className="text-zinc-400 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(191,15,62,0.15)", color: "#bf0f3e" }}
              >
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-white leading-none">Message Board</h1>
                <p className="text-[10px] text-zinc-500 mt-0.5">Team Communication</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {taskManagerHref && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(taskManagerHref)}
                className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5 hover:text-white text-xs h-8 gap-1.5"
              >
                <Signal className="w-3.5 h-3.5" />
                My Task Manager
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCalendar(!showCalendar)}
              className={`text-zinc-400 hover:text-white hover:bg-white/5 h-8 w-8 p-0 relative ${showCalendar ? "text-white bg-white/10" : ""}`}
            >
              <Bell className="w-4 h-4" />
              {totalUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#bf0f3e] text-[9px] font-bold flex items-center justify-center text-white">
                  {totalUnread > 9 ? "9+" : totalUnread}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-57px)]">
        {/* Left: Conversation list */}
        <div className="w-72 min-w-[260px] border-r border-white/[0.06] flex flex-col">
          <ConversationList
            conversations={conversations}
            loading={convsLoading}
            activeId={activeConversationId}
            currentUserId={user?.id || ""}
            onSelect={setActiveConversationId}
            onNew={() => setNewConvOpen(true)}
          />
        </div>

        {/* Center: Message thread */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeConversationId && activeConversation ? (
            <MessageThread
              conversation={activeConversation}
              currentUserId={user?.id || ""}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "rgba(191,15,62,0.1)", color: "#bf0f3e" }}
                >
                  <MessageSquare className="w-8 h-8" />
                </div>
                <p className="text-zinc-400 text-sm font-medium">Select a conversation</p>
                <p className="text-zinc-600 text-xs mt-1">or start a new one</p>
                <Button
                  size="sm"
                  className="mt-4 bg-[#bf0f3e] hover:bg-[#a00d34] text-white text-xs"
                  onClick={() => setNewConvOpen(true)}
                >
                  New Message
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Calendar panel (collapsible) */}
        {showCalendar && (
          <div className="w-80 min-w-[300px] border-l border-white/[0.06] flex flex-col">
            <MessageCalendarPanel currentUserId={user?.id || ""} />
          </div>
        )}
      </div>

      {/* New conversation modal */}
      <NewConversationModal
        open={newConvOpen}
        onClose={() => setNewConvOpen(false)}
        currentUserId={user?.id || ""}
        onCreated={(id) => {
          setNewConvOpen(false);
          queryClient.invalidateQueries({ queryKey: ["mb-conversations", user?.id] });
          setActiveConversationId(id);
        }}
      />
    </div>
  );
};

export default AdminMessageBoard;
