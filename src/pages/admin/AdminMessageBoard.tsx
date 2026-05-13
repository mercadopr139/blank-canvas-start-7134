import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Signal, Globe } from "lucide-react";
import ConversationList from "@/components/admin/message-board/ConversationList";
import MessageThread from "@/components/admin/message-board/MessageThread";
import NewConversationModal from "@/components/admin/message-board/NewConversationModal";

// Three pillars — no General. Pillar is required at conversation creation
// and is set once for the lifetime of the conversation.
export type Pillar = "operations" | "sales_marketing" | "finance";

export const PILLARS: Pillar[] = ["operations", "sales_marketing", "finance"];

export const PILLAR_LABEL: Record<Pillar, string> = {
  operations: "Operations",
  sales_marketing: "Sales & Marketing",
  finance: "Finance",
};

export const PILLAR_COLOR: Record<Pillar, string> = {
  operations: "#bf0f3e",
  sales_marketing: "#22c55e",
  finance: "#38bdf8",
};

export type Conversation = {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
  pillar: Pillar;
  last_message?: string;
  last_message_at?: string;
  member_names?: string[];
  unread_count?: number;
  is_member?: boolean;
};

export type StaffProfile = {
  id: string;
  user_id: string;
  full_name: string;
  job_title: string | null;
  task_manager_type: string | null;
};

const AdminMessageBoard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useStaffPermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [listView, setListView] = useState<"active" | "archived">("active");
  const [viewAll, setViewAll] = useState(false);

  // Deep-link from an "important message" email: ?conv=<id> auto-opens
  // that conversation on landing. Strip the param after consumption so a
  // back/forward navigation doesn't keep re-opening it.
  useEffect(() => {
    const convParam = searchParams.get("conv");
    if (convParam) {
      setActiveConversationId(convParam);
      const next = new URLSearchParams(searchParams);
      next.delete("conv");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: myProfile } = useQuery<StaffProfile | null>({
    queryKey: ["my-staff-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("id, user_id, full_name, job_title, task_manager_type")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) return null;
      return (data as StaffProfile | null) ?? null;
    },
    enabled: !!user,
  });

  // Per-user unread counts: single RPC roundtrip returns one row per
  // conversation the user is a member of (unread = messages newer than
  // last_read_at and not sent by themselves).
  const { data: unreadMap = new Map<string, number>() } = useQuery<Map<string, number>>({
    queryKey: ["mb-unread", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mb_unread_counts", { uid: user!.id });
      if (error) throw error;
      const map = new Map<string, number>();
      ((data as { conversation_id: string; unread_count: number }[]) || []).forEach((r) =>
        map.set(r.conversation_id, Number(r.unread_count)),
      );
      return map;
    },
    enabled: !!user,
  });

  // Conversations. Two flavors:
  //   - normal user / super admin not in view-all: filter to memberships
  //     and the chosen active/archived tab
  //   - super admin in view-all: fetch every conversation (the RLS
  //     policy allows it; this bypasses the membership filter so the
  //     super admin can audit anything)
  const { data: conversations = [], isLoading: convsLoading } = useQuery<Conversation[]>({
    queryKey: ["mb-conversations", user?.id, listView, viewAll],
    queryFn: async () => {
      if (viewAll && isSuperAdmin) {
        const { data: convs, error: convErr } = await supabase
          .from("mb_conversations")
          .select("id, name, is_group, created_by, created_at, pillar")
          .order("created_at", { ascending: false });
        if (convErr) throw convErr;

        return Promise.all(
          (convs || []).map(async (c) => {
            const { data: members } = await supabase
              .from("mb_conversation_members")
              .select("user_id")
              .eq("conversation_id", c.id);
            const memberIds = (members || []).map((m) => m.user_id);
            const isMember = memberIds.includes(user!.id);

            let member_names: string[] = [];
            if (memberIds.length > 0) {
              const { data: profiles } = await supabase
                .from("staff_profiles")
                .select("full_name, user_id")
                .in("user_id", memberIds);
              member_names = (profiles || []).map((p) => p.full_name);
            }

            const { data: lastMsgs } = await supabase
              .from("mb_messages")
              .select("content, created_at, mb_attachments(filename, mime_type)")
              .eq("conversation_id", c.id)
              .order("created_at", { ascending: false })
              .limit(1);
            const lastMsg = lastMsgs?.[0];
            const lastAttachments = ((lastMsg as { mb_attachments?: { filename: string; mime_type: string }[] } | undefined)?.mb_attachments) || [];
            const lastMessagePreview = lastMsg?.content?.trim()
              ? lastMsg.content
              : lastAttachments.length > 0
                ? `📎 ${lastAttachments[0].mime_type.startsWith("image/") ? "Image" : lastAttachments[0].filename}${lastAttachments.length > 1 ? ` +${lastAttachments.length - 1}` : ""}`
                : undefined;

            return {
              ...c,
              pillar: c.pillar as Pillar,
              member_names,
              last_message: lastMessagePreview,
              last_message_at: lastMsg?.created_at,
              unread_count: 0,
              is_member: isMember,
            } as Conversation;
          }),
        );
      }

      let memQuery = supabase
        .from("mb_conversation_members")
        .select("conversation_id")
        .eq("user_id", user!.id);
      memQuery = listView === "archived"
        ? memQuery.not("archived_at", "is", null)
        : memQuery.is("archived_at", null);
      const { data: memberships, error: memErr } = await memQuery;
      if (memErr) throw memErr;
      if (!memberships || memberships.length === 0) return [];

      const ids = memberships.map((m) => m.conversation_id);
      const { data: convs, error: convErr } = await supabase
        .from("mb_conversations")
        .select("id, name, is_group, created_by, created_at, pillar")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (convErr) throw convErr;

      return Promise.all(
        (convs || []).map(async (c) => {
          const { data: members } = await supabase
            .from("mb_conversation_members")
            .select("user_id")
            .eq("conversation_id", c.id);
          const memberIds = (members || []).map((m) => m.user_id);
          const otherIds = memberIds.filter((id) => id !== user!.id);

          let member_names: string[] = [];
          if (otherIds.length > 0) {
            const { data: profiles } = await supabase
              .from("staff_profiles")
              .select("full_name, user_id")
              .in("user_id", otherIds);
            member_names = (profiles || []).map((p) => p.full_name);
          }

          const { data: lastMsgs } = await supabase
            .from("mb_messages")
            .select("content, created_at")
            .eq("conversation_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1);
          const lastMsg = lastMsgs?.[0];

          return {
            ...c,
            pillar: c.pillar as Pillar,
            member_names,
            last_message: lastMsg?.content,
            last_message_at: lastMsg?.created_at,
            unread_count: unreadMap.get(c.id) ?? 0,
            is_member: true,
          } as Conversation;
        }),
      );
    },
    enabled: !!user,
  });

  // Realtime: any message insert refreshes the list (last-message + unread)
  // and the active thread if it's the one that got a new message.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("mb-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mb_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["mb-conversations", user.id] });
        queryClient.invalidateQueries({ queryKey: ["mb-unread", user.id] });
        if (activeConversationId) {
          queryClient.invalidateQueries({ queryKey: ["mb-messages", activeConversationId] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, activeConversationId, queryClient]);

  const taskManagerHref = (() => {
    if (!myProfile) return null;
    if (myProfile.task_manager_type === "PD") return "/admin/pd-task-manager";
    if (myProfile.task_manager_type === "PC") return "/admin/pc-task-manager";
    return null;
  })();

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;
  const totalUnread = Array.from(unreadMap.values()).reduce((s, n) => s + n, 0);

  // Open a conversation, optionally scrolling to a specific message
  // (used by full-text search to jump-to-result).
  const openConversation = (conversationId: string, messageId?: string) => {
    setActiveConversationId(conversationId);
    setScrollToMessageId(messageId ?? null);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col overflow-x-hidden">
      <header className="border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* On mobile, the back arrow inside the thread handles list return;
                this header back arrow always returns to admin dashboard. */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/dashboard")}
              className="text-zinc-400 hover:text-white hover:bg-white/5 flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(191,15,62,0.15)", color: "#bf0f3e" }}
              >
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold tracking-tight text-white leading-none flex items-center gap-2">
                  Message Board
                  {totalUnread > 0 && !viewAll && (
                    <span className="bg-[#bf0f3e] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                  )}
                </h1>
                <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                  {viewAll ? "Viewing all conversations (super admin)" : "Team Communication"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isSuperAdmin && (
              <Button
                size="sm"
                variant={viewAll ? "default" : "outline"}
                onClick={() => setViewAll(!viewAll)}
                className={
                  viewAll
                    ? "bg-amber-500 hover:bg-amber-400 text-black text-xs h-8 gap-1.5 border-0"
                    : "border-white/10 text-zinc-300 bg-transparent hover:bg-white/5 hover:text-white text-xs h-8 gap-1.5"
                }
                title={viewAll ? "Return to your own conversations" : "View every conversation in the system"}
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{viewAll ? "View All ON" : "View All"}</span>
              </Button>
            )}
            {taskManagerHref && !viewAll && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(taskManagerHref)}
                className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5 hover:text-white text-xs h-8 gap-1.5"
              >
                <Signal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">My Workbench</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Responsive two-panel:
            - lg+: both panels visible side by side
            - <lg: single panel — list when no active conv, thread when one selected */}
      <div className="flex overflow-hidden flex-1" style={{ height: "calc(100vh - 57px)" }}>
        <div
          className={`${
            activeConversationId ? "hidden lg:flex" : "flex"
          } w-full lg:w-72 lg:min-w-[260px] border-r border-white/[0.06] flex-col`}
        >
          <ConversationList
            conversations={conversations}
            loading={convsLoading}
            activeId={activeConversationId}
            currentUserId={user?.id || ""}
            isSuperAdmin={isSuperAdmin}
            viewAll={viewAll}
            listView={listView}
            onListViewChange={setListView}
            onSelect={(id) => openConversation(id)}
            onMessageSelect={(convId, msgId) => openConversation(convId, msgId)}
            onNew={() => setNewConvOpen(true)}
            onConversationsChanged={() => {
              queryClient.invalidateQueries({ queryKey: ["mb-conversations", user?.id] });
              queryClient.invalidateQueries({ queryKey: ["mb-unread", user?.id] });
            }}
            onConversationDeleted={(id) => {
              if (activeConversationId === id) setActiveConversationId(null);
              queryClient.invalidateQueries({ queryKey: ["mb-conversations", user?.id] });
              queryClient.invalidateQueries({ queryKey: ["mb-unread", user?.id] });
            }}
          />
        </div>

        <div
          className={`${
            activeConversationId ? "flex" : "hidden lg:flex"
          } flex-1 flex-col min-w-0`}
        >
          {activeConversationId && activeConversation ? (
            <MessageThread
              conversation={activeConversation}
              currentUserId={user?.id || ""}
              isSuperAdmin={isSuperAdmin}
              canPost={activeConversation.is_member ?? true}
              scrollToMessageId={scrollToMessageId}
              onBackToList={() => setActiveConversationId(null)}
              onConversationUpdated={() => queryClient.invalidateQueries({ queryKey: ["mb-conversations", user?.id] })}
              onMessageRead={() => queryClient.invalidateQueries({ queryKey: ["mb-unread", user?.id] })}
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
      </div>

      <NewConversationModal
        open={newConvOpen}
        onClose={() => setNewConvOpen(false)}
        currentUserId={user?.id || ""}
        onCreated={(id) => {
          setNewConvOpen(false);
          queryClient.invalidateQueries({ queryKey: ["mb-conversations", user?.id] });
          openConversation(id);
        }}
      />
    </div>
  );
};

export default AdminMessageBoard;
