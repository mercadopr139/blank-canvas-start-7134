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
import type { StaffProfile } from "@/pages/admin/AdminMessageBoard";

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
  const [saving, setSaving] = useState(false);

  const { data: staffList = [] } = useQuery<StaffProfile[]>({
    queryKey: ["staff-profiles-for-mb"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("staff_profiles") as any)
        .select("id, user_id, full_name, role, task_manager_type")
        .neq("user_id", currentUserId)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data as StaffProfile[];
    },
    enabled: open,
  });

  const toggle = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const isGroup = selectedIds.length > 1;

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
      // Check if a DM between these two users already exists
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

      // Create conversation
      const { data: newConv, error: convErr } = await (supabase.from("mb_conversations") as any)
        .insert({
          name: isGroup ? groupName.trim() : null,
          is_group: isGroup,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (convErr) throw convErr;

      // Add members (include current user)
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
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-neutral-900 border-white/[0.08] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white">New Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Staff selector */}
          <div>
            <Label className="text-xs text-zinc-400 mb-2 block">To</Label>
            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {staffList.length === 0 && (
                <p className="text-xs text-zinc-600 py-2">No staff members found</p>
              )}
              {staffList.map((staff) => {
                const checked = selectedIds.includes(staff.user_id);
                return (
                  <label
                    key={staff.user_id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      checked ? "bg-[#bf0f3e]/10" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(staff.user_id)}
                      className="border-white/20 data-[state=checked]:bg-[#bf0f3e] data-[state=checked]:border-[#bf0f3e]"
                    />
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(191,15,62,0.15)", color: "#bf0f3e" }}
                    >
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{staff.full_name}</p>
                      {staff.role && <p className="text-xs text-zinc-500">{staff.role}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Group name (only if multiple selected) */}
          {isGroup && (
            <div>
              <Label className="text-xs text-zinc-400 mb-1.5 block">Group Name</Label>
              <Input
                placeholder="e.g. All Staff, Coaching Team..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-[#bf0f3e]/50 text-sm"
              />
            </div>
          )}

          {selectedIds.length > 0 && (
            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
              {isGroup ? <Users className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              {isGroup
                ? `Group with ${selectedIds.length + 1} members`
                : `Direct message`}
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
              className="flex-1 bg-[#bf0f3e] hover:bg-[#a00d34] text-white text-xs"
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
