// New conversation (Josh, 2026-10-19): a title, a pillar in its colour, who
// it is to, start. The pillar is what puts the conversation on the Lap. The
// window wears the back end's house dialog style; shared wall-board logins
// (the Gym Board) are not people and are not offered.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";
import type { StaffProfile, Pillar } from "@/pages/admin/AdminMessageBoard";
import { PILLARS, PILLAR_COLOR, PILLAR_LABEL } from "@/pages/admin/AdminMessageBoard";
import { displayNameFor, isSharedLogin } from "@/lib/staff";

const NLA_RED = "#bf0f3e";

interface Props {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  onCreated: (conversationId: string) => void;
}

const NewConversationModal = ({ open, onClose, currentUserId, onCreated }: Props) => {
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // No default pillar: the choice is the point, it decides where the conversation sits on the Lap.
  const [pillar, setPillar] = useState<Pillar | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: staffList = [] } = useQuery<StaffProfile[]>({
    queryKey: ["staff-profiles-for-mb"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("id, user_id, full_name, display_name, job_title, task_manager_type")
        .eq("status", "active")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return ((data || []) as StaffProfile[]).filter((s) => s.user_id !== currentUserId && !isSharedLogin(s));
    },
    enabled: open,
  });

  const toggle = (userId: string | null) => {
    if (!userId) return;
    setSelectedIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const handleClose = () => {
    setTitle("");
    setSelectedIds([]);
    setPillar(null);
    onClose();
  };

  const canSubmit = title.trim().length > 0 && !!pillar && selectedIds.length > 0;

  const handleCreate = async () => {
    if (!canSubmit || !pillar) return;
    setSaving(true);
    try {
      // Title-based threads: several conversations between the same people are fine, one per topic.
      const { data: newConv, error: convErr } = await supabase
        .from("mb_conversations")
        .insert({ name: title.trim(), is_group: selectedIds.length > 1, created_by: currentUserId, pillar })
        .select()
        .single();
      if (convErr) throw convErr;
      const { error: memErr } = await supabase
        .from("mb_conversation_members")
        .insert([currentUserId, ...selectedIds].map((uid) => ({ conversation_id: newConv.id, user_id: uid })));
      if (memErr) throw memErr;
      onCreated(newConv.id);
      handleClose();
    } catch (err) {
      toast.error(`Couldn't start the conversation: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <MessageSquare className="w-5 h-5" style={{ color: pillar ? PILLAR_COLOR[pillar] : NLA_RED }} /> New conversation
          </DialogTitle>
          <DialogDescription className="text-white/60">A title, its pillar, and who it is to. The pillar puts it on the Lap, where you both review it.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void handleCreate(); }}>
          <div>
            <label className="text-sm text-white/60" htmlFor="mb-title">Title</label>
            <Input
              id="mb-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Van painting plan, Sponsor outreach, Budget review"
              className="mt-1 bg-white/10 border-white/20 text-white"
            />
          </div>

          <div>
            <p className="text-sm text-white/60">Pillar</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PILLARS.map((p) => {
                const color = PILLAR_COLOR[p];
                const active = pillar === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPillar(p)}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
                    style={active ? { backgroundColor: `${color}26`, borderColor: color, color: "#fff" } : { borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)" }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    {PILLAR_LABEL[p]}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-white/35 mt-1.5">Set once; it stays with the conversation.</p>
          </div>

          <div>
            <p className="text-sm text-white/60">To</p>
            <div className="mt-1.5 max-h-52 overflow-y-auto rounded-md border border-white/10 divide-y divide-white/[0.06]">
              {staffList.length === 0 && <p className="px-3 py-3 text-sm text-white/35">No one to send to yet.</p>}
              {staffList.map((staff) => {
                const hasAccount = !!staff.user_id;
                const checked = hasAccount && selectedIds.includes(staff.user_id);
                return (
                  <label
                    key={staff.id}
                    className={`flex items-center gap-3 px-3 py-2.5 ${hasAccount ? "cursor-pointer hover:bg-white/[0.04]" : "opacity-40 cursor-not-allowed"} ${checked ? "bg-white/[0.06]" : ""}`}
                    title={!hasAccount ? "This person hasn't logged in yet" : undefined}
                  >
                    <input type="checkbox" checked={checked} disabled={!hasAccount} onChange={() => toggle(staff.user_id)} className="accent-[#bf0f3e]" />
                    <span className="min-w-0">
                      <span className="block text-sm text-white/90">{displayNameFor(staff)}</span>
                      <span className="block text-[12px] text-white/45">
                        {staff.job_title || ""}
                        {!hasAccount && <span className="ml-1 text-white/30">· hasn't logged in yet</span>}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} className="border-white/20 text-white bg-transparent hover:bg-white/10 hover:text-white">Cancel</Button>
          <Button onClick={() => void handleCreate()} disabled={saving || !canSubmit} className="text-white" style={{ backgroundColor: NLA_RED }}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Start the conversation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewConversationModal;
