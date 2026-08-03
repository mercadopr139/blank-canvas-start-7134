import { useState, useRef, useEffect, useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { UserPlus, StickyNote, Truck, Trash2, X, Plus, Search, CheckCircle2, Lock, Unlock, Bus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ExcursionRideComparison from "@/components/admin/ExcursionRideComparison";

// Shared Excursion shape (used by the calendar, Excursion Intelligence, and this
// modal). Kept here so every consumer agrees on the fields.
export interface Excursion {
  id: string;
  date: string;
  name: string;
  youth_count: number;
  notes: string | null;
  details: string | null;
  created_at: string;
  roster_locked_at: string | null;
  arrived_at: string | null;
  returned_at: string | null;
  arrival_note: string | null;
  return_note: string | null;
  return_plan: string | null;
}

// Emoji palette for the Trip Overview / Debrief notepads — tap to insert.
const NOTE_EMOJIS = [
  "📍", "👤", "🗓️", "📦", "👍", "👎", "💡", "⭐",
  "✅", "⚠️", "❗", "🎉", "❤️", "🍽️", "🚐", "⛵",
  "⏰", "☀️", "🌧️", "💧", "📸", "😀", "😐", "🙁",
];

// Vehicle quick-add presets — mirror Coach Mode so admin backfills produce the
// same vehicle records as live trips.
const EDIT_VEHICLE_PRESETS: Array<{ name: string; seat_cap: number; icon: typeof Truck }> = [
  { name: "Van A", seat_cap: 14, icon: Truck },
  { name: "Van B", seat_cap: 14, icon: Truck },
  { name: "Mini-Van", seat_cap: 6, icon: Truck },
  { name: "Mini-Bus", seat_cap: 21, icon: Bus },
];

interface Props {
  /** The excursion being edited; null closes the modal. Controlled by the host. */
  excursion: Excursion | null;
  /** Local field edits (name/notes/times…) — host holds the draft object. */
  onChange: (next: Excursion) => void;
  /** Close the modal. */
  onClose: () => void;
  /** Called after any persisted change so the host can refresh its own views. */
  onSaved?: () => void;
  /** Delete is host-owned (confirmation dialog + impact counts live there). */
  onRequestDelete?: (ex: Excursion) => void;
}

/**
 * The full Edit Excursion editor — name, times, overview/debrief notepads, and
 * the interactive Ride-to-Excursion vehicle/youth/personnel roster (admin
 * backfill via the admin_* RPCs). Extracted from AdminAttendance so the exact
 * same editor opens from Excursion Intelligence too; both read/write the same
 * records, so an edit in one place shows in the other.
 */
const EditExcursionModal = ({ excursion, onChange, onClose, onSaved, onRequestDelete }: Props) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Aliases so the extracted JSX + handlers read as they did on the page.
  const editingExcursion = excursion;
  const setEditingExcursion = (next: Excursion | null) => { if (next) onChange(next); else onClose(); };
  const editingExcursionId = excursion?.id ?? null;

  // ── Interactive controls state ──
  const [editAddingVehicle, setEditAddingVehicle] = useState<{ name: string; seat_cap: number; isCustom: boolean } | null>(null);
  const [editDriverNameInput, setEditDriverNameInput] = useState("");
  const [editCustomNameInput, setEditCustomNameInput] = useState("");
  const [editCustomSeatInput, setEditCustomSeatInput] = useState("");
  const [editSavingVehicle, setEditSavingVehicle] = useState(false);
  const [editPersonnelInput, setEditPersonnelInput] = useState("");
  const [editSavingPersonnel, setEditSavingPersonnel] = useState(false);
  const [editYouthSearch, setEditYouthSearch] = useState("");
  const [editYouthResults, setEditYouthResults] = useState<Array<{
    id: string;
    child_first_name: string;
    child_last_name: string;
    child_boxing_program: string;
    child_headshot_url: string | null;
  }>>([]);
  const [editYouthSearching, setEditYouthSearching] = useState(false);

  const detailsRef = useRef<HTMLTextAreaElement>(null);
  const debriefRef = useRef<HTMLTextAreaElement>(null);

  // ── Roster / vehicles / personnel for the trip (same Coach-Mode RPCs) ──
  const { data: editingRosterYouth = [] } = useQuery({
    queryKey: ["admin-edit-excursion-roster-youth", editingExcursionId],
    enabled: !!editingExcursionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_excursion_roster_youth", { _excursion_id: editingExcursionId! });
      if (error) throw error;
      return data as Array<{
        registration_id: string;
        child_first_name: string;
        child_last_name: string;
        child_boxing_program: string;
        child_headshot_url: string | null;
        vehicle_id: string | null;
        return_vehicle_id: string | null;
      }>;
    },
  });
  const { data: editingVehicles = [] } = useQuery({
    queryKey: ["admin-edit-excursion-vehicles", editingExcursionId],
    enabled: !!editingExcursionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_excursion_vehicles", { _excursion_id: editingExcursionId! });
      if (error) throw error;
      return data as Array<{ id: string; name: string; seat_cap: number; driver_name: string; assigned_count: number }>;
    },
  });
  const { data: editingPersonnel = [] } = useQuery({
    queryKey: ["admin-edit-excursion-personnel", editingExcursionId],
    enabled: !!editingExcursionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_excursion_personnel", { _excursion_id: editingExcursionId! });
      if (error) throw error;
      return data as Array<{ id: string; name: string; vehicle_id: string | null; return_vehicle_id: string | null; created_at: string }>;
    },
  });

  const saveEditExcursion = async () => {
    if (!editingExcursion) return;
    const { error } = await supabase.from("excursions").update({
      name: editingExcursion.name,
      notes: editingExcursion.notes,
      details: editingExcursion.details,
      arrived_at: editingExcursion.arrived_at,
      returned_at: editingExcursion.returned_at,
      arrival_note: editingExcursion.arrival_note,
      return_note: editingExcursion.return_note,
    }).eq("id", editingExcursion.id);
    if (error) { toast.error("Failed to update excursion"); return; }
    onSaved?.();
    onClose();
    toast.success("Excursion updated");
  };

  // Autosave a notepad field on blur; drop a lone empty bullet.
  const saveExcursionFieldNow = async (field: "notes" | "details") => {
    if (!editingExcursion) return;
    const raw = (editingExcursion[field] || "").trim();
    const finalVal = raw === "" || raw === "•" ? null : editingExcursion[field];
    const { error } = await supabase.from("excursions").update({ [field]: finalVal }).eq("id", editingExcursion.id);
    if (!error) onSaved?.();
  };

  // Insert an emoji at the cursor (or end) of a notepad.
  const insertNoteEmoji = (field: "notes" | "details", ref: { current: HTMLTextAreaElement | null }, emoji: string) => {
    if (!editingExcursion) return;
    const ta = ref.current;
    if (!ta) {
      setEditingExcursion({ ...editingExcursion, [field]: (editingExcursion[field] || "") + emoji });
      return;
    }
    const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    setEditingExcursion({ ...editingExcursion, [field]: v.slice(0, s) + emoji + v.slice(e) });
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + emoji.length; });
  };

  // Enter → new bullet; Tab / Shift+Tab → indent / outdent.
  const noteKeyDown = (field: "notes" | "details") => (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (!editingExcursion) return;
    const ta = e.currentTarget;
    const s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const insert = "\n• ";
      setEditingExcursion({ ...editingExcursion, [field]: v.slice(0, s) + insert + v.slice(en) });
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + insert.length; });
    } else if (e.key === "Tab") {
      e.preventDefault();
      const lineStart = v.lastIndexOf("\n", s - 1) + 1;
      if (e.shiftKey) {
        if (v.slice(lineStart, lineStart + 2) === "  ") {
          setEditingExcursion({ ...editingExcursion, [field]: v.slice(0, lineStart) + v.slice(lineStart + 2) });
          requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = Math.max(lineStart, s - 2); });
        }
      } else {
        setEditingExcursion({ ...editingExcursion, [field]: v.slice(0, lineStart) + "  " + v.slice(lineStart) });
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
      }
    }
  };

  const toggleExcursionLock = async () => {
    if (!editingExcursion) return;
    if (editingExcursion.roster_locked_at) {
      const { error } = await supabase.rpc("unlock_excursion_roster", { _excursion_id: editingExcursion.id });
      if (error) { toast.error(error.message || "Failed to unlock roster"); return; }
      setEditingExcursion({ ...editingExcursion, roster_locked_at: null });
      toast.success("Roster unlocked — edits allowed again.");
    } else {
      const { data, error } = await supabase.rpc("lock_excursion_roster", { _excursion_id: editingExcursion.id });
      if (error) { toast.error(error.message || "Failed to submit roster"); return; }
      setEditingExcursion({ ...editingExcursion, roster_locked_at: (data as string) || new Date().toISOString() });
      toast.success("Excursion roster submitted (locked).");
    }
    onSaved?.();
  };

  const isoToLocalInput = (iso: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const localInputToIso = (local: string): string | null => {
    if (!local) return null;
    return new Date(local).toISOString();
  };

  // Reset transient inputs whenever the modal closes or switches trips.
  useEffect(() => {
    setEditAddingVehicle(null);
    setEditDriverNameInput("");
    setEditCustomNameInput("");
    setEditCustomSeatInput("");
    setEditPersonnelInput("");
    setEditYouthSearch("");
    setEditYouthResults([]);
  }, [editingExcursionId]);

  // Debounced youth search for the "Add youth" field.
  useEffect(() => {
    if (!editingExcursionId) return;
    if (editYouthSearch.trim().length < 2) {
      setEditYouthResults([]);
      return;
    }
    setEditYouthSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_excursion_youth", { _search: editYouthSearch });
      setEditYouthResults((data as Array<{
        id: string;
        child_first_name: string;
        child_last_name: string;
        child_boxing_program: string;
        child_headshot_url: string | null;
      }>) || []);
      setEditYouthSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [editYouthSearch, editingExcursionId]);

  // Refresh the modal's own queries, then let the host refresh its views.
  const invalidateEditExcursionQueries = useCallback(() => {
    if (!editingExcursionId) return;
    queryClient.invalidateQueries({ queryKey: ["admin-edit-excursion-roster-youth", editingExcursionId] });
    queryClient.invalidateQueries({ queryKey: ["admin-edit-excursion-vehicles", editingExcursionId] });
    queryClient.invalidateQueries({ queryKey: ["admin-edit-excursion-personnel", editingExcursionId] });
    onSaved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingExcursionId, queryClient, onSaved]);

  const handleEditAddVehicle = async () => {
    if (!editingExcursionId || !editAddingVehicle) return;
    const name = editAddingVehicle.isCustom ? editCustomNameInput.trim() : editAddingVehicle.name;
    const seat_cap = editAddingVehicle.isCustom ? Number(editCustomSeatInput) : editAddingVehicle.seat_cap;
    const driver = editDriverNameInput.trim();
    if (!name) return toast.error("Vehicle name is required.");
    if (!seat_cap || seat_cap <= 0) return toast.error("Seat capacity must be at least 1.");
    if (!driver) return toast.error("Driver name is required.");
    setEditSavingVehicle(true);
    const { error } = await supabase.rpc("admin_add_excursion_vehicle", {
      _excursion_id: editingExcursionId,
      _name: name,
      _seat_cap: seat_cap,
      _driver_name: driver,
    });
    setEditSavingVehicle(false);
    if (error) { toast.error(error.message || "Couldn't add vehicle."); return; }
    setEditAddingVehicle(null);
    setEditDriverNameInput("");
    setEditCustomNameInput("");
    setEditCustomSeatInput("");
    invalidateEditExcursionQueries();
  };

  const handleEditRemoveVehicle = async (vehicleId: string) => {
    const { error } = await supabase.rpc("admin_remove_excursion_vehicle", { _vehicle_id: vehicleId });
    if (error) { toast.error(error.message || "Couldn't remove vehicle."); return; }
    invalidateEditExcursionQueries();
  };

  const handleEditAssignYouth = async (registrationId: string, vehicleId: string) => {
    const { error } = await supabase.rpc("admin_assign_youth_to_vehicle", { _vehicle_id: vehicleId, _registration_id: registrationId });
    if (error) { toast.error(error.message || "Couldn't assign youth."); return; }
    invalidateEditExcursionQueries();
  };

  const handleEditUnassignYouth = async (registrationId: string) => {
    if (!editingExcursionId) return;
    const { error } = await supabase.rpc("admin_unassign_youth_from_vehicle", { _excursion_id: editingExcursionId, _registration_id: registrationId });
    if (error) { toast.error(error.message || "Couldn't unassign youth."); return; }
    invalidateEditExcursionQueries();
  };

  const handleEditAddPersonnel = async () => {
    if (!editingExcursionId || !editPersonnelInput.trim()) return;
    setEditSavingPersonnel(true);
    const { error } = await supabase.rpc("admin_add_excursion_personnel", { _excursion_id: editingExcursionId, _name: editPersonnelInput.trim() });
    setEditSavingPersonnel(false);
    if (error) { toast.error(error.message || "Couldn't add name."); return; }
    setEditPersonnelInput("");
    invalidateEditExcursionQueries();
  };

  const handleEditRemovePersonnel = async (personnelId: string) => {
    const { error } = await supabase.rpc("admin_remove_excursion_personnel", { _personnel_id: personnelId });
    if (error) { toast.error(error.message || "Couldn't remove name."); return; }
    invalidateEditExcursionQueries();
  };

  const handleEditAddYouth = async (registrationId: string) => {
    if (!editingExcursionId || !editingExcursion?.date) return;
    const { error } = await supabase.rpc("admin_record_excursion_attendance", {
      _excursion_id: editingExcursionId,
      _registration_id: registrationId,
      _check_in_date: editingExcursion.date,
    });
    if (error) { toast.error(error.message || "Couldn't add youth."); return; }
    toast.success("Youth added to the roster.");
    setEditYouthSearch("");
    setEditYouthResults([]);
    invalidateEditExcursionQueries();
  };

  return (
      <Dialog open={!!editingExcursion} onOpenChange={(open) => { if (!open) setEditingExcursion(null); }}>
        <DialogContent className="bg-neutral-800 border-purple-500/30 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-purple-400 flex items-center gap-2">🟣 Edit Excursion</DialogTitle>
          </DialogHeader>
          {editingExcursion && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Excursion Name *</label>
                <Input value={editingExcursion.name} onChange={(e) => setEditingExcursion({ ...editingExcursion, name: e.target.value })} className="bg-white/5 border-white/20 text-white" />
              </div>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 rounded-lg bg-purple-500/10 border border-purple-400/25 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-purple-200/70 font-semibold">Date</p>
                  <p className="text-sm font-bold text-white">
                    {editingExcursion.date ? format(parseISO(editingExcursion.date), "EEE, MMM d, yyyy") : "—"}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/admin/excursion-signups/${editingExcursion.id}`)}
                  className="flex items-center gap-2 px-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 transition-colors font-semibold text-sm flex-shrink-0"
                >
                  <UserPlus className="w-4 h-4" /> Sign-Ups
                </button>
              </div>
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2.5 text-center">
                    <p className="text-2xl font-black tabular-nums text-emerald-300">{editingRosterYouth.length}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mt-0.5">Youth</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2.5 text-center">
                    <p className="text-2xl font-black tabular-nums">{editingVehicles.length}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mt-0.5">Drivers</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2.5 text-center">
                    <p className="text-2xl font-black tabular-nums">{editingPersonnel.length}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mt-0.5">Volunteers</p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/40 px-3 py-2.5 text-center">
                    <p className="text-2xl font-black tabular-nums text-emerald-300">{editingRosterYouth.length + editingVehicles.length + editingPersonnel.length}</p>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-200/80 font-semibold mt-0.5">On Trip</p>
                  </div>
                </div>
                {editingExcursion.arrived_at && editingExcursion.returned_at && (() => {
                  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
                  const mins = Math.max(0, Math.round((new Date(editingExcursion.returned_at).getTime() - new Date(editingExcursion.arrived_at).getTime()) / 60000));
                  const h = Math.floor(mins / 60);
                  const m = mins % 60;
                  return (
                    <p className="text-[11px] text-white/50 text-center mt-2">
                      Arrived {fmt(editingExcursion.arrived_at)} · Back {fmt(editingExcursion.returned_at)} · {h > 0 ? `${h}h ` : ""}{m}m
                    </p>
                  );
                })()}
                <p className="text-[10px] text-white/30 mt-1.5 text-center">Live count of who actually went on the trip.</p>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5 text-purple-300" /> Trip Overview / Details
                </label>
                <div className="mb-1.5">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="text-xs px-2 py-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-white/70 transition-colors">
                        😀 Emoji
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 bg-neutral-900 border-white/15 p-2">
                      <div className="grid grid-cols-8 gap-0.5">
                        {NOTE_EMOJIS.map((em) => (
                          <button key={em} type="button" onClick={() => insertNoteEmoji("details", detailsRef, em)}
                            className="text-lg leading-none w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center">
                            {em}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <textarea
                  ref={detailsRef}
                  value={editingExcursion.details || ""}
                  onChange={(e) => setEditingExcursion({ ...editingExcursion, details: e.target.value || null })}
                  onFocus={() => { if (!editingExcursion.details) setEditingExcursion({ ...editingExcursion, details: "• " }); }}
                  onKeyDown={noteKeyDown("details")}
                  onBlur={() => saveExcursionFieldNow("details")}
                  rows={5}
                  placeholder={"The facts of the trip…\n• 📍 Location: Corinthian Yacht Club, Cape May\n• 👤 Contact: Sandra Baldino\n• 📦 Packing: towel, water shoes, rash guard"}
                  className="w-full bg-white/5 border border-white/20 rounded-md px-3 py-2 text-white text-sm leading-relaxed placeholder:text-white/25 resize-y focus:outline-none focus:border-purple-400/50"
                />
                <p className="text-[10px] text-white/30 mt-1">Autosaves · Enter = new bullet · Tab = indent (outline) · shows in Excursion History.</p>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5" /> Trip Debrief
                </label>
                <div className="mb-1.5">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="text-xs px-2 py-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-white/70 transition-colors">
                        😀 Emoji
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 bg-neutral-900 border-white/15 p-2">
                      <div className="grid grid-cols-8 gap-0.5">
                        {NOTE_EMOJIS.map((em) => (
                          <button key={em} type="button" onClick={() => insertNoteEmoji("notes", debriefRef, em)}
                            className="text-lg leading-none w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center">
                            {em}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <textarea
                  ref={debriefRef}
                  value={editingExcursion.notes || ""}
                  onChange={(e) => setEditingExcursion({ ...editingExcursion, notes: e.target.value || null })}
                  onFocus={() => { if (!editingExcursion.notes) setEditingExcursion({ ...editingExcursion, notes: "• " }); }}
                  onKeyDown={noteKeyDown("notes")}
                  onBlur={() => saveExcursionFieldNow("notes")}
                  rows={6}
                  placeholder={"Debrief while it's fresh…\n• 👍 Kids loved the sailing\n• 👎 Lunch ran late — pack earlier\n• 💡 Order dinner for after, not during"}
                  className="w-full bg-white/5 border border-white/20 rounded-md px-3 py-2 text-white text-sm leading-relaxed placeholder:text-white/25 resize-y focus:outline-none focus:border-purple-400/50"
                />
                <p className="text-[10px] text-white/30 mt-1">Autosaves · Enter = new bullet · Tab = indent · shows in Excursion History next year for planning.</p>
              </div>

              <div className="pt-3 mt-2 border-t border-white/10">
                <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">Ride to Excursion</p>

                {editingVehicles.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {editingVehicles.map((v) => {
                      const inThisVehicle = editingRosterYouth.filter((y) => y.vehicle_id === v.id);
                      const coachesInVehicle = editingPersonnel.filter((p) => p.vehicle_id === v.id);
                      return (
                        <div key={v.id} className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-purple-200 flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5" /> {v.name}
                              </p>
                              <p className="text-xs text-white/50 mt-0.5">
                                Driver: <span className="text-white/80 font-semibold">{v.driver_name}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-white/50 tabular-nums">
                                {v.assigned_count}/{v.seat_cap}
                              </span>
                              <button
                                onClick={() => handleEditRemoveVehicle(v.id)}
                                className="text-white/40 hover:text-red-400 transition"
                                title="Remove vehicle"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {inThisVehicle.length + coachesInVehicle.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {inThisVehicle.map((y) => (
                                <div
                                  key={y.registration_id}
                                  className="flex items-center gap-1.5 rounded-full bg-purple-500/10 border border-purple-400/30 pl-2 pr-1 py-0.5"
                                >
                                  <span className="text-xs font-semibold text-purple-100">
                                    {y.child_first_name} {y.child_last_name}
                                  </span>
                                  <button
                                    onClick={() => handleEditUnassignYouth(y.registration_id)}
                                    className="w-4 h-4 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white"
                                    aria-label="Unassign"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              {coachesInVehicle.map((p) => (
                                <div
                                  key={p.id}
                                  className="flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-400/25 pl-2 pr-1 py-0.5"
                                >
                                  <span className="text-xs font-semibold text-sky-100">{p.name}</span>
                                  <span className="text-[8px] uppercase tracking-wider text-sky-300/90 font-bold">Coach/Volunteer</span>
                                  <button
                                    onClick={() => handleEditRemovePersonnel(p.id)}
                                    className="w-4 h-4 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white"
                                    title="Remove from trip"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-white/30 italic">No one assigned to this vehicle.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {editingPersonnel.some((p) => !p.vehicle_id) && (
                  <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3 mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-2">Drove Separately</p>
                    <div className="flex flex-wrap gap-1.5">
                      {editingPersonnel.filter((p) => !p.vehicle_id).map((p) => (
                        <div key={p.id} className="flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-400/25 pl-2 pr-1 py-0.5">
                          <span className="text-xs font-semibold text-sky-100">{p.name}</span>
                          <span className="text-[8px] uppercase tracking-wider text-sky-300/90 font-bold">Coach/Volunteer</span>
                          <button onClick={() => handleEditRemovePersonnel(p.id)} className="w-4 h-4 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white" title="Remove from trip"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(() => {
                  const unassigned = editingRosterYouth.filter((y) => !y.vehicle_id);
                  if (unassigned.length === 0) return null;
                  return (
                    <div className="rounded-lg bg-yellow-500/[0.05] border border-yellow-400/20 p-3 mb-3">
                      <p className="text-xs font-bold text-yellow-200/80 mb-2">
                        Youth not assigned to any vehicle ({unassigned.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {unassigned.map((y) => (
                          <Popover key={y.registration_id}>
                            <PopoverTrigger asChild disabled={editingVehicles.length === 0}>
                              <button
                                disabled={editingVehicles.length === 0}
                                className="group flex items-center gap-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-2 py-0.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span className="text-xs font-semibold text-white/80">
                                  {y.child_first_name} {y.child_last_name}
                                </span>
                                <Plus className="w-3 h-3 text-purple-300" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 bg-neutral-900 border-white/10 text-white p-2">
                              <p className="text-[10px] text-white/50 px-2 py-1 font-semibold uppercase tracking-wider">
                                Assign to vehicle
                              </p>
                              <div className="space-y-0.5">
                                {editingVehicles.map((v) => {
                                  const full = v.assigned_count >= v.seat_cap;
                                  return (
                                    <button
                                      key={v.id}
                                      disabled={full}
                                      onClick={() => handleEditAssignYouth(y.registration_id, v.id)}
                                      className="w-full text-left flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      <span className="font-semibold text-xs">{v.name}</span>
                                      <span className="text-[10px] text-white/50 tabular-nums">
                                        {v.assigned_count}/{v.seat_cap}{full ? " full" : ""}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ))}
                      </div>
                      {editingVehicles.length === 0 && (
                        <p className="text-[10px] text-yellow-200/60 mt-2">
                          Add a vehicle below to start assigning seats.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {!editAddingVehicle && (
                  <div className="rounded-lg bg-white/[0.02] border border-white/10 p-3 mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-2">
                      Add a Vehicle
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
                      {EDIT_VEHICLE_PRESETS.map((p) => {
                        const Icon = p.icon;
                        return (
                          <button
                            key={p.name}
                            onClick={() => {
                              setEditAddingVehicle({ name: p.name, seat_cap: p.seat_cap, isCustom: false });
                              setEditDriverNameInput("");
                            }}
                            className="flex flex-col items-center justify-center gap-1 rounded-md bg-white/[0.04] hover:bg-purple-500/10 hover:border-purple-400/40 border border-white/10 p-2 transition"
                          >
                            <Icon className="w-4 h-4 text-purple-300" />
                            <span className="text-[11px] font-bold leading-none">{p.name}</span>
                            <span className="text-[10px] text-white/50">{p.seat_cap} seats</span>
                          </button>
                        );
                      })}
                      <button
                        onClick={() => {
                          setEditAddingVehicle({ name: "", seat_cap: 0, isCustom: true });
                          setEditCustomNameInput("");
                          setEditCustomSeatInput("");
                          setEditDriverNameInput("");
                        }}
                        className="flex flex-col items-center justify-center gap-1 rounded-md bg-white/[0.04] hover:bg-purple-500/10 hover:border-purple-400/40 border border-dashed border-white/20 p-2 transition"
                      >
                        <Plus className="w-4 h-4 text-purple-300" />
                        <span className="text-[11px] font-bold leading-none">Other</span>
                        <span className="text-[10px] text-white/50">Custom</span>
                      </button>
                    </div>
                  </div>
                )}

                {editAddingVehicle && (
                  <div className="rounded-lg bg-purple-500/[0.06] border border-purple-400/30 p-3 mb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-purple-200">
                        New Vehicle{editAddingVehicle.isCustom ? " — Custom" : ""}
                      </p>
                      <button
                        onClick={() => setEditAddingVehicle(null)}
                        className="text-white/40 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {editAddingVehicle.isCustom ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={editCustomNameInput}
                          onChange={(e) => setEditCustomNameInput(e.target.value)}
                          placeholder="Vehicle name"
                          className="bg-white/5 border-white/15 text-white text-xs h-8"
                        />
                        <Input
                          type="number"
                          min={1}
                          value={editCustomSeatInput}
                          onChange={(e) => setEditCustomSeatInput(e.target.value)}
                          placeholder="Seats (excl. driver)"
                          className="bg-white/5 border-white/15 text-white text-xs h-8"
                        />
                      </div>
                    ) : (
                      <p className="text-sm font-semibold">
                        {editAddingVehicle.name}{" "}
                        <span className="text-white/50 text-xs font-normal">• {editAddingVehicle.seat_cap} seats</span>
                      </p>
                    )}
                    <Input
                      value={editDriverNameInput}
                      onChange={(e) => setEditDriverNameInput(e.target.value)}
                      placeholder="Driver name"
                      className="bg-white/5 border-white/15 text-white text-xs h-8"
                    />
                    <Button
                      size="sm"
                      onClick={handleEditAddVehicle}
                      disabled={editSavingVehicle}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-8 text-xs"
                    >
                      {editSavingVehicle ? "Adding…" : "Add Vehicle"}
                    </Button>
                  </div>
                )}

                <div className="rounded-lg bg-white/[0.02] border border-white/10 p-3 mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-2 flex items-center gap-1.5">
                    <UserPlus className="w-3 h-3" /> Add Youth to Roster
                  </p>
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                    <Input
                      value={editYouthSearch}
                      onChange={(e) => setEditYouthSearch(e.target.value)}
                      placeholder="Type a name to search…"
                      className="pl-7 bg-white/5 border-white/15 text-white text-xs h-8"
                    />
                  </div>
                  {editYouthSearching && (
                    <p className="text-[11px] text-white/40">Searching…</p>
                  )}
                  {!editYouthSearching && editYouthSearch.trim().length >= 2 && editYouthResults.length === 0 && (
                    <p className="text-[11px] text-white/40">No youth found.</p>
                  )}
                  {editYouthResults.length > 0 && (
                    <div className="space-y-1">
                      {editYouthResults.map((r) => {
                        const alreadyIn = editingRosterYouth.some((y) => y.registration_id === r.id);
                        return (
                          <div
                            key={r.id}
                            className="flex items-center gap-2 rounded-md bg-white/[0.04] border border-white/10 px-2 py-1.5"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate">
                                {r.child_first_name} {r.child_last_name}
                              </p>
                              <p className="text-[10px] text-white/40 truncate">{r.child_boxing_program}</p>
                            </div>
                            {alreadyIn ? (
                              <span className="text-[10px] text-emerald-300 font-semibold flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" /> On roster
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleEditAddYouth(r.id)}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-7 text-[11px] px-2"
                              >
                                <Plus className="w-3 h-3 mr-0.5" /> Add
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-3 mt-2 border-t border-white/10">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">Ride There vs Ride Home</p>
                  {!editingExcursion.return_plan ? (
                    <p className="text-sm text-white/30 italic">No separate ride-home log was recorded for this trip.</p>
                  ) : editingRosterYouth.length === 0 ? (
                    <p className="text-sm text-white/30 italic">No youth on this trip.</p>
                  ) : (
                    <ExcursionRideComparison
                      vehicles={editingVehicles}
                      youth={editingRosterYouth}
                      personnel={editingPersonnel}
                      returnPlan={editingExcursion.return_plan}
                    />
                  )}
                </div>

                <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-2">
                    Add Coach / Volunteer
                  </p>
                  <div className="flex gap-1.5">
                    <Input
                      value={editPersonnelInput}
                      onChange={(e) => setEditPersonnelInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleEditAddPersonnel(); }}
                      placeholder="Add a name and press Enter"
                      className="bg-white/5 border-white/15 text-white text-xs h-8"
                    />
                    <Button
                      size="sm"
                      onClick={handleEditAddPersonnel}
                      disabled={editSavingPersonnel || !editPersonnelInput.trim()}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-8 text-xs px-2"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <p className="text-[10px] text-white/30 mt-2">
                  All changes save instantly. As admin you can edit any trip — past, locked, or closed — and backfilled youth get stamped to the trip's actual date.
                </p>
              </div>

              <div className="pt-3 mt-2 border-t border-white/10">
                <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Trip Timeline</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs min-w-0">
                      <span className="text-white/60">Roster: </span>
                      {editingExcursion.roster_locked_at ? (
                        <span className="text-emerald-300 font-semibold tabular-nums">
                          Submitted · {new Date(editingExcursion.roster_locked_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      ) : (
                        <span className="text-white/50">Not submitted</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`shrink-0 ${editingExcursion.roster_locked_at
                        ? "border-white/20 bg-transparent text-white/80 hover:bg-white/10 hover:text-white"
                        : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"}`}
                      onClick={toggleExcursionLock}
                    >
                      {editingExcursion.roster_locked_at ? (
                        <><Unlock className="w-3.5 h-3.5 mr-1.5" /> Unlock</>
                      ) : (
                        <><Lock className="w-3.5 h-3.5 mr-1.5" /> Submit Excursion Roster</>
                      )}
                    </Button>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Arrived at destination</label>
                    <div className="flex gap-2">
                      <Input
                        type="datetime-local"
                        value={isoToLocalInput(editingExcursion.arrived_at)}
                        onChange={(e) => setEditingExcursion({ ...editingExcursion, arrived_at: localInputToIso(e.target.value) })}
                        className="bg-white/5 border-white/20 text-white"
                      />
                      {editingExcursion.arrived_at && (
                        <Button
                          variant="outline" size="sm"
                          className="border-white/20 bg-transparent text-white/70 hover:bg-white/10 hover:text-white shrink-0"
                          onClick={() => setEditingExcursion({ ...editingExcursion, arrived_at: null, arrival_note: null })}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                  {editingExcursion.arrived_at && (
                    <Input
                      placeholder="Arrival note (optional)"
                      value={editingExcursion.arrival_note || ""}
                      onChange={(e) => setEditingExcursion({ ...editingExcursion, arrival_note: e.target.value || null })}
                      className="bg-white/5 border-white/20 text-white text-xs"
                    />
                  )}
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Returned & closed</label>
                    <div className="flex gap-2">
                      <Input
                        type="datetime-local"
                        value={isoToLocalInput(editingExcursion.returned_at)}
                        onChange={(e) => setEditingExcursion({ ...editingExcursion, returned_at: localInputToIso(e.target.value) })}
                        className="bg-white/5 border-white/20 text-white"
                      />
                      {editingExcursion.returned_at && (
                        <Button
                          variant="outline" size="sm"
                          className="border-white/20 bg-transparent text-white/70 hover:bg-white/10 hover:text-white shrink-0"
                          onClick={() => setEditingExcursion({ ...editingExcursion, returned_at: null, return_note: null })}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                  {editingExcursion.returned_at && (
                    <Input
                      placeholder="Return note (optional)"
                      value={editingExcursion.return_note || ""}
                      onChange={(e) => setEditingExcursion({ ...editingExcursion, return_note: e.target.value || null })}
                      className="bg-white/5 border-white/20 text-white text-xs"
                    />
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-between pt-3 mt-2 border-t border-white/10">
                {onRequestDelete ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500/40 bg-red-500/5 text-red-300 hover:bg-red-500/15 hover:text-red-200"
                    onClick={() => onRequestDelete(editingExcursion)}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" /> Delete Excursion
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="border-white/20 bg-transparent text-white hover:bg-white/10" onClick={() => setEditingExcursion(null)}>Cancel</Button>
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={saveEditExcursion}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
  );
};

export default EditExcursionModal;
