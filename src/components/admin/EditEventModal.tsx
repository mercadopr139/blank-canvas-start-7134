import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CalendarDays, Loader2, Save, StickyNote, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

/* Shared shape for a program event. `id === ""` means an unsaved new event. */
export interface ProgramEvent {
  id: string;
  date: string;
  name: string;
  details: string | null; // "Overview" — seeds the grant narrative
  notes: string | null; // optional debrief
  count_attendance: boolean;
}

/* A brand-new (unsaved) event skeleton for a given day. */
export const newEventForDate = (date: string): ProgramEvent => ({
  id: "",
  date,
  name: "",
  details: null,
  notes: null,
  count_attendance: false,
});

interface Props {
  /** The event being added/edited, or null when the modal is closed. */
  event: ProgramEvent | null;
  onClose: () => void;
  onSaved: () => void;
  onRequestDelete: (event: ProgramEvent) => void;
}

// Tap-to-insert emoji for the notepads — mirrors the excursion editor so the
// two feel like the same tool.
const NOTE_EMOJI = ["🥊", "🏦", "⭐", "🎉", "🙌", "📚", "❤️", "✅"];

const EditEventModal = ({ event, onClose, onSaved, onRequestDelete }: Props) => {
  const [draft, setDraft] = useState<ProgramEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const detailsRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Reset the local draft whenever a different event is opened.
  useEffect(() => {
    setDraft(event ? { ...event } : null);
  }, [event]);

  if (!draft) return null;
  const isNew = draft.id === "";

  const insertEmoji = (field: "details" | "notes", ref: { current: HTMLTextAreaElement | null }, emoji: string) => {
    const el = ref.current;
    const current = draft[field] || "";
    if (!el) { setDraft({ ...draft, [field]: current + emoji }); return; }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + emoji + current.slice(end);
    setDraft({ ...draft, [field]: next });
    // Restore focus + caret just after the inserted emoji.
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + emoji.length; });
  };

  // Auto-start a bullet list, like the excursion notepads.
  const noteKeyDown = (field: "details" | "notes") => (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const el = e.currentTarget;
      const val = draft[field] || "";
      const pos = el.selectionStart ?? val.length;
      const next = val.slice(0, pos) + "\n• " + val.slice(pos);
      setDraft({ ...draft, [field]: next });
      requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = pos + 3; });
    }
  };

  const save = async () => {
    if (!draft.name.trim()) { toast.error("Please give the event a name"); return; }
    setSaving(true);
    const payload = {
      date: draft.date,
      name: draft.name.trim(),
      details: draft.details?.trim() || null,
      notes: draft.notes?.trim() || null,
      count_attendance: draft.count_attendance,
    };
    const query = isNew
      ? supabase.from("program_events" as never).insert(payload as never)
      : supabase.from("program_events" as never).update(payload as never).eq("id", draft.id);
    const { error } = await query;
    setSaving(false);
    if (error) { toast.error("Failed to save event: " + error.message); return; }
    toast.success(isNew ? "Event added" : "Event saved");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={!!event} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            {isNew ? "Add Event" : "Edit Event"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <CalendarDays className="w-3.5 h-3.5" />
            {format(parseISO(draft.date), "EEEE, MMMM d, yyyy")}
          </div>

          <div>
            <Label className="text-white/70">Event name</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Banking & Boxing"
              autoFocus
              className="mt-1 bg-white/5 border-white/15 text-white placeholder:text-white/30"
            />
          </div>

          {/* Overview — the few words that seed the grant narrative. */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="flex items-center gap-1.5 text-white/70">
                <StickyNote className="w-3.5 h-3.5 text-yellow-300" /> Overview
              </Label>
              <div className="flex gap-1">
                {NOTE_EMOJI.map((em) => (
                  <button key={em} type="button" onClick={() => insertEmoji("details", detailsRef, em)}
                    className="text-sm hover:scale-125 transition-transform">{em}</button>
                ))}
              </div>
            </div>
            <Textarea
              ref={detailsRef}
              value={draft.details || ""}
              onChange={(e) => setDraft({ ...draft, details: e.target.value || null })}
              onFocus={() => { if (!draft.details) setDraft({ ...draft, details: "• " }); }}
              onKeyDown={noteKeyDown("details")}
              rows={4}
              placeholder="A few words about the event — what it was, who it reached. This seeds the Program Highlights write-up."
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 min-h-[96px]"
            />
          </div>

          {/* Debrief — optional, how it went. */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="flex items-center gap-1.5 text-white/70">
                <StickyNote className="w-3.5 h-3.5 text-white/40" /> Debrief <span className="text-white/30 font-normal">(optional)</span>
              </Label>
              <div className="flex gap-1">
                {NOTE_EMOJI.map((em) => (
                  <button key={em} type="button" onClick={() => insertEmoji("notes", notesRef, em)}
                    className="text-sm hover:scale-125 transition-transform">{em}</button>
                ))}
              </div>
            </div>
            <Textarea
              ref={notesRef}
              value={draft.notes || ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })}
              onFocus={() => { if (!draft.notes) setDraft({ ...draft, notes: "• " }); }}
              onKeyDown={noteKeyDown("notes")}
              rows={3}
              placeholder="How did it go? Anything to remember for next year."
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30 min-h-[72px]"
            />
          </div>

          {/* The situational switch: does this event feed attendance numbers? */}
          <div className="flex items-start justify-between gap-3 rounded-lg border border-yellow-500/25 bg-yellow-500/[0.06] px-3 py-3">
            <div>
              <p className="text-sm font-medium text-yellow-200">Count attendance for this event</p>
              <p className="text-xs text-white/50 mt-0.5">
                On = youth who check in at this event count toward your attendance numbers. Off = narrative only.
              </p>
            </div>
            <Switch
              checked={draft.count_attendance}
              onCheckedChange={(v) => setDraft({ ...draft, count_attendance: v })}
              className="mt-0.5 data-[state=checked]:bg-yellow-500"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
            {!isNew ? (
              <Button
                variant="ghost"
                onClick={() => onRequestDelete(draft)}
                className="text-red-400/80 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-1.5" /> Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="border-white/15 bg-transparent text-white/80 hover:bg-white/5">
                Cancel
              </Button>
              <Button onClick={save} disabled={saving} className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold">
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                {isNew ? "Add Event" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditEventModal;
