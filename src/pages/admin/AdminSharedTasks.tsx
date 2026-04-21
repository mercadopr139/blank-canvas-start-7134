/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Calendar, User, Flag, LogOut } from "lucide-react";
import { format } from "date-fns";
import nlaLogo from "@/assets/nla-logo-white.png";
import StaffTaskModal from "@/components/admin/StaffTaskModal";
import StaffTaskDetailSheet from "@/components/admin/StaffTaskDetailSheet";
import TaskNotificationBell from "@/components/admin/TaskNotificationBell";

const JOSH_EMAIL = "joshmercado@nolimitsboxingacademy.org";
const CHRISSY_EMAIL = "chrissycasiello@nolimitsboxingacademy.org";

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
  focus_areas?: { title: string } | null;
};

const statusColors: Record<string, string> = {
  Open: "bg-zinc-700 text-zinc-200",
  "In Progress": "bg-blue-900/60 text-blue-300",
  Completed: "bg-green-900/60 text-green-300",
  Blocked: "bg-red-900/60 text-red-300",
};

const priorityColors: Record<string, string> = {
  Low: "bg-zinc-700/50 text-zinc-400",
  Medium: "bg-yellow-900/40 text-yellow-400",
  High: "bg-red-900/40 text-red-400",
};

type Filter = "all" | "mine" | "created" | "open" | "completed";

export default function AdminSharedTasks() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isJosh = user?.email?.toLowerCase() === JOSH_EMAIL;

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<StaffTask | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  // Load staff names for Josh + Chrissy
  const { data: staffProfiles = [] } = useQuery({
    queryKey: ["staff-assignees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("user_id, full_name, email")
        .in("email", [JOSH_EMAIL, CHRISSY_EMAIL]);
      if (error) throw error;
      return data as { user_id: string; full_name: string; email: string }[];
    },
  });

  const staffNames: Record<string, string> = Object.fromEntries(
    staffProfiles.map((s) => [s.user_id, s.full_name])
  );

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["staff-tasks"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("staff_tasks")
        .select("*, focus_areas(title)") as any)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StaffTask[];
    },
  });

  const filteredTasks = tasks.filter((t) => {
    if (filter === "mine") return t.assigned_to === user?.id;
    if (filter === "created") return t.created_by === user?.id;
    if (filter === "open") return t.status === "Open" || t.status === "In Progress";
    if (filter === "completed") return t.status === "Completed";
    return true;
  });

  const handleSelectTaskById = (taskId: string) => {
    const found = tasks.find((t) => t.id === taskId);
    if (found) setSelectedTask(found);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const filterTabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All Tasks" },
    { key: "mine", label: "Assigned to Me" },
    { key: "created", label: "Created by Me" },
    { key: "open", label: "Active" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/dashboard")}
              className="text-zinc-400 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                Shared Task Board
              </h1>
              <p className="text-xs text-zinc-500 font-medium">
                {isJosh ? "All staff tasks" : "Your tasks"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TaskNotificationBell onSelectTask={handleSelectTaskById} />
            <Button
              onClick={() => setModalOpen(true)}
              size="sm"
              className="bg-[#bf0f3e] hover:bg-[#a00d34] text-white gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Task
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5 hover:text-white text-xs h-9"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img
            src={nlaLogo}
            alt="No Limits Academy"
            className="h-20 w-auto drop-shadow-[0_0_60px_rgba(191,15,62,0.15)]"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.key
                  ? "bg-[#bf0f3e] text-white"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Task list */}
        {isLoading ? (
          <div className="text-center text-zinc-500 py-20">Loading…</div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-500 mb-4">No tasks here yet.</p>
            <Button
              onClick={() => setModalOpen(true)}
              className="bg-[#bf0f3e] hover:bg-[#a00d34] text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Task
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="w-full text-left bg-neutral-900 border border-white/[0.07] rounded-xl px-5 py-4 hover:border-white/20 hover:bg-neutral-800/60 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-white">
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">
                        {task.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge className={`text-xs ${statusColors[task.status]}`}>
                        {task.status}
                      </Badge>
                      <Badge className={`text-xs ${priorityColors[task.priority]}`}>
                        <Flag className="w-3 h-3 mr-1" />
                        {task.priority}
                      </Badge>
                      {task.focus_areas?.title && (
                        <Badge className="text-xs bg-zinc-800 text-zinc-300">
                          {task.focus_areas.title}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 text-xs text-zinc-500">
                    {task.assigned_to && staffNames[task.assigned_to] && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {staffNames[task.assigned_to]}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(task.due_date), "MMM d")}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Create modal */}
      <StaffTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      {/* Detail sheet */}
      <StaffTaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        staffNames={staffNames}
      />
    </div>
  );
}
