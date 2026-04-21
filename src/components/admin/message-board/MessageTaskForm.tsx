import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { StaffProfile } from "@/pages/admin/AdminMessageBoard";

const TOPIC_COLORS: Record<string, string> = {
  Operations: "#bf0f3e",
  "Sales & Marketing": "#22c55e",
  Finance: "#38bdf8",
  General: "#a1a1aa",
};

const TOPICS = ["General", "Operations", "Sales & Marketing", "Finance"] as const;
const PRIORITIES = ["Low", "Medium", "High"] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  currentUserId: string;
  onCreated: (taskId: string) => void;
}

const MessageTaskForm = ({ open, onClose, conversationId, currentUserId, onCreated }: Props) => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("unassigned");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [topic, setTopic] = useState<typeof TOPICS[number]>("General");
  const [saving, setSaving] = useState(false);

  const { data: staffList = [] } = useQuery<StaffProfile[]>({
    queryKey: ["staff-profiles-for-mb"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("staff_profiles") as any)
        .select("id, user_id, full_name, job_title, task_manager_type")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data || []) as StaffProfile[];
    },
    enabled: open,
  });

  const topicColor = TOPIC_COLORS[topic];

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Task title is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const assignedToValue = assignedTo === "unassigned" ? null : assignedTo;

      // Create task
      const { data: newTask, error: taskErr } = await (supabase.from("mb_tasks") as any)
        .insert({
          conversation_id: conversationId,
          title: title.trim(),
          description: description.trim() || null,
          assigned_to: assignedToValue,
          assigned_by: currentUserId,
          due_date: dueDate || null,
          priority,
          topic,
          status: "Open",
        })
        .select()
        .single();
      if (taskErr) throw taskErr;

      // Post a task message in the thread
      // task_id is stored as JSON in content until the column migration runs
      const { error: msgErr } = await (supabase.from("mb_messages") as any).insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: JSON.stringify({ task_id: newTask.id, title: title.trim() }),
        message_type: "task",
      });
      if (msgErr) throw msgErr;

      onCreated(newTask.id);
      handleClose();
    } catch (err: any) {
      toast({ title: "Failed to create task", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setAssignedTo("unassigned");
    setDueDate("");
    setPriority("Medium");
    setTopic("General");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-neutral-900 border-white/[0.08] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: topicColor }}
            />
            New Task
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Title */}
          <div>
            <Label className="text-xs text-zinc-400 mb-1.5 block">Title *</Label>
            <Input
              placeholder="What needs to get done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-[#bf0f3e]/50 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs text-zinc-400 mb-1.5 block">Details (optional)</Label>
            <Textarea
              placeholder="Add more context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-[#bf0f3e]/50 text-sm"
            />
          </div>

          {/* Topic — color coded */}
          <div>
            <Label className="text-xs text-zinc-400 mb-1.5 block">Topic</Label>
            <div className="flex gap-2 flex-wrap">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                  style={{
                    background: topic === t ? `${TOPIC_COLORS[t]}20` : "transparent",
                    borderColor: topic === t ? TOPIC_COLORS[t] : "rgba(255,255,255,0.08)",
                    color: topic === t ? TOPIC_COLORS[t] : "#71717a",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Row: Assign + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-zinc-400 mb-1.5 block">Assign to</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-zinc-200 text-sm h-9 focus:ring-1 focus:ring-[#bf0f3e]/50">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-white/[0.08]">
                  <SelectItem value="unassigned" className="text-zinc-400 text-sm focus:bg-white/[0.06] focus:text-white">
                    Unassigned
                  </SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id} className="text-zinc-200 text-sm focus:bg-white/[0.06] focus:text-white">
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-zinc-400 mb-1.5 block">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-zinc-200 text-sm h-9 focus:ring-1 focus:ring-[#bf0f3e]/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-white/[0.08]">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="text-zinc-200 text-sm focus:bg-white/[0.06] focus:text-white">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due date */}
          <div>
            <Label className="text-xs text-zinc-400 mb-1.5 block">Due Date (optional)</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-zinc-200 focus-visible:ring-1 focus-visible:ring-[#bf0f3e]/50 text-sm [color-scheme:dark]"
            />
          </div>

          {/* Actions */}
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
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex-1 bg-[#bf0f3e] hover:bg-[#a00d34] text-white text-xs"
            >
              {saving ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MessageTaskForm;
