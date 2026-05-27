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
import type { StaffProfile, Pillar } from "@/pages/admin/AdminMessageBoard";
import { PILLARS, PILLAR_COLOR, PILLAR_LABEL } from "@/pages/admin/AdminMessageBoard";
import { displayNameFor } from "@/lib/staff";

interface Props {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  onCreated: (conversationId: string) => void;
}

const NewConversationModal = ({ open, onClose, currentUserId, onCreated }: Props) => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Pillar starts unset — user must choose before "Start Conversation" is enabled
  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: staffList = [] } = useQuery<StaffProfile[]>({
    queryKey: ["staff-profiles-for-mb"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("id, user_id, full_name, display_name, job_title, task_manager_type")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return ((data || []) as StaffProfile[]).filter((s) => s.user_id !== currentUserId);
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
  const pillarColor = pillar ? PILLAR_COLOR[pillar] : "#52525b";

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ title: "Give this conversation a title", variant: "destructive" });
      return;
    }
    if (!pillar) {
      toast({ title: "Pick a pillar", variant: "destructive" });
      return;
    }
    if (selectedIds.length === 0) {
      toast({ title: "Select at least one person", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Title-based threads: multiple conversations per pair are allowed
      // (one for each topic). No dedup — every Start spawns a fresh thread.
      const { data: newConv, error: convErr } = await supabase
        .from("mb_conversations")
        .insert({
          name: title.trim(),
          is_group: isGroup,
          created_by: currentUserId,
          pillar,
        })
        .select()
        .single();

      if (convErr) throw convErr;

      const allMembers = [currentUserId, ...selectedIds];
      const memberRows = allMembers.map((uid) => ({
        conversation_id: newConv.id,
        user_id: uid,
      }));
      const { error: memErr } = await supabase
        .from("mb_conversation_members")
        .insert(memberRows);
      if (memErr) throw memErr;

      onCreated(newConv.id);
      handleClose();
    } catch (err) {
      toast({
        title: "Failed to create conversation",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setSelectedIds([]);
    setPillar(null);
    onClose();
  };

  const canSubmit = title.trim().length > 0 && !!pillar && selectedIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-neutral-900 border-white/[0.08] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: pillarColor }} />
            New Message
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Title — required, drives the sidebar row label */}
          <div>
            <Label className="text-xs text-zinc-400 mb-1.5 block">
              Title <span className="text-red-400">*</span>
            </Label>
            <Input
              placeholder="e.g. Van Painting Plan, Sponsor Outreach Q3, Budget Review..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 text-sm"
              autoFocus
            />
          </div>

          {/* Pillar selector — required, no default */}
          <div>
            <Label className="text-xs text-zinc-400 mb-2 block">
              Pillar <span className="text-red-400">*</span>
            </Label>
            <div className="flex gap-2 flex-wrap">
              {PILLARS.map((p) => {
                const color = PILLAR_COLOR[p];
                const active = pillar === p;
                return (
                  <button
                    key={p}
                    onClick={() => setPillar(p)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                    style={{
                      background: active ? `${color}20` : "transparent",
                      borderColor: active ? color : "rgba(255,255,255,0.08)",
                      color: active ? color : "#71717a",
                    }}
                  >
                    {PILLAR_LABEL[p]}
                  </button>
                );
              })}
            </div>
            {!pillar && (
              <p className="text-[11px] text-zinc-600 mt-1.5">Pick a pillar — this is locked once the conversation is created.</p>
            )}
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
                    style={checked && pillar ? { background: `${pillarColor}15` } : undefined}
                    title={!hasAccount ? "This staff member hasn't logged in yet" : undefined}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!hasAccount}
                      onCheckedChange={() => hasAccount && toggle(staff.user_id)}
                      className="border-white/20"
                      style={checked && pillar ? { background: pillarColor, borderColor: pillarColor } : undefined}
                    />
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `${pillarColor}18`, color: pillarColor }}
                    >
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{displayNameFor(staff)}</p>
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

          {selectedIds.length > 0 && pillar && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: pillarColor }}>
              {isGroup ? <Users className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              {isGroup ? `Group · ${PILLAR_LABEL[pillar]}` : `Direct message · ${PILLAR_LABEL[pillar]}`}
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
              disabled={saving || !canSubmit}
              className="flex-1 text-white text-xs border-0 disabled:opacity-40"
              style={{ background: pillar ? pillarColor : "#52525b" }}
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
