/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Pencil, Send, Calendar, User, Flag } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import StaffTaskModal from "./StaffTaskModal";

type StaffTask = {
  id: string;
  title: string;
  description: string | null;
  status: "Open" | "In Progress" | "Completed" | "Blocked";
  priority: "Low" | "Medium" | "High";
  due_date: string | null;
  assigned_to: string | null;
  focus_area_id: string | null;
  created_by: string;
  created_at: string;
};

type Props = {
  task: StaffTask | null;
  onClose: () => void;
  staffNames: Record<string, string>;
};

const statusColors: Record<string, string> = {
  Open: "bg-zinc-700 text-zinc-200",
  "In Progress": "bg-blue-900/60 text-blue-300",
  Completed: "bg-green-900/60 text-green-300",
  Blocked: "bg-red-900/60 text-red-300",
};

const priorityColors: Record<string, string> = {
  Low: "bg-zinc-700 text-zinc-300",
  Medium: "bg-yellow-900/60 text-yellow-300",
  High: "bg-red-900/60 text-red-300",
};

export default function StaffTaskDetailSheet({ task, onClose, staffNames }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const { data: comments = [] } = useQuery({
    queryKey: ["staff-task-comments", task?.id],
    enabled: !!task,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("staff_task_comments")
        .select("*") as any)
        .eq("task_id", task!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as { id: string; author_id: string; body: string; created_at: string }[];
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("staff_task_comments") as any).insert({
        task_id: task!.id,
        author_id: user?.id,
        body: commentBody.trim(),
      });
      if (error) throw error;

      // Notify the other party
      const notifyUserId =
        user?.id === task!.created_by ? task!.assigned_to : task!.created_by;
      if (notifyUserId && notifyUserId !== user?.id) {
        await (supabase.from("staff_task_notifications") as any).insert({
          user_id: notifyUserId,
          task_id: task!.id,
          type: "commented",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-task-comments", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["staff-task-notifications"] });
      setCommentBody("");
    },
    onError: () => toast.error("Failed to post comment"),
  });

  if (!task) return null;

  const canEdit =
    user?.email === "joshmercado@nolimitsboxingacademy.org" ||
    task.created_by === user?.id;

  return (
    <>
      <Sheet open={!!task} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="bg-neutral-900 border-white/10 text-white w-full sm:max-w-lg flex flex-col">
          <SheetHeader className="flex-row items-start justify-between gap-2 pb-4 border-b border-white/10">
            <SheetTitle className="text-white text-left leading-snug pr-8">
              {task.title}
            </SheetTitle>
            {canEdit && (
              <button
                onClick={() => setEditOpen(true)}
                className="shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </SheetHeader>

          {/* Meta */}
          <div className="flex flex-wrap gap-2 py-4 border-b border-white/10">
            <Badge className={statusColors[task.status]}>{task.status}</Badge>
            <Badge className={priorityColors[task.priority]}>
              <Flag className="w-3 h-3 mr-1" />{task.priority}
            </Badge>
            {task.due_date && (
              <Badge className="bg-zinc-700 text-zinc-200">
                <Calendar className="w-3 h-3 mr-1" />
                {format(new Date(task.due_date), "MMM d, yyyy")}
              </Badge>
            )}
            {task.assigned_to && staffNames[task.assigned_to] && (
              <Badge className="bg-zinc-700 text-zinc-200">
                <User className="w-3 h-3 mr-1" />
                {staffNames[task.assigned_to]}
              </Badge>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div className="py-4 border-b border-white/10">
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Comments */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Comments
            </p>
            {comments.length === 0 ? (
              <p className="text-sm text-zinc-600">No comments yet.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-300">
                      {staffNames[c.author_id] ?? "Staff"}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {format(new Date(c.created_at), "MMM d 'at' h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 bg-white/5 rounded-lg px-3 py-2 whitespace-pre-wrap">
                    {c.body}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Comment input */}
          <div className="pt-4 border-t border-white/10 space-y-2">
            <Textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Add a comment…"
              className="bg-neutral-800 border-white/10 text-white placeholder:text-zinc-500 resize-none"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && commentBody.trim()) {
                  addComment.mutate();
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                onClick={() => addComment.mutate()}
                disabled={!commentBody.trim() || addComment.isPending}
                size="sm"
                className="bg-[#bf0f3e] hover:bg-[#a00d34] text-white gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {addComment.isPending ? "Posting…" : "Post"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {editOpen && (
        <StaffTaskModal
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
            queryClient.invalidateQueries({ queryKey: ["staff-tasks"] });
          }}
          editingTask={task}
        />
      )}
    </>
  );
}
