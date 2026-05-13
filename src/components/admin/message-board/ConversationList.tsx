import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users, User, MessageSquare } from "lucide-react";
import type { Conversation } from "@/pages/admin/AdminMessageBoard";
import { PILLAR_COLOR, PILLAR_LABEL } from "@/pages/admin/AdminMessageBoard";

interface Props {
  conversations: Conversation[];
  loading: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

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

const ConversationList = ({ conversations, loading, activeId, onSelect, onNew }: Props) => {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) => {
    const haystack = `${getConvTitle(c)} ${getConvRecipients(c)}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Messages</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={onNew}
            className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-white/10"
            title="New conversation"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
          <Input
            placeholder="Search..."
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

        {!loading && filtered.length === 0 && (
          <div className="p-4 text-center">
            <MessageSquare className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-600 text-xs">No conversations yet</p>
            <button onClick={onNew} className="text-[#bf0f3e] text-xs mt-1 hover:underline">
              Start one
            </button>
          </div>
        )}

        {filtered.map((conv) => {
          const title = getConvTitle(conv);
          const recipients = getConvRecipients(conv);
          const isActive = conv.id === activeId;
          const pillarColor = PILLAR_COLOR[conv.pillar];

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left px-3 py-3 flex items-start gap-3 border-b border-white/[0.03] transition-colors relative ${
                isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"
              }`}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full transition-all"
                style={{ background: isActive ? pillarColor : `${pillarColor}60` }}
              />

              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `${pillarColor}18`, color: pillarColor }}
              >
                {conv.is_group ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-semibold text-white truncate">
                    {title}
                  </span>
                  {conv.last_message_at && (
                    <span className="text-[10px] text-zinc-600 ml-1 flex-shrink-0">
                      {formatTime(conv.last_message_at)}
                    </span>
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

                <span
                  className="inline-block mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                  style={{ background: `${pillarColor}18`, color: pillarColor }}
                >
                  {PILLAR_LABEL[conv.pillar]}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationList;
