import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, User, Calendar, ArrowUpRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TOPIC_COLORS: Record<string, string> = {
  Operations: "#bf0f3e",
  "Sales & Marketing": "#22c55e",
  Finance: "#38bdf8",
  General: "#a1a1aa",
};

type MbTask = {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_by: string;
  due_date: string | null;
  status: string;
  priority: string;
  topic: string;
  sent_to_task_manager: boolean;
  task_manager_type: string | null;
  assignee_name?: string;
  assigner_name?: string;
};

interface Props {
  taskId: string;
  currentUserId: string;
  isMe: boolean;
}

const MessageTaskCard = ({ taskId, currentUserId, isMe }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);

  const { data: task, isLoading } = useQuery<MbTask | null>({
    queryKey: ["mb-task", taskId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("mb_tasks") as any)
        .select("*")
        .eq("id", taskId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const userIds = [data.assigned_to, data.assigned_by].filter(Boolean) as string[];
      const { data: profiles } = await (supabase.from("staff_profiles") as any)
        .select("user_id, full_name")
        .in("user_id", userIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name; });

      return {
        ...data,
        assignee_name: data.assigned_to ? nameMap[data.assigned_to] : null,
        assigner_name: nameMap[data.assigned_by] || "Unknown",
      } as MbTask;
    },
  });

  const handleSendToTaskManager = async () => {
    if (!task || !task.assigned_to) return;
    setSending(true);
    try {
      // Look up assignee's task_manager_type
      const { data: profile } = await (supabase.from("staff_profiles") as any)
        .select("task_manager_type")
        .eq("user_id", task.assigned_to)
        .maybeSingle();

      const managerType = profile?.task_manager_type;
      if (!managerType) {
        toast({ title: "Assignee has no task manager set up", variant: "destructive" });
        setSending(false);
        return;
      }

      // Get a focus area for this user's manager
      const { data: focusArea } = await (supabase.from("focus_areas") as any)
        .select("id")
        .eq("manager_type", managerType)
        .limit(1)
        .maybeSingle();

      if (!focusArea) {
        toast({ title: "No focus area found for this task manager", variant: "destructive" });
        setSending(false);
        return;
      }

      // Create signal
      const { error: sigErr } = await (supabase.from("signals") as any).insert({
        focus_area_id: focusArea.id,
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        status: "Open",
        manager_type: managerType,
        source: "message_board",
      });
      if (sigErr) throw sigErr;

      // Mark task as sent
      const { error: updateErr } = await (supabase.from("mb_tasks") as any)
        .update({ sent_to_task_manager: true, task_manager_type: managerType })
        .eq("id", task.id);
      if (updateErr) throw updateErr;

      queryClient.invalidateQueries({ queryKey: ["mb-task", taskId] });
      toast({ title: `Sent to ${managerType} Task Manager` });
    } catch (err: any) {
      toast({ title: "Failed to send to task manager", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (isLoading || !task) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 animate-pulse h-24" />
    );
  }

  const topicColor = TOPIC_COLORS[task.topic] || TOPIC_COLORS.General;

  return (
    <div
      className="rounded-xl border bg-white/[0.04] p-3 space-y-2"
      style={{ borderColor: `${topicColor}30` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: topicColor }} />
          <p className="text-sm font-semibold text-zinc-200 leading-tight">{task.title}</p>
        </div>
        <Badge
          className="text-[10px] px-2 py-0 h-5 flex-shrink-0 border-0"
          style={{ background: `${topicColor}20`, color: topicColor }}
        >
          {task.topic}
        </Badge>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-zinc-500 leading-relaxed">{task.description}</p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
        {task.assignee_name && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {task.assignee_name}
          </span>
        )}
        {task.due_date && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(task.due_date).toLocaleDateString([], { month: "short", day: "numeric" })}
          </span>
        )}
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{
            background: task.status === "Completed" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
            color: task.status === "Completed" ? "#22c55e" : "#a1a1aa",
          }}
        >
          {task.status}
        </span>
      </div>

      {/* Send to Task Manager button */}
      {task.assigned_to && !task.sent_to_task_manager && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleSendToTaskManager}
          disabled={sending}
          className="w-full h-7 text-[11px] border-white/10 text-zinc-400 bg-transparent hover:bg-white/5 hover:text-white gap-1.5"
        >
          <ArrowUpRight className="w-3 h-3" />
          {sending ? "Sending..." : "Send to Task Manager"}
        </Button>
      )}

      {task.sent_to_task_manager && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-500">
          <Check className="w-3 h-3" />
          Sent to {task.task_manager_type} Task Manager
        </div>
      )}
    </div>
  );
};

export default MessageTaskCard;
