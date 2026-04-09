import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Star, AlertTriangle, Loader2, ArrowUp, ArrowDown, Baby, Send, CheckCircle2, UserPlus, ArrowLeft,
} from "lucide-react";
import DriverAddYouthSheet from "@/components/transport/DriverAddYouthSheet";

interface YouthProfile {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  pickup_zone: string;
}

interface AttendanceState {
  picked_up: boolean;
  dropped_off: boolean;
}

export default function TransportRun() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [runId, setRunId] = useState("");
  const [routeName, setRouteName] = useState("");
  const [runType, setRunType] = useState("");
  const [driverId, setDriverId] = useState("");
  const [driverName, setDriverName] = useState("");

  const [youth, setYouth] = useState<YouthProfile[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceState>>({});
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentText, setIncidentText] = useState("");
  const [incidentYouth, setIncidentYouth] = useState("");
  const [submittingIncident, setSubmittingIncident] = useState(false);

  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submittingTrip, setSubmittingTrip] = useState(false);
  const [addYouthOpen, setAddYouthOpen] = useState(false);
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);
  const [cancellingRun, setCancellingRun] = useState(false);

  useEffect(() => {
    const runSession = sessionStorage.getItem("transport_run");
    const driverSession = sessionStorage.getItem("transport_driver");
    if (!runSession || !driverSession) {
      navigate("/transport", { replace: true });
      return;
    }
    const run = JSON.parse(runSession);
    const driver = JSON.parse(driverSession);
    setRunId(run.run_id);
    setRouteName(run.route_name);
    setRunType(run.run_type);
    setDriverId(driver.id);
    setDriverName(driver.name);

    loadYouth(run.route_name);
    loadStarred();
  }, []);

  const loadStarred = () => {
    try {
      const saved = localStorage.getItem("transport_starred_youth");
      if (saved) setStarred(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }
  };

  const loadYouth = async (route: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/get-run-youth`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ route_name: route }),
      });
      if (res.ok) {
        const data = await res.json();
        setYouth(data.youth || []);
      }
    } catch {
      toast({ title: "Failed to load youth", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleStar = (id: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("transport_starred_youth", JSON.stringify([...next]));
      return next;
    });
  };

  const apiCall = useCallback(async (path: string, body: Record<string, unknown>) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    return fetch(`${supabaseUrl}/functions/v1/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify(body),
    });
  }, []);

  const toggleAttendance = async (youthId: string, status: "picked_up" | "dropped_off") => {
    const current = attendance[youthId] || { picked_up: false, dropped_off: false };
    const newVal = !current[status];

    setAttendance((prev) => ({
      ...prev,
      [youthId]: { ...current, [status]: newVal },
    }));

    try {
      await apiCall("record-transport-attendance", { run_id: runId, youth_id: youthId, status });
    } catch {
      setAttendance((prev) => ({
        ...prev,
        [youthId]: current,
      }));
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleReportIncident = async () => {
    if (!incidentText.trim()) return;
    setSubmittingIncident(true);
    try {
      const res = await apiCall("report-transport-incident", {
        run_id: runId, driver_id: driverId,
        youth_id: incidentYouth || null, description: incidentText,
      });
      if (res.ok) {
        toast({ title: "Incident reported" });
        setIncidentOpen(false);
        setIncidentText("");
        setIncidentYouth("");
      } else {
        toast({ title: "Failed to report incident", variant: "destructive" });
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setSubmittingIncident(false);
    }
  };

  const tripSummary = useMemo(() => {
    const pickUpOnly: YouthProfile[] = [];
    const dropOffOnly: YouthProfile[] = [];
    const both: YouthProfile[] = [];
    const noStatus: YouthProfile[] = [];

    youth.forEach((y) => {
      const att = attendance[y.id] || { picked_up: false, dropped_off: false };
      if (att.picked_up && att.dropped_off) both.push(y);
      else if (att.picked_up) pickUpOnly.push(y);
      else if (att.dropped_off) dropOffOnly.push(y);
      else noStatus.push(y);
    });

    return { pickUpOnly, dropOffOnly, both, noStatus };
  }, [youth, attendance]);

  const confirmSubmitTrip = async () => {
    setSubmittingTrip(true);
    try {
      const res = await apiCall("close-transport-run", { run_id: runId });
      if (res.ok) {
        sessionStorage.removeItem("transport_run");
        toast({ title: "Trip submitted successfully" });
        navigate("/transport/dashboard", { replace: true });
      } else {
        toast({ title: "Failed to submit trip", variant: "destructive" });
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setSubmittingTrip(false);
    }
  };

  const handleCancelRun = async () => {
    setCancellingRun(true);
    try {
      // Delete the in-progress run and its associated data
      await apiCall("close-transport-run", { run_id: runId, cancel: true });
      sessionStorage.removeItem("transport_run");
      navigate("/transport/dashboard", { replace: true });
    } catch {
      toast({ title: "Failed to cancel trip", variant: "destructive" });
    } finally {
      setCancellingRun(false);
    }
  };

  const getPhotoUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/registration-signatures/${url}`;
  };

  const filtered = youth
    .filter((y) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return y.first_name.toLowerCase().includes(q) || y.last_name.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const aStarred = starred.has(a.id) ? 0 : 1;
      const bStarred = starred.has(b.id) ? 0 : 1;
      if (aStarred !== bStarred) return aStarred - bStarred;
      return a.last_name.localeCompare(b.last_name);
    });

  const pickedUpCount = Object.values(attendance).filter((a) => a.picked_up).length;
  const droppedOffCount = Object.values(attendance).filter((a) => a.dropped_off).length;
  const noStatusCount = youth.filter((y) => {
    const att = attendance[y.id];
    return !att || (!att.picked_up && !att.dropped_off);
  }).length;

  const markedCount = runType === "pickup" ? pickedUpCount : droppedOffCount;
  const canSubmit = markedCount > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header - no timer */}
      <header className="bg-[#0F1D32] border-b border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setBackConfirmOpen(true)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 hover:text-white transition-colors active:scale-95 touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
            runType === "pickup"
              ? "bg-green-600/20 text-green-400 border border-green-500/30"
              : "bg-amber-600/20 text-amber-400 border border-amber-500/30"
          }`}>
            {runType}
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">{routeName}</p>
            <p className="text-white/40 text-xs">{driverName}</p>
          </div>
        </div>
        <button
          onClick={() => setAddYouthOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-medium transition-colors active:scale-95 touch-manipulation shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Add Youth
        </button>
      </header>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search youth..."
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11"
          />
        </div>
      </div>

      {/* Youth Grid */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((y) => {
            const att = attendance[y.id] || { picked_up: false, dropped_off: false };
            const isStarred = starred.has(y.id);
            const photoUrl = getPhotoUrl(y.photo_url);
            const isMarked = runType === "pickup" ? att.picked_up : att.dropped_off;

            return (
              <div
                key={y.id}
                className={`relative rounded-2xl border-2 p-3 transition-all ${
                  isMarked
                    ? runType === "pickup"
                      ? "border-red-500/30 bg-red-500/5"
                      : "border-green-500/30 bg-green-500/5"
                    : "border-white/10 bg-white/5"
                }`}
              >
                {/* Star */}
                <button
                  onClick={() => toggleStar(y.id)}
                  className="absolute top-2 right-2 z-10 touch-manipulation p-1"
                >
                  <Star
                    className={`w-4 h-4 transition-colors ${
                      isStarred ? "text-yellow-400 fill-yellow-400" : "text-white/20"
                    }`}
                  />
                </button>

                {/* Photo */}
                <div className="w-full aspect-square rounded-xl bg-white/10 overflow-hidden mb-2 flex items-center justify-center">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={`${y.first_name} ${y.last_name}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  ) : null}
                  <span className={`text-2xl font-bold text-white/20 ${photoUrl ? "hidden" : ""}`}>
                    {y.first_name[0]}{y.last_name[0]}
                  </span>
                </div>

                {/* Name */}
                <p className="text-white text-sm font-medium text-center truncate mb-2">
                  {y.first_name} {y.last_name[0]}.
                </p>

                {/* Action Button - single based on run type */}
                <div>
                  {runType === "pickup" ? (
                    <button
                      onClick={() => toggleAttendance(y.id, "picked_up")}
                      className={`w-full py-2.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 touch-manipulation ${
                        att.picked_up
                          ? "bg-[#DC2626] text-white"
                          : "bg-white/10 text-white/50"
                      }`}
                    >
                      <ArrowUp className="w-3 h-3" />
                      Pick-Up
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleAttendance(y.id, "dropped_off")}
                      className={`w-full py-2.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 touch-manipulation ${
                        att.dropped_off
                          ? "bg-green-600 text-white"
                          : "bg-white/10 text-white/50"
                      }`}
                    >
                      <ArrowDown className="w-3 h-3" />
                      Drop-Off
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-white/30 text-center py-12 flex flex-col items-center gap-2">
            <Baby className="w-8 h-8" />
            <p>No youth found</p>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="sticky bottom-0 bg-[#0F1D32] border-t border-white/10 px-4 py-3 space-y-3">
        {/* Stats */}
        <div className="flex items-center justify-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${runType === "pickup" ? "bg-[#DC2626]" : "bg-green-500"}`} />
            <span className="text-white/60">{runType === "pickup" ? "Pick-Ups" : "Drop-Offs"}: <strong className="text-white">{markedCount}</strong></span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white/30" />
            <span className="text-white/60">Pending: <strong className="text-white">{noStatusCount}</strong></span>
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setIncidentOpen(true)}
            className="flex-1 py-3 rounded-xl bg-[#DC2626]/20 border border-[#DC2626]/40 text-[#DC2626] font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] touch-manipulation"
          >
            <AlertTriangle className="w-4 h-4" />
            Incident
          </button>
          <button
            onClick={() => canSubmit && setSubmitConfirmOpen(true)}
            disabled={!canSubmit}
            className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] touch-manipulation ${
              canSubmit
                ? "bg-[#1B3A5C] border border-[#2563EB]/40 text-white"
                : "bg-white/5 border border-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            <Send className="w-4 h-4" />
            Submit Trip
          </button>
        </div>
      </div>

      {/* Incident Modal */}
      <Dialog open={incidentOpen} onOpenChange={setIncidentOpen}>
        <DialogContent className="bg-[#111827] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
              Report Incident
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-white/70 text-sm">Youth (optional)</label>
              <Select value={incidentYouth} onValueChange={setIncidentYouth}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select youth..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific youth</SelectItem>
                  {youth.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.first_name} {y.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-white/70 text-sm">Description *</label>
              <Textarea
                value={incidentText}
                onChange={(e) => setIncidentText(e.target.value)}
                className="bg-white/5 border-white/10 text-white resize-none"
                rows={4}
                placeholder="Describe the incident..."
              />
            </div>
            <Button
              onClick={handleReportIncident}
              disabled={submittingIncident || !incidentText.trim()}
              className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white"
            >
              {submittingIncident ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Submit Trip Confirmation Modal */}
      <Dialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
        <DialogContent className="bg-[#111827] border-white/10 text-white max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Trip Summary
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-white/50 text-sm">Review before submitting:</p>

            {/* Pick-Up Only */}
            {tripSummary.pickUpOnly.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[#DC2626] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowUp className="w-3 h-3" />
                  Pick-Up Only ({tripSummary.pickUpOnly.length})
                </p>
                <div className="bg-white/5 rounded-lg p-2.5 space-y-1">
                  {tripSummary.pickUpOnly.map((y) => (
                    <p key={y.id} className="text-white/80 text-sm">{y.first_name} {y.last_name}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Drop-Off Only */}
            {tripSummary.dropOffOnly.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-green-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowDown className="w-3 h-3" />
                  Drop-Off Only ({tripSummary.dropOffOnly.length})
                </p>
                <div className="bg-white/5 rounded-lg p-2.5 space-y-1">
                  {tripSummary.dropOffOnly.map((y) => (
                    <p key={y.id} className="text-white/80 text-sm">{y.first_name} {y.last_name}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Both */}
            {tripSummary.both.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-blue-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Pick-Up & Drop-Off ({tripSummary.both.length})
                </p>
                <div className="bg-white/5 rounded-lg p-2.5 space-y-1">
                  {tripSummary.both.map((y) => (
                    <p key={y.id} className="text-white/80 text-sm">{y.first_name} {y.last_name}</p>
                  ))}
                </div>
              </div>
            )}

            {/* No Status */}
            {tripSummary.noStatus.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-amber-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" />
                  No Status ({tripSummary.noStatus.length})
                </p>
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 space-y-1">
                  {tripSummary.noStatus.map((y) => (
                    <p key={y.id} className="text-white/60 text-sm">{y.first_name} {y.last_name}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setSubmitConfirmOpen(false)}
                className="flex-1 border-white/20 text-white hover:bg-white/10 bg-transparent"
              >
                Go Back
              </Button>
              <Button
                onClick={confirmSubmitTrip}
                disabled={submittingTrip}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {submittingTrip ? "Submitting..." : "Confirm & Submit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Back Confirm Modal */}
      <Dialog open={backConfirmOpen} onOpenChange={setBackConfirmOpen}>
        <DialogContent className="bg-[#111827] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Cancel Trip?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-white/60 text-sm">Are you sure? This will cancel the current trip and no data will be saved.</p>
            <div className="flex gap-3">
              <Button
                onClick={() => setBackConfirmOpen(false)}
                className="flex-1 border border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                Stay
              </Button>
              <Button
                onClick={handleCancelRun}
                disabled={cancellingRun}
                className="flex-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white"
              >
                {cancellingRun ? "Cancelling..." : "Go Back"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Youth Sheet */}
      <DriverAddYouthSheet
        open={addYouthOpen}
        onOpenChange={setAddYouthOpen}
        routeName={routeName}
        onYouthAdded={(newYouth) => {
          setYouth((prev) => {
            if (prev.some((y) => y.id === newYouth.id)) return prev;
            return [...prev, newYouth];
          });
        }}
      />
    </div>
  );
}
