/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell } from "lucide-react";
import { format } from "date-fns";

type Notification = {
  id: string;
  task_id: string;
  type: "assigned" | "commented" | "status_changed";
  read: boolean;
  created_at: string;
  task_title?: string;
};

type Props = {
  onSelectTask: (taskId: string) => void;
};

const typeLabels: Record<string, string> = {
  assigned: "assigned you a task",
  commented: "commented on a task",
  status_changed: "updated a task status",
};

export default function TaskNotificationBell({ onSelectTask }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["staff-task-notifications"],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("staff_task_notifications")
        .select("*, staff_tasks(title)") as any)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as any[]).map((n) => ({
        ...n,
        task_title: n.staff_tasks?.title ?? "a task",
      })) as Notification[];
    },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      await (supabase.from("staff_task_notifications") as any)
        .update({ read: true })
        .in("id", ids);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-task-notifications"] });
    },
  });

  const handleOpen = () => {
    setOpen((v) => !v);
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) markRead.mutate(unreadIds);
  };

  const handleSelectNotification = (n: Notification) => {
    setOpen(false);
    onSelectTask(n.task_id);
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-[#bf0f3e] text-white text-[10px] font-bold flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-sm font-semibold text-white">Notifications</p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-zinc-500 px-4 py-6 text-center">
                  No notifications yet
                </p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleSelectNotification(n)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="mt-1.5 w-2 h-2 rounded-full bg-[#bf0f3e] shrink-0" />
                      )}
                      <div className={!n.read ? "" : "ml-4"}>
                        <p className="text-xs text-zinc-300 leading-snug">
                          Someone {typeLabels[n.type]}:{" "}
                          <span className="font-semibold text-white">{n.task_title}</span>
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          {format(new Date(n.created_at), "MMM d 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
