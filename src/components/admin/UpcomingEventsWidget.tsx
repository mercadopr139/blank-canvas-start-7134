import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarDays, Plus, Pencil, Trash2, icons } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, parseISO, isToday } from "date-fns";

interface UpcomingEvent {
  id: string;
  event_name: string;
  event_date: string;
  notes: string | null;
  created_at: string;
}

interface UpcomingEventsWidgetProps {
  focusArea?: string;
  title?: string;
  accentColor?: string;
  iconName?: string;
  subtitle?: string | null;
}

const FOCUS_AREA_LABELS: Record<string, string> = {
  nla: "NLA", "usa-boxing": "USA Boxing", quikhit: "QUIKHIT", fcusa: "FCUSA", personal: "Personal",
};

const getIconComponent = (name?: string) => {
  if (!name) return CalendarDays;

  const pascal = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");

  return (icons as any)[pascal] || CalendarDays;
};

const UpcomingEventsWidget = ({
  focusArea = "nla",
  title = "Upcoming Events",
  accentColor = "#f59e0b",
  iconName = "calendar-days",
  subtitle,
}: UpcomingEventsWidgetProps) => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<UpcomingEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UpcomingEvent | null>(null);
  const [formName, setFormName] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const areaLabel = FOCUS_AREA_LABELS[focusArea] || focusArea;
  const isNla = focusArea === "nla";
  const HeaderIcon = getIconComponent(iconName);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["upcoming-events", focusArea],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      let q = supabase
        .from("upcoming_events" as any)
        .select("*")
        .gte("event_date", today);
      if (isNla) {
        q = q.or("source.is.null,source.eq.NLA");
      } else {
        q = q.eq("source", areaLabel);
      }
      const { data, error } = await q.order("event_date", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as UpcomingEvent[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingEvent) {
        const { error } = await supabase
          .from("upcoming_events" as any)
          .update({ event_name: formName, event_date: formDate, notes: formNotes || null } as any)
          .eq("id", editingEvent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("upcoming_events" as any)
          .insert({ event_name: formName, event_date: formDate, notes: formNotes || null, source: areaLabel } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["upcoming-events", focusArea] });
      toast.success(editingEvent ? "Event updated" : "Event added");
      closeModal();
    },
    onError: () => toast.error("Failed to save event"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("upcoming_events" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["upcoming-events", focusArea] });
      toast.success("Event deleted");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete event"),
  });

  const openAdd = () => {
    setEditingEvent(null);
    setFormName("");
    setFormDate("");
    setFormNotes("");
    setModalOpen(true);
  };

  const openEdit = (ev: UpcomingEvent) => {
    setEditingEvent(ev);
    setFormName(ev.event_name);
    setFormDate(ev.event_date);
    setFormNotes(ev.notes || "");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingEvent(null);
  };

  const getUrgencyClass = (dateStr: string) => {
    const days = differenceInDays(parseISO(dateStr), new Date());
    if (isToday(parseISO(dateStr))) return "border-l-4 border-l-amber-400 bg-amber-400/5";
    if (days <= 7) return "border-l-4 border-l-amber-400/60 bg-amber-400/[0.02]";
    if (days <= 14) return "border-l-4 border-l-white/20";
    return "border-l-4 border-l-transparent";
  };

  const getDateLabel = (dateStr: string) => {
    if (isToday(parseISO(dateStr))) return "Today";
    const days = differenceInDays(parseISO(dateStr), new Date());
    if (days === 1) return "Tomorrow";
    return format(parseISO(dateStr), "MMM d");
  };

  return (
    <>
      <Card
        className="bg-white/5 border text-white"
        style={{
          borderColor: `${accentColor}33`,
          boxShadow: `0 0 0 1px ${accentColor}12 inset`,
        }}
      >
        <CardHeader className="pb-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
              >
                <HeaderIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold text-white truncate">{title}</CardTitle>
                {subtitle ? <p className="text-xs text-white/40 mt-0.5 truncate">{subtitle}</p> : null}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={openAdd}
              className="h-7 px-2 text-xs hover:bg-white/10 w-fit shrink-0"
              style={{ color: accentColor }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Event
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <p className="text-xs text-white/40">Loading…</p>
          ) : events.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-white/40">No upcoming events</p>
              <p className="text-xs text-white/25 mt-1">Add one to stay focused on what's ahead.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
              {events.map((ev) => (
                <div key={ev.id} className={`group flex items-center justify-between rounded-md px-3 py-2 transition-colors ${getUrgencyClass(ev.event_date)}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{ev.event_name}</p>
                    <p className="text-xs text-white/40">{getDateLabel(ev.event_date)}{ev.event_date && !isToday(parseISO(ev.event_date)) ? ` · ${format(parseISO(ev.event_date), "EEEE")}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <button onClick={() => openEdit(ev)} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => setDeleteTarget(ev)} className="p-1 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-black border border-white/20 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">{editingEvent ? "Edit Event" : "Add Event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Event Name *</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Community Night" className="bg-white/5 border-white/20 text-white placeholder:text-white/30" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Event Date *</label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="bg-white/5 border-white/20 text-white" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Short Note</label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optional details…" rows={2} className="bg-white/5 border-white/20 text-white placeholder:text-white/30 min-h-0" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={closeModal} className="text-white/50 hover:text-white hover:bg-white/10">Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!formName.trim() || !formDate || saveMutation.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-medium">
              {saveMutation.isPending ? "Saving…" : "Save Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-black border border-white/20 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Event</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/60">Remove "{deleteTarget?.event_name}" from upcoming events?</p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="text-white/50 hover:text-white hover:bg-white/10">Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UpcomingEventsWidget;
