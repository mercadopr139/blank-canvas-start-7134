import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, CheckSquare, Trophy, Megaphone, Clock } from "lucide-react";

type CalendarEntry = {
  id: string;
  title: string;
  date: string;
  type: "meeting" | "deadline" | "grant" | "program" | "task" | "upcoming";
  description?: string;
};

const TYPE_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  meeting: { color: "#38bdf8", icon: CalendarDays, label: "Meeting" },
  deadline: { color: "#bf0f3e", icon: Clock, label: "Deadline" },
  grant: { color: "#f59e0b", icon: Trophy, label: "Grant" },
  program: { color: "#22c55e", icon: Megaphone, label: "Program" },
  task: { color: "#a1a1aa", icon: CheckSquare, label: "Task" },
  upcoming: { color: "#a78bfa", icon: CalendarDays, label: "Event" },
};

interface Props {
  currentUserId: string;
}

const MessageCalendarPanel = ({ currentUserId }: Props) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Fetch mb_calendar_events
  const { data: mbEvents = [] } = useQuery({
    queryKey: ["mb-calendar-events"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("mb_calendar_events") as any)
        .select("*")
        .order("event_date", { ascending: true });
      if (error) throw error;
      return (data || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.event_date,
        type: e.event_type as CalendarEntry["type"],
        description: e.description,
      })) as CalendarEntry[];
    },
  });

  // Fetch upcoming_events from the main events table
  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ["upcoming-events-for-mb"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("upcoming_events")
        .select("id, title, event_date, description")
        .order("event_date", { ascending: true });
      if (error) throw error;
      return (data || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.event_date,
        type: "upcoming" as const,
        description: e.description,
      })) as CalendarEntry[];
    },
  });

  // Fetch mb_tasks with due dates
  const { data: taskEvents = [] } = useQuery({
    queryKey: ["mb-tasks-calendar"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("mb_tasks") as any)
        .select("id, title, due_date, status")
        .not("due_date", "is", null)
        .neq("status", "Completed");
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        date: t.due_date,
        type: "task" as const,
      })) as CalendarEntry[];
    },
  });

  const allEntries: CalendarEntry[] = [...mbEvents, ...upcomingEvents, ...taskEvents];

  // Dates that have entries (for calendar dot indicators)
  const entryDates = new Set(allEntries.map((e) => e.date));

  // Filter entries for selected date
  const selectedDateStr = selectedDate
    ? selectedDate.toISOString().split("T")[0]
    : null;

  const selectedEntries = selectedDateStr
    ? allEntries.filter((e) => e.date === selectedDateStr)
    : [];

  // Upcoming entries (next 30 days)
  const today = new Date().toISOString().split("T")[0];
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const thirtyDaysStr = thirtyDays.toISOString().split("T")[0];

  const upcomingList = allEntries
    .filter((e) => e.date >= today && e.date <= thirtyDaysStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  const formatEntryDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Calendar</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Calendar */}
        <div className="p-2 border-b border-white/[0.06]">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-lg bg-transparent text-zinc-300 [&_.rdp-day_button:hover]:bg-white/[0.08] [&_.rdp-day_button.rdp-day_selected]:bg-[#bf0f3e] [&_.rdp-day_button.rdp-day_selected]:text-white [&_.rdp-nav_button:hover]:bg-white/[0.06] [&_.rdp-head_cell]:text-zinc-600 [&_.rdp-caption_label]:text-zinc-300 scale-90 origin-top"
            modifiers={{
              hasEvent: (date) => entryDates.has(date.toISOString().split("T")[0]),
            }}
            modifiersClassNames={{
              hasEvent: "after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-[#bf0f3e]",
            }}
          />
        </div>

        {/* Selected date entries */}
        {selectedDateStr && (
          <div className="px-3 py-3 border-b border-white/[0.06]">
            <p className="text-xs font-semibold text-zinc-500 mb-2">
              {selectedDate?.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
            </p>
            {selectedEntries.length === 0 ? (
              <p className="text-xs text-zinc-700">Nothing scheduled</p>
            ) : (
              <div className="space-y-2">
                {selectedEntries.map((entry) => {
                  const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.upcoming;
                  const Icon = cfg.icon;
                  return (
                    <div key={entry.id} className="flex items-start gap-2">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${cfg.color}15`, color: cfg.color }}
                      >
                        <Icon className="w-3 h-3" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-300">{entry.title}</p>
                        {entry.description && (
                          <p className="text-[10px] text-zinc-600">{entry.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Upcoming list */}
        <div className="px-3 py-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Next 30 Days
          </p>
          {upcomingList.length === 0 ? (
            <p className="text-xs text-zinc-700">Nothing coming up</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingList.map((entry) => {
                const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.upcoming;
                const Icon = cfg.icon;
                return (
                  <div key={`${entry.type}-${entry.id}`} className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${cfg.color}15`, color: cfg.color }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-300 truncate">{entry.title}</p>
                      <p className="text-[10px] text-zinc-600">{formatEntryDate(entry.date)}</p>
                    </div>
                    <Badge
                      className="text-[9px] px-1.5 py-0 h-4 border-0 flex-shrink-0"
                      style={{ background: `${cfg.color}15`, color: cfg.color }}
                    >
                      {cfg.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageCalendarPanel;
