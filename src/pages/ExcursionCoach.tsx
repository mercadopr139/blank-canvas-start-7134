import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bus,
  CalendarX,
  CheckCircle2,
  Flag,
  Home,
  KeyRound,
  Lock,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  Unlock,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import nlaLogo from "@/assets/nla-logo-white.png";
import ExcursionRideComparison from "@/components/admin/ExcursionRideComparison";

const getHeadshotUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/youth-photos/${url}`;
};

interface TodaysExcursion {
  id: string;
  date: string;
  name: string;
  notes: string | null;
  youth_count: number;
  transportation_required: boolean | null;
  roster_locked_at: string | null;
  arrived_at: string | null;
  returned_at: string | null;
  arrival_note: string | null;
  return_note: string | null;
  return_plan: string | null;
}

interface RosterYouth {
  registration_id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string;
  child_headshot_url: string | null;
  vehicle_id: string | null;
  return_vehicle_id: string | null;
}

interface Vehicle {
  id: string;
  name: string;
  seat_cap: number;
  driver_name: string;
  assigned_count: number;
}

interface Personnel {
  id: string;
  name: string;
  vehicle_id: string | null;
  created_at: string;
}

interface SearchResultYouth {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string;
  child_headshot_url: string | null;
}

const COACH_PIN = "1086";
const PIN_SESSION_KEY = "nla_coach_pin_ok";

const VEHICLE_PRESETS: { name: string; seat_cap: number; icon: typeof Truck }[] = [
  { name: "Van A", seat_cap: 14, icon: Truck },
  { name: "Van B", seat_cap: 14, icon: Truck },
  { name: "Mini-Van", seat_cap: 6, icon: Truck },
  { name: "Mini-Bus", seat_cap: 21, icon: Bus },
];

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// A coach/volunteer chip. When editable and the trip has vehicles, it shows a
// selector to place them in a van (counts toward that van's seats) or leave
// them "driving separately".
const PersonnelChip = ({
  p,
  vehicles,
  editable,
  showVehicle,
  onSetVehicle,
  onRemove,
}: {
  p: Personnel;
  vehicles: Vehicle[];
  editable: boolean;
  showVehicle: boolean;
  onSetVehicle: (vehicleId: string | null) => void;
  onRemove: () => void;
}) => {
  const van = vehicles.find((v) => v.id === p.vehicle_id);
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 pl-3 pr-1 py-1">
      <span className="text-sm font-semibold">{p.name}</span>
      {showVehicle && editable ? (
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-[11px] font-medium text-purple-200/90 hover:text-white inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 bg-purple-500/10 border border-purple-400/25">
              {van ? van.name : "Driving separately"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 bg-neutral-900 border-white/10 text-white p-2 z-[60]">
            <p className="text-[10px] text-white/50 px-2 py-1 font-semibold uppercase tracking-wider">Rides in</p>
            <div className="space-y-1">
              {vehicles.map((v) => {
                const full = v.assigned_count >= v.seat_cap && p.vehicle_id !== v.id;
                return (
                  <button
                    key={v.id}
                    disabled={full}
                    onClick={() => onSetVehicle(v.id)}
                    className="w-full text-left flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-white/10 text-sm disabled:opacity-40"
                  >
                    <span className="font-semibold">{v.name}</span>
                    <span className="text-xs text-white/50 tabular-nums">{v.assigned_count}/{v.seat_cap}{full ? " full" : ""}</span>
                  </button>
                );
              })}
              <button onClick={() => onSetVehicle(null)} className="w-full text-left rounded-md px-2 py-1.5 hover:bg-white/10 text-sm text-white/70">
                Driving separately
              </button>
            </div>
          </PopoverContent>
        </Popover>
      ) : showVehicle ? (
        <span className="text-[11px] text-white/50">· {van ? van.name : "separate"}</span>
      ) : null}
      {editable && (
        <button
          onClick={onRemove}
          className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white"
          aria-label="Remove"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

const ExcursionCoach = () => {
  const navigate = useNavigate();
  const [excursion, setExcursion] = useState<TodaysExcursion | null>(null);
  const [excursionLoaded, setExcursionLoaded] = useState(false);
  const [youth, setYouth] = useState<RosterYouth[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);

  // Add-vehicle form state
  const [addingVehicle, setAddingVehicle] = useState<{
    name: string;
    seat_cap: number;
    isCustom: boolean;
  } | null>(null);
  const [driverNameInput, setDriverNameInput] = useState("");
  const [customNameInput, setCustomNameInput] = useState("");
  const [customSeatInput, setCustomSeatInput] = useState("");
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Personnel form
  const [personnelInput, setPersonnelInput] = useState("");
  const [savingPersonnel, setSavingPersonnel] = useState(false);

  // Submit / unlock confirms
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [confirmRemoveVehicle, setConfirmRemoveVehicle] = useState<Vehicle | null>(null);
  const [confirmClearTransport, setConfirmClearTransport] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // PIN gate
  const [pinVerified, setPinVerified] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(PIN_SESSION_KEY) === "1";
  });
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  // Manual refresh / late arrival
  const [refreshing, setRefreshing] = useState(false);
  const [lateSearch, setLateSearch] = useState("");
  const [lateResults, setLateResults] = useState<SearchResultYouth[]>([]);
  const [lateSearching, setLateSearching] = useState(false);
  const [pendingLate, setPendingLate] = useState<SearchResultYouth | null>(null);

  // Phase 3 — arrival / return / timestamp edit
  const [confirmArrivalOpen, setConfirmArrivalOpen] = useState(false);
  // Ride-home choice pops up right after arrival is confirmed.
  const [rideHomeChoiceOpen, setRideHomeChoiceOpen] = useState(false);
  // After adding a coach/volunteer, ask which vehicle they're riding in.
  const [pendingPersonnel, setPendingPersonnel] = useState<{ id: string; name: string } | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [arrivalNoteMode, setArrivalNoteMode] = useState(false);
  const [closeNoteMode, setCloseNoteMode] = useState(false);
  const [arrivalNoteInput, setArrivalNoteInput] = useState("");
  const [closeNoteInput, setCloseNoteInput] = useState("");
  const [editingTimestamp, setEditingTimestamp] = useState<"arrived" | "returned" | null>(null);
  const [timestampEditValue, setTimestampEditValue] = useState("");
  const [savingTimestamp, setSavingTimestamp] = useState(false);

  // ───── Guided setup wizard ─────
  // A step-by-step pop-up that walks a coach through setup after PIN entry,
  // so they never have to figure out what to do first on the busy page. It
  // reuses every existing handler/state below — it only reorganizes the setup
  // flow, it doesn't change any data path.
  const [wizardStepKey, setWizardStepKey] = useState<string>("transport");
  const [wizardOpen, setWizardOpen] = useState(false);

  const loadExcursion = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_todays_excursion");
    if (error) {
      console.error("Failed to load Excursion:", error);
      setExcursionLoaded(true);
      return;
    }
    setExcursion((data as TodaysExcursion[] | null)?.[0] ?? null);
    setExcursionLoaded(true);
  }, []);

  useEffect(() => {
    loadExcursion();
  }, [loadExcursion]);

  const loadRoster = useCallback(async (excursionId: string) => {
    const [youthRes, vehiclesRes, personnelRes] = await Promise.all([
      supabase.rpc("get_excursion_roster_youth", { _excursion_id: excursionId }),
      supabase.rpc("get_excursion_vehicles", { _excursion_id: excursionId }),
      supabase.rpc("get_excursion_personnel", { _excursion_id: excursionId }),
    ]);
    if (youthRes.data) setYouth(youthRes.data as RosterYouth[]);
    if (vehiclesRes.data) setVehicles(vehiclesRes.data as Vehicle[]);
    if (personnelRes.data) setPersonnel(personnelRes.data as Personnel[]);
  }, []);

  useEffect(() => {
    if (excursion?.id) loadRoster(excursion.id);
  }, [excursion?.id, loadRoster]);

  // Refresh when tab regains focus (iPad/phone sync)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && excursion?.id) {
        loadRoster(excursion.id);
        loadExcursion();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [excursion?.id, loadRoster, loadExcursion]);

  // Auto-poll every 30s while page is open (so late kiosk check-ins
  // appear without Chrissy needing to switch tabs).
  useEffect(() => {
    if (!excursion?.id || !pinVerified) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadRoster(excursion.id);
        loadExcursion();
      }
    }, 30000);
    return () => clearInterval(t);
  }, [excursion?.id, pinVerified, loadRoster, loadExcursion]);

  // Debounced search for late arrivals
  useEffect(() => {
    if (lateSearch.trim().length < 2) {
      setLateResults([]);
      return;
    }
    setLateSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_excursion_youth", {
        _search: lateSearch,
      });
      setLateResults((data as SearchResultYouth[]) || []);
      setLateSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [lateSearch]);

  const handleManualRefresh = async () => {
    if (!excursion?.id) return;
    setRefreshing(true);
    await Promise.all([loadRoster(excursion.id), loadExcursion()]);
    setTimeout(() => setRefreshing(false), 400);
  };

  const handleVerifyPin = () => {
    if (pinInput === COACH_PIN) {
      sessionStorage.setItem(PIN_SESSION_KEY, "1");
      setPinVerified(true);
      setPinError(false);
      setPinInput("");
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  const isLocked = !!excursion?.roster_locked_at;
  const isArrived = !!excursion?.arrived_at;
  const isClosed = !!excursion?.returned_at;
  const transportRequired = excursion?.transportation_required;
  const returnPlan = (excursion?.return_plan as "same" | "custom" | null) ?? null;

  // Open the guide automatically when a coach reaches an unlocked excursion,
  // restore the step they were on (survives an iPad lock / reload), and close
  // it once the roster is submitted.
  useEffect(() => {
    if (!pinVerified || !excursion || isLocked || isClosed) {
      setWizardOpen(false);
      return;
    }
    const exId = excursion.id;
    const saved = sessionStorage.getItem(`nla_exc_wizard_step_${exId}`);
    if (saved) setWizardStepKey(saved);
    const dismissed = sessionStorage.getItem(`nla_exc_wizard_dismissed_${exId}`) === "1";
    if (!dismissed) setWizardOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinVerified, excursion?.id, isLocked, isClosed]);

  // Remember the current step so a reload lands back on it.
  useEffect(() => {
    if (excursion?.id) sessionStorage.setItem(`nla_exc_wizard_step_${excursion.id}`, wizardStepKey);
  }, [wizardStepKey, excursion?.id]);

  const dismissWizard = () => {
    if (excursion?.id) sessionStorage.setItem(`nla_exc_wizard_dismissed_${excursion.id}`, "1");
    setWizardOpen(false);
  };
  const reopenWizard = () => {
    if (excursion?.id) sessionStorage.removeItem(`nla_exc_wizard_dismissed_${excursion.id}`);
    setWizardOpen(true);
  };

  const assignedCount = useMemo(
    () => youth.filter((y) => y.vehicle_id).length,
    [youth]
  );

  const handleSetTransportRequired = async (required: boolean) => {
    if (!excursion) return;
    const { error } = await supabase.rpc("set_excursion_transportation_required", {
      _excursion_id: excursion.id,
      _required: required,
    });
    if (error) {
      toast.error("Couldn't save that choice. Try again.");
      return;
    }
    await loadExcursion();
  };

  const openAddVehicle = (preset: (typeof VEHICLE_PRESETS)[number] | null) => {
    if (preset) {
      setAddingVehicle({ name: preset.name, seat_cap: preset.seat_cap, isCustom: false });
    } else {
      setAddingVehicle({ name: "", seat_cap: 0, isCustom: true });
      setCustomNameInput("");
      setCustomSeatInput("");
    }
    setDriverNameInput("");
  };

  const handleSaveVehicle = async () => {
    if (!excursion || !addingVehicle) return;
    const name = addingVehicle.isCustom ? customNameInput.trim() : addingVehicle.name;
    const seat_cap = addingVehicle.isCustom ? Number(customSeatInput) : addingVehicle.seat_cap;
    const driver = driverNameInput.trim();

    if (!name) return toast.error("Vehicle name is required.");
    if (!seat_cap || seat_cap <= 0) return toast.error("Seat capacity must be at least 1.");
    if (!driver) return toast.error("Driver name is required.");

    setSavingVehicle(true);
    const { error } = await supabase.rpc("add_excursion_vehicle", {
      _excursion_id: excursion.id,
      _name: name,
      _seat_cap: seat_cap,
      _driver_name: driver,
    });
    setSavingVehicle(false);

    if (error) {
      toast.error(error.message || "Couldn't add vehicle.");
      return;
    }
    setAddingVehicle(null);
    await loadRoster(excursion.id);
  };

  const handleRemoveVehicle = (vehicle: Vehicle) => {
    setConfirmRemoveVehicle(vehicle);
  };

  const performRemoveVehicle = async () => {
    if (!excursion || !confirmRemoveVehicle) return;
    const { error } = await supabase.rpc("remove_excursion_vehicle", {
      _vehicle_id: confirmRemoveVehicle.id,
    });
    setConfirmRemoveVehicle(null);
    if (error) {
      toast.error(error.message || "Couldn't remove vehicle.");
      return;
    }
    await loadRoster(excursion.id);
  };

  const handleClearTransport = async () => {
    if (!excursion) return;
    const { error } = await supabase.rpc("excursion_clear_transportation", {
      _excursion_id: excursion.id,
    });
    setConfirmClearTransport(false);
    if (error) {
      toast.error(error.message || "Couldn't switch off transportation.");
      return;
    }
    toast.success("Switched to no transportation. Vehicles cleared.");
    await Promise.all([loadExcursion(), loadRoster(excursion.id)]);
  };

  const handleAddLateArrival = async (vehicleId: string | null) => {
    if (!excursion || !pendingLate) return;
    const { error } = await supabase.rpc("coach_add_late_arrival", {
      _excursion_id: excursion.id,
      _registration_id: pendingLate.id,
      _vehicle_id: vehicleId,
    });
    if (error) {
      toast.error(error.message || "Couldn't add youth.");
      return;
    }
    toast.success(
      `${pendingLate.child_first_name} ${pendingLate.child_last_name} added${vehicleId ? "" : " (no vehicle)"}.`
    );
    setPendingLate(null);
    setLateSearch("");
    setLateResults([]);
    await loadRoster(excursion.id);
  };

  const handleAssign = async (registrationId: string, vehicleId: string) => {
    if (!excursion) return;
    const { error } = await supabase.rpc("assign_youth_to_vehicle", {
      _vehicle_id: vehicleId,
      _registration_id: registrationId,
    });
    if (error) {
      toast.error(error.message || "Couldn't assign youth.");
      return;
    }
    await loadRoster(excursion.id);
  };

  const handleUnassign = async (registrationId: string) => {
    if (!excursion) return;
    const { error } = await supabase.rpc("unassign_youth_from_vehicle", {
      _excursion_id: excursion.id,
      _registration_id: registrationId,
    });
    if (error) {
      toast.error(error.message || "Couldn't unassign youth.");
      return;
    }
    await loadRoster(excursion.id);
  };

  // ───── Ride home (return leg) ─────
  const handleSetReturnPlan = async (plan: "same" | "custom") => {
    if (!excursion) return;
    const { error } = await supabase.rpc("set_excursion_return_plan", {
      _excursion_id: excursion.id,
      _plan: plan,
    });
    if (error) {
      toast.error(error.message || "Couldn't save the ride-home plan.");
      return;
    }
    if (plan === "custom") {
      // Start the ride-home chart from the arrival chart, so the coach only
      // moves who needs moving instead of rebuilding from scratch.
      await supabase.rpc("seed_excursion_return_from_outbound", { _excursion_id: excursion.id });
    }
    await Promise.all([loadExcursion(), loadRoster(excursion.id)]);
  };

  const handleAssignReturn = async (registrationId: string, vehicleId: string) => {
    if (!excursion) return;
    const { error } = await supabase.rpc("assign_youth_return_vehicle", {
      _vehicle_id: vehicleId,
      _registration_id: registrationId,
    });
    if (error) {
      toast.error(error.message || "Couldn't set their ride home.");
      return;
    }
    await loadRoster(excursion.id);
  };

  const handleUnassignReturn = async (registrationId: string) => {
    if (!excursion) return;
    const { error } = await supabase.rpc("unassign_youth_return", {
      _excursion_id: excursion.id,
      _registration_id: registrationId,
    });
    if (error) {
      toast.error(error.message || "Couldn't remove them from that van.");
      return;
    }
    await loadRoster(excursion.id);
  };

  const handleAddPersonnel = async () => {
    if (!excursion || !personnelInput.trim()) return;
    const name = personnelInput.trim();
    setSavingPersonnel(true);
    const { data, error } = await supabase.rpc("add_excursion_personnel", {
      _excursion_id: excursion.id,
      _name: name,
    });
    setSavingPersonnel(false);
    if (error) {
      toast.error(error.message || "Couldn't add name.");
      return;
    }
    setPersonnelInput("");
    await loadRoster(excursion.id);
    // Immediately ask which vehicle they're riding in (when there are vans to
    // choose from). They're not assumed to be driving separately.
    const newId = data as string | null;
    if (newId && transportRequired === true && vehicles.length > 0) {
      setPendingPersonnel({ id: newId, name });
    }
  };

  const handleSetPersonnelVehicle = async (personnelId: string, vehicleId: string | null) => {
    if (!excursion) return;
    const { error } = await supabase.rpc("set_excursion_personnel_vehicle", {
      _personnel_id: personnelId,
      _vehicle_id: vehicleId,
    });
    if (error) {
      toast.error(error.message || "Couldn't set their vehicle.");
      return;
    }
    await loadRoster(excursion.id);
  };

  const handleRemovePersonnel = async (personnelId: string) => {
    if (!excursion) return;
    const { error } = await supabase.rpc("remove_excursion_personnel", {
      _personnel_id: personnelId,
    });
    if (error) {
      toast.error(error.message || "Couldn't remove name.");
      return;
    }
    await loadRoster(excursion.id);
  };

  const handleSubmitRoster = async () => {
    if (!excursion) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("lock_excursion_roster", {
      _excursion_id: excursion.id,
    });
    setSubmitting(false);
    setConfirmSubmit(false);
    if (error) {
      toast.error(error.message || "Couldn't submit roster.");
      return;
    }
    toast.success("Excursion roster submitted.");
    await loadExcursion();
  };

  const handleUnlockRoster = async () => {
    if (!excursion) return;
    const { error } = await supabase.rpc("unlock_excursion_roster", {
      _excursion_id: excursion.id,
    });
    setConfirmUnlock(false);
    if (error) {
      toast.error(error.message || "Couldn't unlock roster.");
      return;
    }
    toast.success("Roster unlocked. You can edit it again.");
    await loadExcursion();
  };

  // ───── Phase 3: arrival / return / timestamp edit ────────────────

  const handleConfirmArrival = async (note: string | null) => {
    if (!excursion) return;
    const { error } = await supabase.rpc("confirm_excursion_arrival", {
      _excursion_id: excursion.id,
      _note: note,
    });
    setConfirmArrivalOpen(false);
    setArrivalNoteMode(false);
    setArrivalNoteInput("");
    if (error) {
      toast.error(error.message || "Couldn't confirm arrival.");
      return;
    }
    toast.success("Arrival confirmed.");
    await loadExcursion();
    // Right after arrival, ask about the ride home (unless it's already been
    // decided, or there's no NLA transportation to arrange).
    if (transportRequired === true && !returnPlan) {
      setRideHomeChoiceOpen(true);
    }
  };

  const handleConfirmReturn = async (note: string | null) => {
    if (!excursion) return;
    const { error } = await supabase.rpc("confirm_excursion_return", {
      _excursion_id: excursion.id,
      _note: note,
    });
    setConfirmCloseOpen(false);
    setCloseNoteMode(false);
    setCloseNoteInput("");
    if (error) {
      toast.error(error.message || "Couldn't close trip.");
      return;
    }
    toast.success("Excursion closed.");
    await loadExcursion();
  };

  const openTimestampEdit = (which: "arrived" | "returned") => {
    if (!excursion) return;
    const current =
      which === "arrived" ? excursion.arrived_at : excursion.returned_at;
    const d = current ? new Date(current) : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    setTimestampEditValue(`${yyyy}-${mm}-${dd}T${hh}:${mi}`);
    setEditingTimestamp(which);
  };

  const handleSaveTimestampEdit = async () => {
    if (!excursion || !editingTimestamp || !timestampEditValue) return;
    setSavingTimestamp(true);
    const iso = new Date(timestampEditValue).toISOString();
    const rpcName =
      editingTimestamp === "arrived"
        ? "set_excursion_arrived_at"
        : "set_excursion_returned_at";
    const argName = editingTimestamp === "arrived" ? "_arrived_at" : "_returned_at";
    const { error } = await supabase.rpc(rpcName, {
      _excursion_id: excursion.id,
      [argName]: iso,
    });
    setSavingTimestamp(false);
    setEditingTimestamp(null);
    if (error) {
      toast.error(error.message || "Couldn't update timestamp.");
      return;
    }
    toast.success("Time updated.");
    await loadExcursion();
  };

  // ───── Render ─────────────────────────────────────────────────────

  // PIN gate — blocks the entire page until the coach types 1086
  if (!pinVerified) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 relative">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-4 left-4 text-white/40 hover:text-white hover:bg-white/10"
          onClick={() => navigate("/excursion-check-in")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Kiosk
        </Button>
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full bg-purple-500/15 border border-purple-400/40 flex items-center justify-center mb-4">
              <KeyRound className="w-8 h-8 text-purple-300" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-center mb-1">Coach Mode</h1>
            <p className="text-white/50 text-center text-sm">
              Enter the coach PIN to finalize the Excursion roster.
            </p>
          </div>
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value);
              if (pinError) setPinError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleVerifyPin();
            }}
            placeholder="••••"
            maxLength={6}
            className={`text-center text-3xl tracking-[0.5em] h-16 bg-white/5 border-2 text-white placeholder:text-white/20 ${
              pinError ? "border-red-500/60" : "border-white/15 focus:border-purple-500/60"
            }`}
          />
          {pinError && (
            <p className="text-red-400 text-sm text-center mt-3">Incorrect PIN. Try again.</p>
          )}
          <Button
            onClick={handleVerifyPin}
            disabled={pinInput.length === 0}
            className="w-full mt-4 bg-purple-600 hover:bg-purple-500 text-white font-bold py-6 rounded-xl"
          >
            <ShieldCheck className="w-5 h-5 mr-2" /> Verify
          </Button>
        </div>
      </div>
    );
  }

  if (!excursionLoaded) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-white/40">Loading…</p>
      </div>
    );
  }

  if (!excursion) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-4 left-4 text-white/40 hover:text-white hover:bg-white/10"
          onClick={() => navigate("/excursion-check-in")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Kiosk
        </Button>
        <CalendarX className="w-24 h-24 text-purple-400/50 mb-6" />
        <h1 className="text-3xl md:text-4xl font-black text-white text-center mb-3">
          No Excursion Scheduled Today
        </h1>
        <p className="text-white/50 text-center max-w-lg">
          Mark today as an Excursion in <span className="text-purple-300 font-semibold">Admin → Operations → Attendance</span> first.
        </p>
      </div>
    );
  }

  const checkedInCount = youth.length;
  const unassignedYouth = youth.filter((y) => !y.vehicle_id);

  // Wizard step order — vehicles + loading are skipped when NLA isn't driving.
  const wizardSteps: [string, string][] =
    transportRequired === false
      ? [["transport", "Transportation"], ["coaches", "Coaches & Volunteers"], ["missing", "Anyone Missing?"], ["review", "Review & Submit"]]
      : [["transport", "Transportation"], ["vehicles", "Choose Vehicles"], ["load", "Load Youth"], ["coaches", "Coaches & Volunteers"], ["missing", "Anyone Missing?"], ["review", "Review & Submit"]];
  const wizardKeys = wizardSteps.map((s) => s[0]);
  const safeStepKey = wizardKeys.includes(wizardStepKey) ? wizardStepKey : wizardKeys[0];
  const wizardIdx = wizardKeys.indexOf(safeStepKey);
  const wizardTitle = wizardSteps[wizardIdx][1];
  const gotoNextStep = () => setWizardStepKey(wizardKeys[Math.min(wizardKeys.length - 1, wizardIdx + 1)]);
  const gotoPrevStep = () => setWizardStepKey(wizardKeys[Math.max(0, wizardIdx - 1)]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/50 hover:text-white hover:bg-white/10"
            onClick={() => navigate("/excursion-check-in")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Kiosk
          </Button>
          <img src={nlaLogo} alt="NLA" className="h-8 ml-1" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-purple-300/70 uppercase tracking-wider font-semibold">
              Coach Mode
            </p>
            <p className="text-base md:text-lg font-bold truncate flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-300 shrink-0" />
              {excursion.name}
            </p>
          </div>
          {isLocked && (
            <span className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-purple-200 bg-purple-500/20 border border-purple-400/40 rounded-full px-3 py-1.5">
              <Lock className="w-3.5 h-3.5" /> Locked
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={refreshing}
            onClick={handleManualRefresh}
            className="text-white/50 hover:text-white hover:bg-white/10"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {/* Locked banner */}
        {isLocked && (
          <Card className="bg-purple-500/10 border-purple-400/40 text-white">
            <CardContent className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
              <Lock className="w-10 h-10 text-purple-300 shrink-0" />
              <div className="flex-1">
                <p className="text-lg md:text-xl font-bold">Roster Submitted</p>
                <p className="text-white/60 text-sm md:text-base">
                  Locked at {formatTime(excursion.roster_locked_at!)}. Made a mistake? Unlock to edit.
                </p>
              </div>
              {!isClosed && (
                <Button
                  variant="outline"
                  className="border-purple-400/50 bg-transparent text-purple-200 hover:bg-purple-500/20"
                  onClick={() => setConfirmUnlock(true)}
                >
                  <Unlock className="w-4 h-4 mr-2" /> Unlock Roster
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Phase 3 — Trip status banner. Replaces the locked banner once
            the trip has at least started (arrived). */}
        {isClosed && excursion.roster_locked_at && (
          <Card className="bg-emerald-500/10 border-emerald-400/40 text-white">
            <CardContent className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-300 shrink-0" />
              <div className="flex-1">
                <p className="text-lg md:text-xl font-bold text-emerald-100">Excursion Closed</p>
                <p className="text-emerald-200/70 text-sm md:text-base">
                  Trip is officially in the books.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Locked-state Totals Summary — breakdown + grand total */}
        {isLocked && (
          <Card className="bg-white/[0.03] border-white/10 text-white">
            <CardContent className="p-5 md:p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">
                Excursion Totals
              </p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center bg-white/[0.04] border border-white/10 rounded-xl p-4 md:p-5">
                  <p className="text-3xl md:text-5xl font-black tabular-nums">{checkedInCount}</p>
                  <p className="text-[11px] md:text-xs text-white/60 uppercase tracking-wider mt-1 font-semibold">
                    Total Youth
                  </p>
                </div>
                <div className="text-center bg-white/[0.04] border border-white/10 rounded-xl p-4 md:p-5">
                  <p className="text-3xl md:text-5xl font-black tabular-nums">{vehicles.length}</p>
                  <p className="text-[11px] md:text-xs text-white/60 uppercase tracking-wider mt-1 font-semibold">
                    Total Drivers
                  </p>
                </div>
                <div className="text-center bg-white/[0.04] border border-white/10 rounded-xl p-4 md:p-5">
                  <p className="text-3xl md:text-5xl font-black tabular-nums">{personnel.length}</p>
                  <p className="text-[11px] md:text-xs text-white/60 uppercase tracking-wider mt-1 font-semibold">
                    Coaches & Volunteers
                  </p>
                </div>
              </div>
              <div className="text-center bg-emerald-500/15 border-2 border-emerald-400/50 rounded-xl p-5 md:p-6">
                <p className="text-5xl md:text-7xl font-black text-emerald-300 tabular-nums leading-none">
                  {checkedInCount + vehicles.length + personnel.length}
                </p>
                <p className="text-xs md:text-sm font-bold text-emerald-200/90 uppercase tracking-wider mt-2">
                  Total on Trip
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vehicles at a glance while locked. Before the ride home is planned
            it's a simple per-van list; once a ride-home plan is set it becomes
            the Ride There vs Ride Home comparison (single source, no
            redundant vehicle list). */}
        {isLocked && transportRequired === true && vehicles.length > 0 && (
          <Card className="bg-white/[0.03] border-white/10 text-white">
            <CardContent className="p-5 md:p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">
                {returnPlan ? "Ride There vs Ride Home" : "Ride to Excursion — who's in each vehicle"}
              </p>
              {returnPlan ? (
                <ExcursionRideComparison vehicles={vehicles} youth={youth} personnel={personnel} returnPlan={returnPlan} />
              ) : (
                <div className="space-y-3">
                  {vehicles.map((v) => {
                    const kids = youth.filter((y) => y.vehicle_id === v.id);
                    return (
                      <div key={v.id} className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
                        <p className="font-bold flex items-center gap-2">
                          <Truck className="w-4 h-4 text-purple-300" />{v.name}
                          <span className="text-white/40 font-medium text-sm">· {v.driver_name} · {kids.length}/{v.seat_cap}</span>
                        </p>
                        {kids.length === 0 ? (
                          <p className="text-sm text-white/30 italic mt-1">No youth assigned.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {kids.map((y) => (
                              <span key={y.registration_id} className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 border border-purple-400/30 px-2.5 py-1 text-sm">
                                <span className="w-5 h-5 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-[10px] font-bold text-white/60">
                                  {getHeadshotUrl(y.child_headshot_url) ? <img src={getHeadshotUrl(y.child_headshot_url)!} alt="" className="w-full h-full object-cover" /> : y.child_first_name[0]}
                                </span>
                                {y.child_first_name} {y.child_last_name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {unassignedYouth.length > 0 && (
                    <div className="rounded-xl bg-yellow-500/[0.06] border border-yellow-400/30 p-4">
                      <p className="font-bold text-yellow-200/90 text-sm">Not in a vehicle ({unassignedYouth.length})</p>
                      <p className="text-sm text-yellow-100/60 mt-1">{unassignedYouth.map((y) => `${y.child_first_name} ${y.child_last_name}`).join(", ")}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ───── Phase 3 cards (only when locked) ───── */}

        {/* Confirm Arrival — shown after lock, before arrival confirmed */}
        {isLocked && !isArrived && (
          <Card className="bg-purple-500/[0.06] border-purple-400/30 text-white">
            <CardContent className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
              <Flag className="w-10 h-10 text-purple-300 shrink-0" />
              <div className="flex-1">
                <p className="text-lg md:text-xl font-bold">Arrived at the destination?</p>
                <p className="text-white/60 text-sm md:text-base">
                  Tap when the group is safely at {excursion.name}. We'll confirm the headcount with you.
                </p>
              </div>
              <Button
                size="lg"
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-base md:text-lg px-6 md:px-8 py-5 md:py-6 rounded-xl shadow-lg shadow-purple-900/30"
                onClick={() => setConfirmArrivalOpen(true)}
              >
                <Flag className="w-5 h-5 mr-2" /> Confirm Arrival
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Arrival confirmed badge — pencil to edit */}
        {isLocked && isArrived && (
          <Card className="bg-white/[0.03] border-white/10 text-white">
            <CardContent className="p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-300 shrink-0" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-200/80">
                      Arrived
                    </p>
                    <p className="text-lg md:text-xl font-bold">
                      {formatTime(excursion.arrived_at!)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/50 hover:text-white hover:bg-white/10"
                  onClick={() => openTimestampEdit("arrived")}
                >
                  <Pencil className="w-4 h-4 mr-1.5" /> Edit time
                </Button>
              </div>
              {excursion.arrival_note && (
                <p className="mt-3 text-sm text-yellow-200/80 bg-yellow-500/10 border border-yellow-400/30 rounded-lg px-3 py-2">
                  📝 {excursion.arrival_note}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ───── The Ride Home (return-leg seating) — after arrival, before close ───── */}
        {isLocked && isArrived && !isClosed && transportRequired === true && vehicles.length > 0 && (() => {
          const returnUnassigned = youth.filter((y) => !y.return_vehicle_id);
          const returnCount = (vid: string) =>
            youth.filter((y) => y.return_vehicle_id === vid).length +
            personnel.filter((p) => p.vehicle_id === vid).length;
          return (
            <Card className="bg-white/[0.03] border-white/10 text-white">
              <CardContent className="p-5 md:p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Home className="w-5 h-5 text-purple-300" />
                  <h2 className="text-lg md:text-xl font-bold">The Ride Home</h2>
                </div>

                {!returnPlan ? (
                  <>
                    <p className="text-white/60 text-sm mb-4">Same vehicles home, or rearrange so each van can cover one area?</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <button onClick={() => handleSetReturnPlan("same")} className="rounded-xl border-2 border-white/15 bg-white/5 hover:bg-white/10 p-4 text-left transition">
                        <p className="font-bold">Keep same vehicles</p>
                        <p className="text-sm text-white/50 mt-1">Everyone rides home in the van they came in.</p>
                      </button>
                      <button onClick={() => handleSetReturnPlan("custom")} className="rounded-xl border-2 border-purple-400/40 bg-purple-500/10 hover:bg-purple-500/20 p-4 text-left transition">
                        <p className="font-bold">Rearrange for the ride home</p>
                        <p className="text-sm text-white/50 mt-1">Move kids between vans — e.g. one goes south, one north.</p>
                      </button>
                    </div>
                  </>
                ) : returnPlan === "same" ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-white/70 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Riding home in the <b>same vehicles</b> as the trip there.
                    </p>
                    <Button variant="outline" onClick={() => handleSetReturnPlan("custom")} className="border-purple-400/40 bg-transparent text-purple-200 hover:bg-purple-500/20">
                      Rearrange instead
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <p className="text-sm text-white/60">
                        Tap a youth to set their ride home. <span className="text-purple-200 font-semibold">{youth.length - returnUnassigned.length} of {youth.length}</span> set.
                      </p>
                      <button onClick={() => handleSetReturnPlan("same")} className="text-xs text-white/40 hover:text-white/80 underline underline-offset-2">Actually, keep same →</button>
                    </div>
                    {returnUnassigned.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2">Not set yet ({returnUnassigned.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {returnUnassigned.map((y) => (
                            <Popover key={y.registration_id}>
                              <PopoverTrigger asChild>
                                <button className="group flex items-center gap-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-3 py-1.5 transition">
                                  <span className="w-7 h-7 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-xs font-bold text-white/60">{getHeadshotUrl(y.child_headshot_url) ? <img src={getHeadshotUrl(y.child_headshot_url)!} alt="" className="w-full h-full object-cover" /> : y.child_first_name[0]}</span>
                                  <span className="text-sm font-semibold pr-1">{y.child_first_name} {y.child_last_name}</span>
                                  <Plus className="w-4 h-4 text-purple-300" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 bg-neutral-900 border-white/10 text-white p-2">
                                <p className="text-xs text-white/50 px-2 py-1.5 font-semibold uppercase tracking-wider">Ride home in…</p>
                                <div className="space-y-1">
                                  {vehicles.map((v) => {
                                    const c = returnCount(v.id);
                                    const full = c >= v.seat_cap;
                                    return (
                                      <button key={v.id} disabled={full} onClick={() => handleAssignReturn(y.registration_id, v.id)} className="w-full text-left flex items-center justify-between rounded-md px-3 py-2 hover:bg-white/10 disabled:opacity-40">
                                        <span className="font-semibold text-sm">{v.name}</span>
                                        <span className="text-xs text-white/50 tabular-nums">{c}/{v.seat_cap}{full ? " full" : ""}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      {vehicles.map((v) => {
                        const kids = youth.filter((y) => y.return_vehicle_id === v.id);
                        return (
                          <div key={v.id} className="rounded-xl bg-white/[0.03] border border-white/10 p-3">
                            <p className="text-sm font-bold flex items-center gap-2"><Truck className="w-4 h-4 text-purple-300" />{v.name} <span className="text-white/40 font-medium">· {v.driver_name} · {kids.length}/{v.seat_cap}</span></p>
                            {kids.length === 0 ? (
                              <p className="text-xs text-white/30 italic mt-1">Empty</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {kids.map((y) => (
                                  <span key={y.registration_id} className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 border border-purple-400/30 pl-2 pr-1 py-0.5 text-xs">
                                    {y.child_first_name} {y.child_last_name}
                                    <button onClick={() => handleUnassignReturn(y.registration_id)} className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white"><X className="w-3 h-3" /></button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Close Trip — shown after arrival, before close */}
        {isLocked && isArrived && !isClosed && (
          <Card className="bg-purple-500/[0.06] border-purple-400/30 text-white">
            <CardContent className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
              <Home className="w-10 h-10 text-purple-300 shrink-0" />
              <div className="flex-1">
                <p className="text-lg md:text-xl font-bold">Back at the gym?</p>
                <p className="text-white/60 text-sm md:text-base">
                  When everyone is safely returned, close the trip. We'll confirm the headcount one more time.
                </p>
              </div>
              <Button
                size="lg"
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-base md:text-lg px-6 md:px-8 py-5 md:py-6 rounded-xl shadow-lg shadow-purple-900/30"
                onClick={() => setConfirmCloseOpen(true)}
              >
                <Home className="w-5 h-5 mr-2" /> Close Excursion Trip
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Returned/closed badge — pencil to edit */}
        {isLocked && isClosed && (
          <Card className="bg-white/[0.03] border-white/10 text-white">
            <CardContent className="p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-3">
                  <Home className="w-8 h-8 text-emerald-300 shrink-0" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-200/80">
                      Returned & Closed
                    </p>
                    <p className="text-lg md:text-xl font-bold">
                      {formatTime(excursion.returned_at!)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/50 hover:text-white hover:bg-white/10"
                  onClick={() => openTimestampEdit("returned")}
                >
                  <Pencil className="w-4 h-4 mr-1.5" /> Edit time
                </Button>
              </div>
              {excursion.return_note && (
                <p className="mt-3 text-sm text-yellow-200/80 bg-yellow-500/10 border border-yellow-400/30 rounded-lg px-3 py-2">
                  📝 {excursion.return_note}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Counter strip — hidden once roster is locked (Totals Summary above replaces it) */}
        {!isLocked && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
            <Users className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/60">Checked in:</span>
            <span className="text-lg font-black tabular-nums">{checkedInCount}</span>
          </div>
          {transportRequired === true && (
            <div className="flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-2">
              <Truck className="w-4 h-4 text-purple-300" />
              <span className="text-sm text-purple-200">Assigned to a vehicle:</span>
              <span className="text-lg font-black tabular-nums text-purple-100">
                {assignedCount} of {checkedInCount}
              </span>
            </div>
          )}
          {transportRequired === true && !isLocked && (
            <button
              onClick={() => setConfirmClearTransport(true)}
              className="text-sm text-white/40 hover:text-white/80 underline underline-offset-2"
            >
              Actually, no transportation needed →
            </button>
          )}
        </div>
        )}

        {/* STEP 1 — transport question */}
        {transportRequired === null && !isLocked && (
          <Card className="bg-white/[0.04] border-white/10 text-white">
            <CardContent className="p-6 md:p-10 text-center">
              <h2 className="text-2xl md:text-4xl font-black mb-3">
                Is transportation needed for this Excursion?
              </h2>
              <p className="text-white/50 mb-8 max-w-xl mx-auto">
                Choose <span className="text-white font-semibold">Yes</span> if NLA is providing rides (vans, mini-bus, etc).
                Choose <span className="text-white font-semibold">No</span> if families are dropping youth off at the destination.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xl px-10 py-7 rounded-2xl shadow-lg shadow-purple-900/30"
                  onClick={() => handleSetTransportRequired(true)}
                >
                  Yes, transportation needed
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold text-xl px-10 py-7 rounded-2xl"
                  onClick={() => handleSetTransportRequired(false)}
                >
                  No, no transportation
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2 — vehicles + assignments (if transportRequired). Setup only:
            once the roster is locked this collapses (Unlock to edit), so the
            locked screen isn't cluttered with a redundant second vehicle list. */}
        {transportRequired === true && !isLocked && (
          <>
            {/* Unassigned youth pool */}
            <Card className="bg-white/[0.04] border-white/10 text-white">
              <CardContent className="p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-white/60" />
                    Unassigned Youth ({unassignedYouth.length})
                  </h2>
                  {unassignedYouth.length === 0 && checkedInCount > 0 && (
                    <span className="text-sm text-emerald-300 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> All assigned
                    </span>
                  )}
                </div>

                {checkedInCount === 0 && (
                  <p className="text-white/40 text-sm">
                    No youth have checked in yet. They'll appear here once they use the kiosk.
                  </p>
                )}

                {unassignedYouth.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {unassignedYouth.map((y) => (
                      <Popover key={y.registration_id}>
                        <PopoverTrigger asChild disabled={isLocked || vehicles.length === 0}>
                          <button
                            disabled={isLocked || vehicles.length === 0}
                            className="group flex items-center gap-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-3 py-1.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="w-7 h-7 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-xs font-bold text-white/60">
                              {getHeadshotUrl(y.child_headshot_url) ? (
                                <img
                                  src={getHeadshotUrl(y.child_headshot_url)!}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                y.child_first_name[0]
                              )}
                            </span>
                            <span className="text-sm font-semibold pr-1">
                              {y.child_first_name} {y.child_last_name}
                            </span>
                            <Plus className="w-4 h-4 text-purple-300 opacity-60 group-hover:opacity-100" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 bg-neutral-900 border-white/10 text-white p-2">
                          <p className="text-xs text-white/50 px-2 py-1.5 font-semibold uppercase tracking-wider">
                            Assign to vehicle
                          </p>
                          <div className="space-y-1">
                            {vehicles.map((v) => {
                              const full = v.assigned_count >= v.seat_cap;
                              return (
                                <button
                                  key={v.id}
                                  disabled={full}
                                  onClick={() => handleAssign(y.registration_id, v.id)}
                                  className="w-full text-left flex items-center justify-between rounded-md px-3 py-2 hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <span className="font-semibold text-sm">{v.name}</span>
                                  <span className="text-xs text-white/50 tabular-nums">
                                    {v.assigned_count}/{v.seat_cap}
                                    {full ? " full" : ""}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    ))}
                  </div>
                )}

                {vehicles.length === 0 && unassignedYouth.length > 0 && !isLocked && (
                  <p className="text-yellow-300/70 text-sm mt-3">
                    Add a vehicle below before you can assign anyone.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Vehicles */}
            <div className="space-y-4">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 px-1">
                <Truck className="w-5 h-5 text-purple-300" /> Vehicles
              </h2>

              {vehicles.length === 0 && !isLocked && (
                <Card className="bg-white/[0.02] border border-dashed border-white/10 text-white">
                  <CardContent className="p-6 text-center text-white/40 text-sm">
                    No vehicles yet. Pick one below to start.
                  </CardContent>
                </Card>
              )}

              {vehicles.map((v) => {
                const assignedYouth = youth.filter((y) => y.vehicle_id === v.id);
                const seatsLeft = v.seat_cap - v.assigned_count;
                return (
                  <Card key={v.id} className="bg-white/[0.04] border-white/10 text-white">
                    <CardContent className="p-5 md:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                        <div>
                          <p className="text-xl md:text-2xl font-black flex items-center gap-2">
                            <Truck className="w-5 h-5 text-purple-300" /> {v.name}
                          </p>
                          <p className="text-sm text-white/50 mt-1">
                            Driver: <span className="text-white/80 font-semibold">{v.driver_name}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-2xl font-black tabular-nums">
                              {v.assigned_count}
                              <span className="text-white/40 font-bold"> / {v.seat_cap}</span>
                            </p>
                            <p className="text-xs text-white/50">
                              {seatsLeft > 0 ? `${seatsLeft} seats left` : "At capacity"}
                            </p>
                          </div>
                          {!isLocked && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-white/40 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => handleRemoveVehicle(v)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {assignedYouth.length === 0 ? (
                        <p className="text-white/30 text-sm italic">
                          No youth assigned yet.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {assignedYouth.map((y) => (
                            <div
                              key={y.registration_id}
                              className="flex items-center gap-2 rounded-full bg-purple-500/10 border border-purple-400/30 pl-1 pr-1 py-1"
                            >
                              <span className="w-7 h-7 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-xs font-bold text-white/60">
                                {getHeadshotUrl(y.child_headshot_url) ? (
                                  <img
                                    src={getHeadshotUrl(y.child_headshot_url)!}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  y.child_first_name[0]
                                )}
                              </span>
                              <span className="text-sm font-semibold text-purple-100 pr-1">
                                {y.child_first_name} {y.child_last_name}
                              </span>
                              {!isLocked && (
                                <button
                                  onClick={() => handleUnassign(y.registration_id)}
                                  className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white"
                                  aria-label="Unassign"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {/* Add Vehicle picker */}
              {!isLocked && !addingVehicle && (
                <Card className="bg-white/[0.02] border-white/10 text-white">
                  <CardContent className="p-5 md:p-6">
                    <p className="text-sm font-bold uppercase tracking-wider text-white/50 mb-3">
                      Add a Vehicle
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {VEHICLE_PRESETS.map((p) => {
                        const Icon = p.icon;
                        return (
                          <button
                            key={p.name}
                            onClick={() => openAddVehicle(p)}
                            className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] hover:bg-purple-500/10 hover:border-purple-400/40 border border-white/10 p-4 transition"
                          >
                            <Icon className="w-6 h-6 text-purple-300" />
                            <span className="text-sm font-bold">{p.name}</span>
                            <span className="text-xs text-white/50">{p.seat_cap} seats</span>
                          </button>
                        );
                      })}
                      <button
                        onClick={() => openAddVehicle(null)}
                        className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] hover:bg-purple-500/10 hover:border-purple-400/40 border border-dashed border-white/20 p-4 transition"
                      >
                        <Plus className="w-6 h-6 text-purple-300" />
                        <span className="text-sm font-bold">Other</span>
                        <span className="text-xs text-white/50">Custom</span>
                      </button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Add Vehicle form (after picking) */}
              {!isLocked && addingVehicle && (
                <Card className="bg-purple-500/[0.06] border-purple-400/30 text-white">
                  <CardContent className="p-5 md:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold uppercase tracking-wider text-purple-200">
                        New Vehicle{addingVehicle.isCustom ? " — Custom" : ""}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white/40 hover:text-white"
                        onClick={() => setAddingVehicle(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    {addingVehicle.isCustom ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-white/70 text-xs uppercase tracking-wider">
                            Vehicle name
                          </Label>
                          <Input
                            value={customNameInput}
                            onChange={(e) => setCustomNameInput(e.target.value)}
                            placeholder="e.g. Pastor's SUV"
                            className="mt-1 bg-white/5 border-white/15 text-white"
                          />
                        </div>
                        <div>
                          <Label className="text-white/70 text-xs uppercase tracking-wider">
                            Number of seats (not counting driver)
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            value={customSeatInput}
                            onChange={(e) => setCustomSeatInput(e.target.value)}
                            placeholder="e.g. 4 for a pickup truck"
                            className="mt-1 bg-white/5 border-white/15 text-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-lg font-bold">
                        {addingVehicle.name}{" "}
                        <span className="text-white/50 font-medium text-base">
                          • {addingVehicle.seat_cap} seats
                        </span>
                      </p>
                    )}

                    <div>
                      <Label className="text-white/70 text-xs uppercase tracking-wider">
                        Driver name
                      </Label>
                      <Input
                        value={driverNameInput}
                        onChange={(e) => setDriverNameInput(e.target.value)}
                        placeholder="e.g. Coach Chris"
                        className="mt-1 bg-white/5 border-white/15 text-white"
                      />
                    </div>

                    <Button
                      onClick={handleSaveVehicle}
                      disabled={savingVehicle}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-6 rounded-xl"
                    >
                      {savingVehicle ? "Adding…" : "Add Vehicle"}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}

        {/* Manually add a youth (covers late arrivals + kids who skipped the kiosk).
            Available once Chrissy has answered the transport question, but
            disappears once the trip is closed (no edits after closure). */}
        {transportRequired !== null && !isClosed && (
          <Card className="bg-white/[0.04] border-white/10 text-white">
            <CardContent className="p-5 md:p-6">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 mb-1">
                <UserPlus className="w-5 h-5 text-white/60" />
                {isLocked ? "Add Late Arrival" : "Manually Add a Youth"}
              </h2>
              <p className="text-white/50 text-sm mb-4">
                {isLocked
                  ? "The roster is locked, but you can still add a kid who showed up late and place them in a vehicle."
                  : "Use this if a youth couldn't use the kiosk, or you want to add them on their behalf."}
              </p>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  value={lateSearch}
                  onChange={(e) => setLateSearch(e.target.value)}
                  placeholder="Type a name to search…"
                  className="pl-9 bg-white/5 border-white/15 text-white"
                />
              </div>

              {lateSearching && (
                <p className="text-white/40 text-sm">Searching…</p>
              )}

              {!lateSearching && lateSearch.trim().length >= 2 && lateResults.length === 0 && (
                <p className="text-white/40 text-sm">No youth found.</p>
              )}

              {lateResults.length > 0 && (
                <div className="space-y-2">
                  {lateResults.map((r) => {
                    const alreadyIn = youth.some((y) => y.registration_id === r.id);
                    return (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/10 p-3"
                      >
                        <span className="w-10 h-10 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-sm font-bold text-white/60 shrink-0">
                          {getHeadshotUrl(r.child_headshot_url) ? (
                            <img
                              src={getHeadshotUrl(r.child_headshot_url)!}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            r.child_first_name[0]
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">
                            {r.child_first_name} {r.child_last_name}
                          </p>
                          <p className="text-xs text-white/40 truncate">{r.child_boxing_program}</p>
                        </div>
                        {alreadyIn ? (
                          <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> On roster
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => setPendingLate(r)}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-bold"
                          >
                            <Plus className="w-4 h-4 mr-1" /> Add
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Personnel — shown for both Yes/No transport */}
        {transportRequired !== null && (
          <Card className="bg-white/[0.04] border-white/10 text-white">
            <CardContent className="p-5 md:p-6">
              <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 mb-1">
                <UserPlus className="w-5 h-5 text-white/60" />
                Coaches & Volunteers Riding Along
              </h2>
              <p className="text-white/50 text-sm mb-4">
                Add the names of NLA staff and volunteers attending the trip (not driving).
              </p>

              {personnel.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {personnel.map((p) => (
                    <PersonnelChip
                      key={p.id}
                      p={p}
                      vehicles={vehicles}
                      editable={!isLocked}
                      showVehicle={transportRequired === true && vehicles.length > 0}
                      onSetVehicle={(vid) => handleSetPersonnelVehicle(p.id, vid)}
                      onRemove={() => handleRemovePersonnel(p.id)}
                    />
                  ))}
                </div>
              )}

              {!isLocked && (
                <div className="flex gap-2">
                  <Input
                    value={personnelInput}
                    onChange={(e) => setPersonnelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddPersonnel();
                    }}
                    placeholder="Add a name and press Enter"
                    className="bg-white/5 border-white/15 text-white"
                  />
                  <Button
                    onClick={handleAddPersonnel}
                    disabled={savingPersonnel || !personnelInput.trim()}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Submit roster */}
        {transportRequired !== null && !isLocked && (
          <Card className="bg-purple-500/[0.06] border-purple-400/30 text-white">
            <CardContent className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <p className="text-lg md:text-xl font-bold">Ready to lock in this Excursion?</p>
                <p className="text-white/60 text-sm md:text-base">
                  Submitting locks the roster. You can unlock and edit if anything changes.
                </p>
              </div>
              <Button
                size="lg"
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg px-8 py-6 rounded-xl shadow-lg shadow-purple-900/30"
                onClick={() => setConfirmSubmit(true)}
              >
                <Lock className="w-5 h-5 mr-2" /> Submit Excursion Roster
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Submit confirm */}
      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Excursion Roster?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {transportRequired === false
                ? `Locking the roster with ${checkedInCount} youth checked in and no transportation.`
                : `Locking the roster with ${assignedCount} of ${checkedInCount} youth assigned to ${vehicles.length} vehicle(s).`}
              {assignedCount < checkedInCount && transportRequired === true && (
                <span className="block mt-2 text-yellow-300">
                  ⚠ {checkedInCount - assignedCount} youth are still unassigned.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/15 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              className="bg-purple-600 hover:bg-purple-500 text-white"
              onClick={handleSubmitRoster}
            >
              {submitting ? "Submitting…" : "Submit & Lock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlock confirm */}
      <AlertDialog open={confirmUnlock} onOpenChange={setConfirmUnlock}>
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock the roster?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              You'll be able to edit vehicles, assignments, and personnel again. Re-submit when you're done.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/15 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-purple-600 hover:bg-purple-500 text-white"
              onClick={handleUnlockRoster}
            >
              Unlock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove vehicle confirm */}
      <AlertDialog
        open={!!confirmRemoveVehicle}
        onOpenChange={(open) => !open && setConfirmRemoveVehicle(null)}
      >
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {confirmRemoveVehicle?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {confirmRemoveVehicle && confirmRemoveVehicle.assigned_count > 0 ? (
                <>
                  This vehicle has{" "}
                  <span className="text-yellow-300 font-semibold">
                    {confirmRemoveVehicle.assigned_count} youth
                  </span>{" "}
                  assigned. They'll go back to the unassigned pool.
                </>
              ) : (
                <>This will remove the vehicle from this Excursion.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/15 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-500 text-white"
              onClick={performRemoveVehicle}
            >
              Remove Vehicle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear transportation confirm */}
      <AlertDialog open={confirmClearTransport} onOpenChange={setConfirmClearTransport}>
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to no transportation?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              This removes the {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"} you've added and any seat assignments. Youth stay checked in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/15 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-purple-600 hover:bg-purple-500 text-white"
              onClick={handleClearTransport}
            >
              Yes, switch to no transportation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Late-arrival vehicle picker */}
      <AlertDialog open={!!pendingLate} onOpenChange={(open) => !open && setPendingLate(null)}>
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Add {pendingLate?.child_first_name} {pendingLate?.child_last_name}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {transportRequired === true
                ? "Choose which vehicle they'll ride in. You can also add them without a vehicle for now."
                : "This will check them in to the Excursion."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {transportRequired === true && (
            <div className="space-y-2 my-2">
              {vehicles.length === 0 ? (
                <p className="text-yellow-300/80 text-sm">
                  No vehicles added yet. They'll be checked in but not assigned.
                </p>
              ) : (
                vehicles.map((v) => {
                  const full = v.assigned_count >= v.seat_cap;
                  return (
                    <button
                      key={v.id}
                      disabled={full}
                      onClick={() => handleAddLateArrival(v.id)}
                      className="w-full flex items-center justify-between rounded-lg bg-white/[0.04] hover:bg-purple-500/10 border border-white/10 hover:border-purple-400/40 px-4 py-3 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="font-semibold flex items-center gap-2">
                        <Truck className="w-4 h-4 text-purple-300" /> {v.name}
                      </span>
                      <span className="text-xs text-white/50 tabular-nums">
                        {v.assigned_count}/{v.seat_cap}
                        {full ? " full" : ""}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/15 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            {(transportRequired === false || vehicles.length === 0) && (
              <AlertDialogAction
                className="bg-purple-600 hover:bg-purple-500 text-white"
                onClick={() => handleAddLateArrival(null)}
              >
                Add to Excursion
              </AlertDialogAction>
            )}
            {transportRequired === true && vehicles.length > 0 && !isLocked && (
              <AlertDialogAction
                className="bg-white/10 hover:bg-white/15 text-white"
                onClick={() => handleAddLateArrival(null)}
              >
                Skip — add without vehicle
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ───── Phase 3 — Confirm Arrival modal ───── */}
      <AlertDialog
        open={confirmArrivalOpen}
        onOpenChange={(open) => {
          setConfirmArrivalOpen(open);
          if (!open) {
            setArrivalNoteMode(false);
            setArrivalNoteInput("");
          }
        }}
      >
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {arrivalNoteMode ? "What happened?" : "Confirm Arrival"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {arrivalNoteMode
                ? "Add a quick note so it's on the record. The arrival time will still be saved."
                : "Are these numbers correct at the destination?"}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {!arrivalNoteMode && (
            <div className="space-y-2 my-3">
              <div className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-white/10 px-4 py-2.5">
                <span className="text-sm text-white/70">Total Youth</span>
                <span className="text-lg font-black tabular-nums">{checkedInCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-white/10 px-4 py-2.5">
                <span className="text-sm text-white/70">Total Drivers</span>
                <span className="text-lg font-black tabular-nums">{vehicles.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-white/10 px-4 py-2.5">
                <span className="text-sm text-white/70">Coaches & Volunteers</span>
                <span className="text-lg font-black tabular-nums">{personnel.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/15 border-2 border-emerald-400/50 px-4 py-3">
                <span className="text-sm font-bold text-emerald-200 uppercase tracking-wider">Total on Trip</span>
                <span className="text-2xl font-black tabular-nums text-emerald-300">
                  {checkedInCount + vehicles.length + personnel.length}
                </span>
              </div>
            </div>
          )}

          {arrivalNoteMode && (
            <Input
              value={arrivalNoteInput}
              onChange={(e) => setArrivalNoteInput(e.target.value)}
              placeholder="e.g. Maicol left with mom at the park"
              className="my-2 bg-white/5 border-white/15 text-white"
              autoFocus
            />
          )}

          <AlertDialogFooter>
            {!arrivalNoteMode ? (
              <>
                <AlertDialogCancel className="bg-white/5 border-white/15 text-white hover:bg-white/10">
                  Cancel
                </AlertDialogCancel>
                <Button
                  variant="outline"
                  className="border-yellow-400/40 bg-transparent text-yellow-200 hover:bg-yellow-500/10"
                  onClick={() => setArrivalNoteMode(true)}
                >
                  No, count is off
                </Button>
                <AlertDialogAction
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={() => handleConfirmArrival(null)}
                >
                  Yes, all {checkedInCount + vehicles.length + personnel.length} are here
                </AlertDialogAction>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setArrivalNoteMode(false)}
                >
                  Back
                </Button>
                <AlertDialogAction
                  className="bg-purple-600 hover:bg-purple-500 text-white"
                  onClick={() => handleConfirmArrival(arrivalNoteInput.trim() || null)}
                >
                  Save Arrival with Note
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ───── Which vehicle is a newly-added coach/volunteer riding in? ───── */}
      <AlertDialog open={!!pendingPersonnel} onOpenChange={(o) => { if (!o) setPendingPersonnel(null); }}>
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Which vehicle is {pendingPersonnel?.name} riding in?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Put them in a van — they'll take a seat — or mark them as driving separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 my-2">
            {vehicles.map((v) => {
              const full = v.assigned_count >= v.seat_cap;
              return (
                <button
                  key={v.id}
                  disabled={full}
                  onClick={async () => { const pp = pendingPersonnel; setPendingPersonnel(null); if (pp) await handleSetPersonnelVehicle(pp.id, v.id); }}
                  className="w-full flex items-center justify-between rounded-lg bg-white/[0.04] hover:bg-purple-500/10 border border-white/10 hover:border-purple-400/40 px-4 py-3 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="font-semibold flex items-center gap-2"><Truck className="w-4 h-4 text-purple-300" /> {v.name}</span>
                  <span className="text-xs text-white/50 tabular-nums">{v.assigned_count}/{v.seat_cap}{full ? " full" : ""}</span>
                </button>
              );
            })}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/15 text-white hover:bg-white/10">
              Driving separately
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ───── Ride-home choice — pops up right after arrival is confirmed ───── */}
      <AlertDialog open={rideHomeChoiceOpen} onOpenChange={setRideHomeChoiceOpen}>
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>The Ride Home</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Riding home in the same vehicles, or rearranging so each van can cover one area?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid sm:grid-cols-2 gap-3 my-2">
            <button
              onClick={async () => { setRideHomeChoiceOpen(false); await handleSetReturnPlan("same"); }}
              className="rounded-xl border-2 border-white/15 bg-white/5 hover:bg-white/10 p-4 text-left transition"
            >
              <p className="font-bold">Keep the same vehicles</p>
              <p className="text-sm text-white/50 mt-1">Everyone rides home the way they came.</p>
            </button>
            <button
              onClick={async () => { setRideHomeChoiceOpen(false); await handleSetReturnPlan("custom"); }}
              className="rounded-xl border-2 border-purple-400/40 bg-purple-500/10 hover:bg-purple-500/20 p-4 text-left transition"
            >
              <p className="font-bold">Rearrange</p>
              <p className="text-sm text-white/50 mt-1">Move kids between vans — one south, one north, etc.</p>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/15 text-white hover:bg-white/10">Decide later</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ───── Phase 3 — Close Trip modal ───── */}
      <AlertDialog
        open={confirmCloseOpen}
        onOpenChange={(open) => {
          setConfirmCloseOpen(open);
          if (!open) {
            setCloseNoteMode(false);
            setCloseNoteInput("");
          }
        }}
      >
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {closeNoteMode ? "What happened?" : "Close Excursion Trip"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {closeNoteMode
                ? "Add a quick note so it's on the record. The trip will still be closed."
                : "Are all of these back at the gym safely?"}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {!closeNoteMode && (
            <div className="space-y-2 my-3">
              <div className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-white/10 px-4 py-2.5">
                <span className="text-sm text-white/70">Total Youth</span>
                <span className="text-lg font-black tabular-nums">{checkedInCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-white/10 px-4 py-2.5">
                <span className="text-sm text-white/70">Total Drivers</span>
                <span className="text-lg font-black tabular-nums">{vehicles.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-white/10 px-4 py-2.5">
                <span className="text-sm text-white/70">Coaches & Volunteers</span>
                <span className="text-lg font-black tabular-nums">{personnel.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/15 border-2 border-emerald-400/50 px-4 py-3">
                <span className="text-sm font-bold text-emerald-200 uppercase tracking-wider">Total on Trip</span>
                <span className="text-2xl font-black tabular-nums text-emerald-300">
                  {checkedInCount + vehicles.length + personnel.length}
                </span>
              </div>
              <p className="text-xs text-yellow-200/70 mt-2 px-1">
                ⚠ Once closed, the trip is locked in for good.
              </p>
            </div>
          )}

          {closeNoteMode && (
            <Input
              value={closeNoteInput}
              onChange={(e) => setCloseNoteInput(e.target.value)}
              placeholder="e.g. Christopher's parent picked him up at the venue"
              className="my-2 bg-white/5 border-white/15 text-white"
              autoFocus
            />
          )}

          <AlertDialogFooter>
            {!closeNoteMode ? (
              <>
                <AlertDialogCancel className="bg-white/5 border-white/15 text-white hover:bg-white/10">
                  Cancel
                </AlertDialogCancel>
                <Button
                  variant="outline"
                  className="border-yellow-400/40 bg-transparent text-yellow-200 hover:bg-yellow-500/10"
                  onClick={() => setCloseNoteMode(true)}
                >
                  No, count is off
                </Button>
                <AlertDialogAction
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={() => handleConfirmReturn(null)}
                >
                  Yes, close the trip
                </AlertDialogAction>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setCloseNoteMode(false)}
                >
                  Back
                </Button>
                <AlertDialogAction
                  className="bg-purple-600 hover:bg-purple-500 text-white"
                  onClick={() => handleConfirmReturn(closeNoteInput.trim() || null)}
                >
                  Close Trip with Note
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ───── Phase 3 — Edit timestamp modal ───── */}
      <AlertDialog
        open={!!editingTimestamp}
        onOpenChange={(open) => !open && setEditingTimestamp(null)}
      >
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Edit {editingTimestamp === "arrived" ? "Arrival" : "Return"} Time
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Use this if you forgot to tap the button at the right moment. Time is in your local timezone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="datetime-local"
            value={timestampEditValue}
            onChange={(e) => setTimestampEditValue(e.target.value)}
            className="my-2 bg-white/5 border-white/15 text-white"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/15 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={savingTimestamp || !timestampEditValue}
              className="bg-purple-600 hover:bg-purple-500 text-white"
              onClick={handleSaveTimestampEdit}
            >
              {savingTimestamp ? "Saving…" : "Save Time"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════ Guided setup wizard (pop-up) ═══════════ */}
      {wizardOpen && excursion && !isLocked && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col">
          {/* Header — progress dots + dismiss */}
          <div className="shrink-0 border-b border-white/10 px-4 md:px-6 py-3">
            <div className="max-w-2xl mx-auto flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {wizardKeys.map((k, i) => (
                  <span
                    key={k}
                    className={`h-2 rounded-full transition-all ${
                      i === wizardIdx ? "w-6 bg-purple-400" : i < wizardIdx ? "w-2 bg-purple-500/60" : "w-2 bg-white/15"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-purple-300/70 font-semibold ml-1">
                Step {wizardIdx + 1} of {wizardKeys.length}
              </p>
              <button
                onClick={dismissWizard}
                className="ml-auto text-xs text-white/40 hover:text-white/80 underline underline-offset-2"
              >
                Set up manually
              </button>
            </div>
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-black mb-1">{wizardTitle}</h2>

              {/* ── Step: Transportation ── */}
              {safeStepKey === "transport" && (
                <>
                  <p className="text-white/50 mb-6">
                    Is NLA providing rides for this trip?
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => { handleSetTransportRequired(true); setWizardStepKey("vehicles"); }}
                      className={`rounded-2xl border-2 p-6 text-left transition ${transportRequired === true ? "border-purple-400 bg-purple-500/20" : "border-purple-400/40 bg-purple-500/10 hover:bg-purple-500/20"}`}
                    >
                      <Truck className="w-8 h-8 text-purple-300 mb-3" />
                      <p className="text-lg font-bold">Yes, NLA is driving</p>
                      <p className="text-sm text-white/50 mt-1">You'll add vehicles and load youth.</p>
                    </button>
                    <button
                      onClick={() => { handleSetTransportRequired(false); setWizardStepKey("coaches"); }}
                      className={`rounded-2xl border-2 p-6 text-left transition ${transportRequired === false ? "border-white/40 bg-white/10" : "border-white/15 bg-white/5 hover:bg-white/10"}`}
                    >
                      <Home className="w-8 h-8 text-white/60 mb-3" />
                      <p className="text-lg font-bold">No, families drop off</p>
                      <p className="text-sm text-white/50 mt-1">Skip vehicles — just track who's coming.</p>
                    </button>
                  </div>
                </>
              )}

              {/* ── Step: Choose vehicles ── */}
              {safeStepKey === "vehicles" && (
                <>
                  <p className="text-white/50 mb-4">Add every vehicle and who's driving it.</p>
                  {vehicles.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {vehicles.map((v) => (
                        <div key={v.id} className="flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3">
                          <div>
                            <p className="font-bold flex items-center gap-2"><Truck className="w-4 h-4 text-purple-300" />{v.name}</p>
                            <p className="text-xs text-white/50">Driver: {v.driver_name} · {v.seat_cap} seats</p>
                          </div>
                          <button onClick={() => handleRemoveVehicle(v)} className="text-white/40 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {!addingVehicle ? (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {VEHICLE_PRESETS.map((p) => {
                        const Icon = p.icon;
                        return (
                          <button key={p.name} onClick={() => openAddVehicle(p)} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/[0.04] hover:bg-purple-500/10 hover:border-purple-400/40 border border-white/10 p-4 transition">
                            <Icon className="w-6 h-6 text-purple-300" /><span className="text-sm font-bold">{p.name}</span><span className="text-xs text-white/50">{p.seat_cap} seats</span>
                          </button>
                        );
                      })}
                      <button onClick={() => openAddVehicle(null)} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/[0.04] hover:bg-purple-500/10 border border-dashed border-white/20 p-4 transition">
                        <Plus className="w-6 h-6 text-purple-300" /><span className="text-sm font-bold">Other</span><span className="text-xs text-white/50">Custom</span>
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-purple-500/[0.06] border border-purple-400/30 p-4 space-y-3">
                      {addingVehicle.isCustom ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-white/70 text-xs uppercase tracking-wider">Vehicle name</Label>
                            <Input value={customNameInput} onChange={(e) => setCustomNameInput(e.target.value)} placeholder="e.g. Pastor's SUV" className="mt-1 bg-white/5 border-white/15 text-white" />
                          </div>
                          <div>
                            <Label className="text-white/70 text-xs uppercase tracking-wider">Seats (not counting driver)</Label>
                            <Input type="number" min={1} value={customSeatInput} onChange={(e) => setCustomSeatInput(e.target.value)} placeholder="e.g. 4" className="mt-1 bg-white/5 border-white/15 text-white" />
                          </div>
                        </div>
                      ) : (
                        <p className="text-lg font-bold">{addingVehicle.name} <span className="text-white/50 font-medium text-base">• {addingVehicle.seat_cap} seats</span></p>
                      )}
                      <div>
                        <Label className="text-white/70 text-xs uppercase tracking-wider">Driver name</Label>
                        <Input value={driverNameInput} onChange={(e) => setDriverNameInput(e.target.value)} placeholder="e.g. Coach Chris" className="mt-1 bg-white/5 border-white/15 text-white" />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSaveVehicle} disabled={savingVehicle} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold">{savingVehicle ? "Adding…" : "Add Vehicle"}</Button>
                        <Button variant="ghost" onClick={() => setAddingVehicle(null)} className="text-white/50 hover:text-white">Cancel</Button>
                      </div>
                    </div>
                  )}
                  {vehicles.length === 0 && <p className="text-yellow-300/70 text-sm mt-3">Add at least one vehicle to continue.</p>}
                </>
              )}

              {/* ── Step: Load youth ── */}
              {safeStepKey === "load" && (
                <>
                  <p className="text-white/50 mb-3">Tap a youth, then pick their vehicle.</p>
                  <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
                    <span className="rounded-full bg-white/[0.06] border border-white/10 px-3 py-1.5"><b className="tabular-nums">{checkedInCount}</b> checked in</span>
                    <span className="rounded-full bg-purple-500/10 border border-purple-400/30 text-purple-200 px-3 py-1.5"><b className="tabular-nums">{assignedCount} of {checkedInCount}</b> loaded</span>
                    <button onClick={handleManualRefresh} className="text-white/40 hover:text-white/80 inline-flex items-center gap-1 text-xs"><RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh</button>
                  </div>
                  <p className="text-xs text-white/40 mb-4">Kids can still be checking in at the kiosk — wait for stragglers before you submit.</p>
                  {unassignedYouth.length === 0 ? (
                    <p className="text-emerald-300 font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Everyone's loaded!</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {unassignedYouth.map((y) => (
                        <Popover key={y.registration_id}>
                          <PopoverTrigger asChild disabled={vehicles.length === 0}>
                            <button disabled={vehicles.length === 0} className="group flex items-center gap-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-3 py-1.5 transition disabled:opacity-50">
                              <span className="w-7 h-7 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-xs font-bold text-white/60">{getHeadshotUrl(y.child_headshot_url) ? <img src={getHeadshotUrl(y.child_headshot_url)!} alt="" className="w-full h-full object-cover" /> : y.child_first_name[0]}</span>
                              <span className="text-sm font-semibold pr-1">{y.child_first_name} {y.child_last_name}</span>
                              <Plus className="w-4 h-4 text-purple-300" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 bg-neutral-900 border-white/10 text-white p-2 z-[60]">
                            <p className="text-xs text-white/50 px-2 py-1.5 font-semibold uppercase tracking-wider">Assign to vehicle</p>
                            <div className="space-y-1">
                              {vehicles.map((v) => {
                                const full = v.assigned_count >= v.seat_cap;
                                return (
                                  <button key={v.id} disabled={full} onClick={() => handleAssign(y.registration_id, v.id)} className="w-full text-left flex items-center justify-between rounded-md px-3 py-2 hover:bg-white/10 disabled:opacity-40">
                                    <span className="font-semibold text-sm">{v.name}</span>
                                    <span className="text-xs text-white/50 tabular-nums">{v.assigned_count}/{v.seat_cap}{full ? " full" : ""}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ))}
                    </div>
                  )}
                  {vehicles.length === 0 && <p className="text-yellow-300/70 text-sm mt-3">Go back and add a vehicle first.</p>}
                  <div className="mt-6 space-y-2">
                    {vehicles.map((v) => {
                      const kids = youth.filter((y) => y.vehicle_id === v.id);
                      return (
                        <div key={v.id} className="rounded-xl bg-white/[0.03] border border-white/10 p-3">
                          <p className="text-sm font-bold flex items-center gap-2"><Truck className="w-4 h-4 text-purple-300" />{v.name} <span className="text-white/40 font-medium">· {v.assigned_count}/{v.seat_cap}</span></p>
                          {kids.length === 0 ? <p className="text-xs text-white/30 italic mt-1">Empty</p> : (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {kids.map((y) => (
                                <span key={y.registration_id} className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 border border-purple-400/30 pl-2 pr-1 py-0.5 text-xs">
                                  {y.child_first_name} {y.child_last_name}
                                  <button onClick={() => handleUnassign(y.registration_id)} className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white"><X className="w-3 h-3" /></button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── Step: Coaches & volunteers ── */}
              {safeStepKey === "coaches" && (
                <>
                  <p className="text-white/50 mb-4">Add NLA staff and volunteers riding along (not driving).</p>
                  {personnel.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {personnel.map((p) => (
                        <PersonnelChip
                          key={p.id}
                          p={p}
                          vehicles={vehicles}
                          editable
                          showVehicle={transportRequired === true && vehicles.length > 0}
                          onSetVehicle={(vid) => handleSetPersonnelVehicle(p.id, vid)}
                          onRemove={() => handleRemovePersonnel(p.id)}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input value={personnelInput} onChange={(e) => setPersonnelInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAddPersonnel(); }} placeholder="Add a name and press Enter" className="bg-white/5 border-white/15 text-white" />
                    <Button onClick={handleAddPersonnel} disabled={savingPersonnel || !personnelInput.trim()} className="bg-purple-600 hover:bg-purple-500 text-white font-bold"><Plus className="w-4 h-4 mr-1" /> Add</Button>
                  </div>
                  <p className="text-xs text-white/40 mt-3">Optional — you can add people later too.</p>
                </>
              )}

              {/* ── Step: Anyone missing? ── */}
              {safeStepKey === "missing" && (
                <>
                  <p className="text-white/50 mb-4">Search for anyone who couldn't use the kiosk and add them.</p>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <Input value={lateSearch} onChange={(e) => setLateSearch(e.target.value)} placeholder="Type a name to search…" className="pl-9 bg-white/5 border-white/15 text-white" />
                  </div>
                  {lateSearching && <p className="text-white/40 text-sm">Searching…</p>}
                  {!lateSearching && lateSearch.trim().length >= 2 && lateResults.length === 0 && <p className="text-white/40 text-sm">No youth found.</p>}
                  {lateResults.length > 0 && (
                    <div className="space-y-2">
                      {lateResults.map((r) => {
                        const alreadyIn = youth.some((y) => y.registration_id === r.id);
                        return (
                          <div key={r.id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/10 p-3">
                            <span className="w-10 h-10 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-sm font-bold text-white/60 shrink-0">{getHeadshotUrl(r.child_headshot_url) ? <img src={getHeadshotUrl(r.child_headshot_url)!} alt="" className="w-full h-full object-cover" /> : r.child_first_name[0]}</span>
                            <div className="flex-1 min-w-0"><p className="font-semibold truncate">{r.child_first_name} {r.child_last_name}</p><p className="text-xs text-white/40 truncate">{r.child_boxing_program}</p></div>
                            {alreadyIn ? <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> On roster</span> : <Button size="sm" onClick={() => setPendingLate(r)} className="bg-purple-600 hover:bg-purple-500 text-white font-bold"><Plus className="w-4 h-4 mr-1" /> Add</Button>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-white/40 mt-3">Optional — you can also add late arrivals after submitting.</p>
                </>
              )}

              {/* ── Step: Review & submit ── */}
              {safeStepKey === "review" && (
                <>
                  <p className="text-white/50 mb-4">Last check before you lock it in.</p>
                  {transportRequired === true && unassignedYouth.length > 0 && (
                    <div className="rounded-xl bg-yellow-500/10 border-2 border-yellow-400/40 p-4 mb-4">
                      <p className="font-bold text-yellow-200">⚠ {unassignedYouth.length} youth not in a vehicle</p>
                      <p className="text-sm text-yellow-100/70 mt-1">{unassignedYouth.map((y) => `${y.child_first_name} ${y.child_last_name}`).join(", ")}</p>
                      <button onClick={() => setWizardStepKey("load")} className="mt-2 text-sm font-semibold text-yellow-200 underline underline-offset-2">← Go back and load them</button>
                    </div>
                  )}
                  {transportRequired === true && vehicles.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-white/50">Who's in each vehicle</p>
                      {vehicles.map((v) => {
                        const kids = youth.filter((y) => y.vehicle_id === v.id);
                        return (
                          <div key={v.id} className="rounded-xl bg-white/[0.03] border border-white/10 p-3">
                            <p className="text-sm font-bold flex items-center gap-2"><Truck className="w-4 h-4 text-purple-300" />{v.name} <span className="text-white/40 font-medium">· {v.driver_name} · {kids.length}/{v.seat_cap}</span></p>
                            <p className="text-sm text-white/70 mt-1">{kids.length ? kids.map((y) => `${y.child_first_name} ${y.child_last_name}`).join(", ") : <span className="text-white/30 italic">Empty</span>}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center rounded-xl bg-white/[0.04] border border-white/10 p-3"><p className="text-2xl font-black tabular-nums">{checkedInCount}</p><p className="text-[10px] uppercase tracking-wider text-white/50">Youth</p></div>
                    <div className="text-center rounded-xl bg-white/[0.04] border border-white/10 p-3"><p className="text-2xl font-black tabular-nums">{vehicles.length}</p><p className="text-[10px] uppercase tracking-wider text-white/50">Drivers</p></div>
                    <div className="text-center rounded-xl bg-white/[0.04] border border-white/10 p-3"><p className="text-2xl font-black tabular-nums">{personnel.length}</p><p className="text-[10px] uppercase tracking-wider text-white/50">Coaches</p></div>
                  </div>
                  <div className="text-center rounded-xl bg-emerald-500/15 border-2 border-emerald-400/50 p-4"><p className="text-4xl font-black text-emerald-300 tabular-nums">{checkedInCount + vehicles.length + personnel.length}</p><p className="text-xs font-bold text-emerald-200/90 uppercase tracking-wider mt-1">Total on Trip</p></div>
                </>
              )}
            </div>
          </div>

          {/* Footer — Back / Continue / Submit */}
          <div className="shrink-0 border-t border-white/10 px-4 md:px-6 py-3">
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
              <Button variant="ghost" disabled={wizardIdx === 0} onClick={gotoPrevStep} className="text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30">
                ← Back
              </Button>
              {safeStepKey === "review" ? (
                <Button onClick={() => setConfirmSubmit(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8">
                  <Lock className="w-4 h-4 mr-2" /> Submit Roster
                </Button>
              ) : !(safeStepKey === "transport" && transportRequired === null) ? (
                <Button
                  onClick={gotoNextStep}
                  disabled={safeStepKey === "vehicles" && vehicles.length === 0}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-8 disabled:opacity-40"
                >
                  Continue →
                </Button>
              ) : (
                <span className="text-xs text-white/40">Pick an option above</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reopen the guide after "Set up manually" — floating button while setup is open. */}
      {!wizardOpen && !isLocked && excursion && pinVerified && (
        <button
          onClick={reopenWizard}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-3 shadow-lg shadow-purple-900/40"
        >
          <Flag className="w-4 h-4" /> Guided setup
        </button>
      )}
    </div>
  );
};

export default ExcursionCoach;
