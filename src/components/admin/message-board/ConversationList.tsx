import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Users, User, MessageSquare, Pencil, Archive, Trash2, ArchiveRestore, Check, X, Signal as SignalIcon } from "lucide-react";
import type { Conversation, Pillar } from "@/pages/admin/AdminMessageBoard";
import { PILLARS, PILLAR_COLOR, PILLAR_LABEL } from "@/pages/admin/AdminMessageBoard";

interface Props {
  conversations: Conversation[];
  loading: boolean;
  activeId: string | null;
  currentUserId: string;
  isSuperAdmin: boolean;
  viewAll: boolean;
  listView: "active" | "archived";
  onListViewChange: (v: "active" | "archived") => void;
  onSelect: (id: string) => void;
  onMessageSelect: (conversationId: string, messageId: string) => void;
  onNew: () => void;
  onOpenWorkbench: () => void;
  onConversationsChanged: () => void;
  onConversationDeleted: (id: string) => void;
}

type SearchMessageHit = {
  message_id: string;
  conversation_id: string;
  conversation_name: string | null;
  content: string;
  sender_name: string | null;
  created_at: string;
};

const formatTime = (iso: string | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const getConvTitle = (conv: Conversation) => conv.name?.trim() || "Untitled conversation";
const getConvRecipients = (conv: Conversation) =>
  conv.member_names && conv.member_names.length > 0 ? conv.member_names.join(", ") : "";

const ConversationList = ({
  conversations,
  loading,
  activeId,
  currentUserId,
  isSuperAdmin,
  viewAll,
  listView,
  onListViewChange,
  onSelect,
  onMessageSelect,
  onNew,
  onOpenWorkbench,
  onConversationsChanged,
  onConversationDeleted,
}: Props) => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [editingPillar, setEditingPillar] = useState<Pillar | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  // Local title/recipient filter (cheap, in-memory).
  const filteredConversations = conversations.filter((c) => {
    const haystack = `${getConvTitle(c)} ${getConvRecipients(c)}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  // Sort: unread first (most recent unread at top), then by last_message_at desc.
  // The spec calls this out explicitly. Skipped entirely in view-all (super
  // admin auditing) since unread isn't meaningful there.
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (!viewAll) {
      const aUnread = (a.unread_count ?? 0) > 0 ? 1 : 0;
      const bUnread = (b.unread_count ?? 0) > 0 ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
    }
    const aTs = a.last_message_at ?? a.created_at;
    const bTs = b.last_message_at ?? b.created_at;
    return new Date(bTs).getTime() - new Date(aTs).getTime();
  });

  // Full-text message search: hits live in a separate section below the
  // conversation list whenever the user has typed something. Empty when
  // viewAll is on (the RPC is membership-scoped and that's the right
  // boundary even for super admin — they can browse all convs from the
  // list section directly).
  const trimmedSearch = search.trim();
  const { data: messageHits = [] } = useQuery<SearchMessageHit[]>({
    queryKey: ["mb-search", currentUserId, trimmedSearch],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mb_search_messages", {
        uid: currentUserId,
        q: trimmedSearch,
      });
      if (error) throw error;
      return (data as SearchMessageHit[]) || [];
    },
    enabled: trimmedSearch.length >= 2 && !viewAll,
  });

  const startEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditingDraft(conv.name?.trim() || "");
    setEditingPillar(conv.pillar);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingDraft("");
    setEditingPillar(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editingPillar) return;
    const next = editingDraft.trim();
    if (!next) {
      toast({ title: "Title cannot be empty", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from("mb_conversations")
        .update({ name: next, pillar: editingPillar })
        .eq("id", editingId);
      if (error) throw error;
      onConversationsChanged();
      cancelEdit();
    } catch (err) {
      toast({
        title: "Failed to save changes",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const setArchived = async (conv: Conversation, archived: boolean) => {
    try {
      const { error } = await supabase
        .from("mb_conversation_members")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("conversation_id", conv.id)
        .eq("user_id", currentUserId);
      if (error) throw error;
      onConversationsChanged();
      toast({ title: archived ? "Archived" : "Restored" });
    } catch (err) {
      toast({
        title: archived ? "Failed to archive" : "Failed to restore",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    try {
      const { error } = await supabase
        .from("mb_conversations")
        .delete()
        .eq("id", id);
      if (error) throw error;
      onConversationDeleted(id);
      toast({ title: "Conversation deleted" });
      setPendingDelete(null);
    } catch (err) {
      toast({
        title: "Failed to delete",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const showSearchMessages = !viewAll && trimmedSearch.length >= 2 && messageHits.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Messages</span>
          {!viewAll && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onNew}
              className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-white/10"
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>

        {!viewAll && (
          <div className="flex gap-1 mb-3 bg-white/[0.04] rounded-md p-0.5">
            {(["active", "archived"] as const).map((v) => (
              <button
                key={v}
                onClick={() => onListViewChange(v)}
                className={`flex-1 text-[11px] font-medium py-1 rounded transition-colors capitalize ${
                  listView === v
                    ? "bg-white/[0.08] text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
          <Input
            placeholder={viewAll ? "Search all conversations..." : "Search title or messages..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-white/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 text-center text-zinc-600 text-xs">Loading...</div>
        )}

        {!loading && sortedConversations.length === 0 && !showSearchMessages && (
          <div className="p-4 text-center">
            <MessageSquare className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-600 text-xs">
              {listView === "archived" && !viewAll ? "No archived conversations" : "No conversations yet"}
            </p>
            {listView === "active" && !viewAll && (
              <button onClick={onNew} className="text-[#bf0f3e] text-xs mt-1 hover:underline">
                Start one
              </button>
            )}
          </div>
        )}

        {sortedConversations.map((conv) => {
          const title = getConvTitle(conv);
          const recipients = getConvRecipients(conv);
          const isActive = conv.id === activeId;
          const isEditing = editingId === conv.id;
          const pillarColor = PILLAR_COLOR[conv.pillar];
          const isMember = conv.is_member ?? true;
          const canEdit = (conv.created_by === currentUserId || isSuperAdmin) && isMember;
          const canDelete = isSuperAdmin;
          const canArchive = isMember && !viewAll;
          const unread = conv.unread_count ?? 0;

          return (
            <div
              key={conv.id}
              className={`w-full text-left px-3 py-3 flex items-start gap-3 border-b border-white/[0.03] transition-colors relative group/row ${
                isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"
              }`}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full transition-all"
                style={{ background: isActive ? pillarColor : `${pillarColor}60` }}
              />

              <button
                onClick={() => !isEditing && onSelect(conv.id)}
                className="absolute inset-0 w-full h-full"
                aria-label={`Open ${title}`}
                tabIndex={isEditing ? -1 : 0}
                disabled={isEditing}
              />

              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 relative z-10 pointer-events-none"
                style={{ background: `${pillarColor}18`, color: pillarColor }}
              >
                {conv.is_group ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div className="flex-1 min-w-0 relative z-10 pointer-events-none">
                <div className="flex items-center justify-between mb-0.5 gap-1">
                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-1 pointer-events-auto">
                      <Input
                        ref={editInputRef}
                        value={editingDraft}
                        onChange={(e) => setEditingDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveEdit(); }
                          if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                        }}
                        className="h-6 text-sm bg-white/[0.06] border-white/[0.12] text-white px-1.5"
                      />
                      <button onClick={saveEdit} className="p-1 rounded text-green-400 hover:bg-green-500/10" title="Save">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={cancelEdit} className="p-1 rounded text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300" title="Cancel">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className={`text-sm truncate ${unread > 0 ? "font-bold text-white" : "font-semibold text-white"}`}>
                        {title}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {unread > 0 && (
                          <span
                            className="text-[9px] font-bold text-white rounded-full px-1.5 py-0.5 min-w-[16px] text-center leading-none"
                            style={{ background: pillarColor }}
                          >
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                        {conv.last_message_at && (
                          <span className="text-[10px] text-zinc-600">
                            {formatTime(conv.last_message_at)}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {recipients && (
                  <p className="text-[11px] text-zinc-500 truncate">
                    with {recipients}
                  </p>
                )}

                <p className="text-xs text-zinc-600 truncate mt-0.5">
                  {conv.last_message || "No messages yet"}
                </p>

                <div className="flex items-center justify-between mt-1 gap-1">
                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-wrap pointer-events-auto">
                      {PILLARS.map((p) => {
                        const c = PILLAR_COLOR[p];
                        const active = editingPillar === p;
                        return (
                          <button
                            key={p}
                            onClick={(e) => { e.stopPropagation(); setEditingPillar(p); }}
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide border transition-colors"
                            style={{
                              background: active ? `${c}28` : "transparent",
                              color: active ? c : "#a1a1aa",
                              borderColor: active ? c : "rgba(255,255,255,0.08)",
                            }}
                            title={`Set pillar to ${PILLAR_LABEL[p]}`}
                          >
                            {PILLAR_LABEL[p]}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <span
                      className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                      style={{ background: `${pillarColor}18`, color: pillarColor }}
                    >
                      {PILLAR_LABEL[conv.pillar]}
                    </span>
                  )}

                  {!isEditing && (
                    <div className="opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center gap-0.5 pointer-events-auto">
                      {canEdit && (
                        <button
                          onClick={(e) => { e.stopPropagation(); startEdit(conv); }}
                          className="p-1 rounded text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-200"
                          title="Edit title & pillar"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      {canArchive && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setArchived(conv, listView === "active"); }}
                          className="p-1 rounded text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-200"
                          title={listView === "active" ? "Archive" : "Restore"}
                        >
                          {listView === "active" ? <Archive className="w-3 h-3" /> : <ArchiveRestore className="w-3 h-3" />}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPendingDelete(conv); }}
                          className="p-1 rounded text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                          title="Delete permanently"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Full-text message search results */}
        {showSearchMessages && (
          <div>
            <div className="px-3 pt-3 pb-1.5">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Messages matching "{trimmedSearch}"
              </span>
            </div>
            {messageHits.map((hit) => (
              <button
                key={hit.message_id}
                onClick={() => onMessageSelect(hit.conversation_id, hit.message_id)}
                className="w-full text-left px-3 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center justify-between mb-0.5 gap-2">
                  <span className="text-xs font-medium text-zinc-300 truncate">
                    {hit.conversation_name?.trim() || "Untitled conversation"}
                  </span>
                  <span className="text-[10px] text-zinc-600 flex-shrink-0">
                    {formatTime(hit.created_at)}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 line-clamp-2">
                  <span className="text-zinc-400">{hit.sender_name || "Unknown"}:</span>{" "}
                  {hit.content}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Workbench shortcut anchored at the bottom of the conversation
          list panel. Replaces the old floating bottom-right button so
          it stops covering the send button in the message composer. */}
      <div className="border-t border-white/[0.06] p-2 shrink-0">
        <button
          onClick={onOpenWorkbench}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold transition-colors shadow-sm shadow-emerald-500/20"
          title="Open my Workbench"
        >
          <SignalIcon className="w-4 h-4" />
          My Workbench
        </button>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent className="bg-neutral-900 border-white/[0.08] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Delete this conversation?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              <strong className="text-white">{pendingDelete && getConvTitle(pendingDelete)}</strong> — permanently removes it for every member, including all messages and attachments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ConversationList;
