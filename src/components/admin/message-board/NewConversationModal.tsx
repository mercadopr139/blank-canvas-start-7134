import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Users, User } from "lucide-react";
import type { StaffProfile, ConversationTopic } from "@/pages/admin/AdminMessageBoard";
import { TOPIC_COLORS } from "@/pages/admin/AdminMessageBoard";

const TOPICS: ConversationTopic[] = ["General", "Operations", "Sales & Marketing", "Finance"];

interface Props {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  onCreated: (conversationId: string) => void;
}

const NewConversationModal = ({ open, onClose, currentUserId, onCreated }: Props) => {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [topic, setTopic] = useState<ConversationTopic>("General");
  const [saving, setSaving] = useState(false);

  const { data: staffList = [] } = useQuery<StaffProfile[]>({
    queryKey: ["staff-profiles-for-mb"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("staff_profiles") as any)
        .select("id, user_id, full_name, job_title, task_manager_type")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data || [])
        .filter((s: any) => s.user_id !== currentUserId) as StaffProfile[];
    },
    enabled: open,
  });

  const toggle = (userId: string | null) => {
    if (!userId) return;
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const isGroup = selectedIds.length > 1;
  const topicColor = TOPIC_COLORS[topic];

  const handleCreate = async () => {
    if (selectedIds.length === 0) {
      toast({ title: "Select at least one person", variant: "destructive" });
      return;
    }
    if (isGroup && !groupName.trim()) {
      toast({ title: "Give your group a name", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // For DMs, check if one already exists between these two
      if (!isGroup) {
        const otherId = selectedIds[0];
        const { data: existing } = await (supabase.from("mb_conversations") as any)
          .select("id, mb_conversation_members(user_id)")
          .eq("is_group", false);

        if (existing) {
          for (const conv of existing as any[]) {
            const members = (conv.mb_conversation_members || []).map((m: any) => m.user_id);
            if (members.includes(currentUserId) && members.includes(otherId) && members.length === 2) {
              onCreated(conv.id);
              setSaving(false);
              handleClose();
              return;
            }
          }
        }
      }

      // Create conversation with topic
      const { data: newConv, error: convErr } = await (supabase.from("mb_conversations") as any)
        .insert({
          name: isGroup ? groupName.trim() : null,
          is_group: isGroup,
          created_by: currentUserId,
          topic,
        })
        .select()
        .single();

      if (convErr) throw convErr;

      const allMembers = [currentUserId, ...selectedIds];
      const memberRows = allMembers.map((uid) => ({
        conversation_id: newConv.id,
        user_id: uid,
      }));
      const { error: memErr } = await (supabase.from("mb_conversation_members") as any)
        .insert(memberRows);
      if (memErr) throw memErr;

      onCreated(newConv.id);
      handleClose();
    } catch (err: any) {
      toast({ title: "Failed to create conversation", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedIds([]);
    setGroupName("");
    setTopic("General");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-neutral-900 border-white/[0.08] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: topicColor }} />
            New Message
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Pillar / Topic selector */}
          <div>
            <Label className="text-xs text-zinc-400 mb-2 block">Pillar</Label>
            <div className="flex gap-2 flex-wrap">
              {TOPICS.map((t) => {
                const color = TOPIC_COLORS[t];
                const active = topic === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
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

          {/* Staff selector */}
          <div>
            <Label className="text-xs text-zinc-400 mb-2 block">To</Label>
            <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
              {staffList.length === 0 && (
                <p className="text-xs text-zinc-600 py-2">No staff members found</p>
              )}
              {staffList.map((staff) => {
                const hasAccount = !!staff.user_id;
                const checked = hasAccount && selectedIds.includes(staff.user_id);
                return (
                  <label
                    key={staff.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      !hasAccount
                        ? "opacity-40 cursor-not-allowed"
                        : checked
                        ? "cursor-pointer"
                        : "hover:bg-white/[0.04] cursor-pointer"
                    }`}
                    style={checked ? { background: `${topicColor}15` } : undefined}
                    title={!hasAccount ? "This staff member hasn't logged in yet" : undefined}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!hasAccount}
                      onCheckedChange={() => hasAccount && toggle(staff.user_id)}
                      className="border-white/20"
                      style={checked ? { background: topicColor, borderColor: topicColor } : undefined}
                    />
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `${topicColor}18`, color: topicColor }}
                    >
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{staff.full_name}</p>
                      <p className="text-xs text-zinc-500">
                        {staff.job_title || ""}
                        {!hasAccount && <span className="ml-1 text-zinc-600">· hasn't logged in yet</span>}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Group name */}
          {isGroup && (
            <div>
              <Label className="text-xs text-zinc-400 mb-1.5 block">Group Name</Label>
              <Input
                placeholder="e.g. All Staff, Coaching Team..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 text-sm"
                style={{ focusRingColor: topicColor }}
              />
            </div>
          )}

          {selectedIds.length > 0 && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: topicColor }}>
              {isGroup ? <Users className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              {isGroup ? `Group · ${topic}` : `Direct message · ${topic}`}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="flex-1 border-white/10 text-zinc-400 bg-transparent hover:bg-white/5 hover:text-white text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={saving || selectedIds.length === 0}
              className="flex-1 text-white text-xs border-0"
              style={{ background: topicColor }}
            >
              {saving ? "Creating..." : "Start Conversation"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewConversationModal;
