import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ServiceEntryModal from "@/components/admin/ServiceEntryModal";
import { Textarea } from "@/components/ui/textarea";
import { programForClient, OVERRIDE_PREFIX, isOverrideNote } from "@/lib/billingPrograms";
import { isHawkPracticeDay } from "@/lib/hawkSquad";
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, FileText, Trash2, Users, Sparkles, AlertTriangle } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  getDay,
  addMonths,
  subMonths,
} from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type ServiceLog = Tables<"service_logs">;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// A month of rows from a partner program's table (hawk_squad_* / bam_*). Those
// tables sit outside the generated types, so the builder is typed by hand —
// same approach the program attendance page uses.
const monthRows = <T,>(table: string, cols: string, dateCol: string, from: string, to: string): Promise<{ data: T[] | null }> =>
  (supabase.from(table as never) as never as {
    select: (c: string) => { gte: (c: string, v: string) => { lte: (c: string, v: string) => Promise<{ data: T[] | null }> } };
  }).select(cols).gte(dateCol, from).lte(dateCol, to);

// Format currency helper
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export default function AdminServiceCalendar() {
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [serviceLogs, setServiceLogs] = useState<ServiceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingLog, setEditingLog] = useState<ServiceLog | null>(null);
  const [existingLogsForDate, setExistingLogsForDate] = useState<ServiceLog[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  // Attendance overlay (only when the client is a partner program).
  const [attendanceByDate, setAttendanceByDate] = useState<Record<string, number>>({});
  const [practiceOverrides, setPracticeOverrides] = useState<Record<string, boolean>>({});
  const [filling, setFilling] = useState(false);
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const { toast } = useToast();
  const { signOut } = useAuth();
  const navigate = useNavigate();


  // Apply URL filters on mount
  useEffect(() => {
    const clientId = searchParams.get("client");
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    if (clientId) {
      setSelectedClientId(clientId);
    }
    if (month && year) {
      setCurrentMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
    }
  }, [searchParams]);

  // Fetch clients on mount
  useEffect(() => {
    const fetchClients = async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("client_name");

      if (error) {
        toast({ title: "Error fetching clients", description: error.message, variant: "destructive" });
      } else {
        setClients(data || []);
        // Only auto-select first client if no URL filter was provided
        if (data && data.length > 0 && !selectedClientId && !searchParams.get("client")) {
          setSelectedClientId(data[0].id);
        }
      }
    };
    fetchClients();
  }, [searchParams]);

  // Fetch service logs when client or month changes
  useEffect(() => {
    if (!selectedClientId) return;

    const fetchServiceLogs = async () => {
      setLoading(true);
      const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("service_logs")
        .select("*")
        .eq("client_id", selectedClientId)
        .gte("service_date", monthStart)
        .lte("service_date", monthEnd);

      if (error) {
        toast({ title: "Error fetching service logs", description: error.message, variant: "destructive" });
      } else {
        setServiceLogs(data || []);
      }
      setLoading(false);
    };
    fetchServiceLogs();
  }, [selectedClientId, currentMonth]);

  // Build calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Pad start with empty days
    const startDay = getDay(monthStart);
    const paddedDays: (Date | null)[] = Array(startDay).fill(null);
    return [...paddedDays, ...days];
  }, [currentMonth]);

  // Map service logs by date string (now stores array of logs per date)
  const serviceLogsByDate = useMemo(() => {
    const map: Record<string, ServiceLog[]> = {};
    serviceLogs.forEach((log) => {
      if (!map[log.service_date]) {
        map[log.service_date] = [];
      }
      map[log.service_date].push(log);
    });
    return map;
  }, [serviceLogs]);

  const handleDateClick = (date: Date) => {
    if (!selectedClientId) {
      toast({ title: "Please select a client first", variant: "destructive" });
      return;
    }

    const dateStr = format(date, "yyyy-MM-dd");
    const existingLogs = serviceLogsByDate[dateStr] || [];

    // A partner-program day with no check-ins: billing it is an override,
    // so ask for the reason instead of opening the normal entry window.
    if (canAutoFill && existingLogs.length === 0 && attendedOn(dateStr) === 0) {
      setOverrideReason("");
      setOverrideFor(dateStr);
      return;
    }

    setSelectedDate(date);
    setExistingLogsForDate(existingLogs);
    setEditingLog(null); // Start in "add new" mode
    setEntryModalOpen(true);
  };

  const refreshLogs = async () => {
    if (!selectedClientId) return;
    const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const { data } = await supabase
      .from("service_logs")
      .select("*")
      .eq("client_id", selectedClientId)
      .gte("service_date", monthStart)
      .lte("service_date", monthEnd);

    setServiceLogs(data || []);
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // ── Attendance overlay ─────────────────────────────────────────────────
  // When the client is a partner program (Cape May Tech → Hawk Squad, Special
  // Services → BAM), lay that program's real check-ins over the billing
  // calendar so a day nobody came can't be invoiced by accident, and a day
  // they did come can't be missed. Billing without attendance is still
  // allowed — a school cancellation you still charge for — but only on
  // purpose, with a reason kept on the entry.
  const linkedProgram = programForClient(selectedClient?.client_name);
  const monthStartStr = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEndStr = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  useEffect(() => {
    if (!linkedProgram) { setAttendanceByDate({}); setPracticeOverrides({}); return; }
    let cancelled = false;
    (async () => {
      const [att, days] = await Promise.all([
        monthRows<{ check_in_date: string }>(linkedProgram.tables.attendance, "check_in_date", "check_in_date", monthStartStr, monthEndStr),
        monthRows<{ date: string; is_practice_day: boolean }>(linkedProgram.tables.practiceDays, "date, is_practice_day", "date", monthStartStr, monthEndStr),
      ]);
      if (cancelled) return;
      const counts: Record<string, number> = {};
      (att.data ?? []).forEach((r) => { counts[r.check_in_date] = (counts[r.check_in_date] ?? 0) + 1; });
      const ov: Record<string, boolean> = {};
      (days.data ?? []).forEach((r) => { ov[r.date] = r.is_practice_day; });
      setAttendanceByDate(counts);
      setPracticeOverrides(ov);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the program, not the config object
  }, [linkedProgram?.key, monthStartStr, monthEndStr]);

  const attendedOn = (d: string) => attendanceByDate[d] ?? 0;
  const scheduledOn = (d: string) =>
    !!linkedProgram && isHawkPracticeDay(d, practiceOverrides, linkedProgram.defaultWeekdays, linkedProgram.scheduleDates);

  // Auto-fill and override write per-day entries at the client's default
  // rate — the same row the entry modal writes. An hourly client needs hours
  // typed in, so those keep the modal.
  const canAutoFill = !!linkedProgram && !!selectedClient && (selectedClient.rate_type ?? "per_day") !== "per_hour";
  const unbilledAttended = useMemo(
    () => Object.keys(attendanceByDate).filter((d) => (attendanceByDate[d] ?? 0) > 0 && !(serviceLogsByDate[d]?.length)).sort(),
    [attendanceByDate, serviceLogsByDate],
  );
  const billedDays = Object.keys(serviceLogsByDate).length;
  const attendedDays = Object.values(attendanceByDate).filter((n) => n > 0).length;
  const overrideDays = Object.values(serviceLogsByDate).filter((logs) => logs.some((l) => isOverrideNote(l.notes))).length;

  const entryFor = (dateStr: string, notes: string) => ({
    client_id: selectedClient!.id,
    service_date: dateStr,
    billing_method: "per_day",
    hours: null,
    flat_amount: selectedClient!.rate_amount ?? 0,
    line_total: selectedClient!.rate_amount ?? 0,
    service_type: selectedClient!.service_description_default || "Service",
    notes,
  });

  const fillFromAttendance = async () => {
    if (!canAutoFill || unbilledAttended.length === 0) return;
    setFilling(true);
    const rows = unbilledAttended.map((d) =>
      entryFor(d, `From attendance: ${attendanceByDate[d]} ${attendanceByDate[d] === 1 ? "student" : "students"} checked in`));
    const { error } = await supabase.from("service_logs").insert(rows);
    setFilling(false);
    if (error) { toast({ title: "Could not add service days", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Added ${rows.length} service ${rows.length === 1 ? "day" : "days"} from attendance` });
    refreshLogs();
  };

  const confirmOverride = async () => {
    if (!overrideFor || !selectedClient) return;
    const reason = overrideReason.trim();
    if (!reason) { toast({ title: "Add a short reason for billing this day", variant: "destructive" }); return; }
    const { error } = await supabase.from("service_logs").insert([entryFor(overrideFor, `${OVERRIDE_PREFIX} ${reason}`)]);
    if (error) { toast({ title: "Could not add the day", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${format(new Date(`${overrideFor}T12:00:00`), "MMM d")} billed by override` });
    setOverrideFor(null);
    setOverrideReason("");
    refreshLogs();
  };

  const handleBack = () => {
    navigate("/admin/finance");
  };

  const handleGeneratePreview = () => {
    const month = currentMonth.getMonth() + 1;
    const year = currentMonth.getFullYear();
    navigate(
      `/admin/finance/invoices?client=${selectedClientId}&month=${month}&year=${year}&autoGenerate=true`,
    );
  };

  const handleClearAllServiceDays = async () => {
    if (!selectedClientId || serviceLogs.length === 0) return;
    
    setIsClearing(true);
    try {
      const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      const { error } = await supabase
        .from("service_logs")
        .delete()
        .eq("client_id", selectedClientId)
        .gte("service_date", monthStart)
        .lte("service_date", monthEnd);

      if (error) throw error;

      toast({ title: `Cleared ${serviceLogs.length} service entries` });
      setServiceLogs([]);
    } catch (error: any) {
      toast({
        title: "Error clearing service days",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-black border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack} className="text-white hover:bg-white/10 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-300" />
              <h1 className="text-xl font-semibold text-white">Service Calendar</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={signOut} className="border-white/10 text-white hover:bg-white/10 hover:text-white">
            Log out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between items-start sm:items-center">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Client Selector */}
            <div className="w-64">
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.client_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month Navigator */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="border-white/10 text-white hover:bg-white/10 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="min-w-[160px] text-center font-medium text-white">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="border-white/10 text-white hover:bg-white/10 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {selectedClient && (
            <div className="flex items-center gap-4">
              <div className="text-sm text-white/50">
                <span className="font-medium text-white">{serviceLogs.length}</span> service days this month
                {linkedProgram && (
                  <div className="text-xs text-white/45 mt-0.5">
                    Checked against <span className="text-white/70">{linkedProgram.name}</span> attendance · {billedDays} billed · {attendedDays} attended
                    {overrideDays > 0 && <> · <span className="text-amber-300">{overrideDays} override</span></>}
                    {unbilledAttended.length > 0 && <> · <span className="text-emerald-300">{unbilledAttended.length} unbilled</span></>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canAutoFill && (
                  <Button
                    variant="outline"
                    onClick={fillFromAttendance}
                    disabled={filling || unbilledAttended.length === 0}
                    title={unbilledAttended.length === 0 ? "Every attended day this month is already billed" : `Add ${unbilledAttended.length} attended ${unbilledAttended.length === 1 ? "day" : "days"} as service days`}
                    className="border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10 hover:text-emerald-100"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Fill from attendance{unbilledAttended.length > 0 && ` (${unbilledAttended.length})`}
                  </Button>
                )}
                {serviceLogs.length > 0 && (
                    <Button
                    variant="outline"
                    onClick={() => setShowClearConfirm(true)}
                    disabled={isClearing}
                    className="text-destructive hover:text-destructive border-white/10 hover:bg-white/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                )}
                <div className="flex flex-col items-end gap-1">
                  <Button
                    onClick={handleGeneratePreview}
                    disabled={serviceLogs.length === 0}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Preview
                  </Button>
                  {serviceLogs.length === 0 && (
                    <span className="text-xs text-white/50">
                      Select at least 1 service day to generate a preview.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Calendar Grid */}
        <div className="bg-white/5 rounded-lg border border-white/10 shadow-sm p-4">
          {clients.length === 0 ? (
            <div className="text-center py-8 text-white/50">
              No clients found.{" "}
              <Link to="/admin/clients" className="text-sky-300 hover:underline">
                Add a client
              </Link>{" "}
              first.
            </div>
          ) : !selectedClientId ? (
            <div className="text-center py-8 text-white/50">
              Select a client to view their service calendar.
            </div>
          ) : (
            <>
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium text-white/50 py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="aspect-square" />;
                  }

                  const dateStr = format(day, "yyyy-MM-dd");
                  const logsForDay = serviceLogsByDate[dateStr] || [];
                  const isServiceDay = logsForDay.length > 0;
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  
                  // Calculate total for the day
                  const dayTotal = logsForDay.reduce((sum, log) => sum + (log.line_total || 0), 0);
                  const entryCount = logsForDay.length;
                  // Attendance overlay for a partner-program client: green =
                  // kids came, amber = a program day nobody came, dim = not a
                  // program day. Billed days keep the sky look on top.
                  const attended = linkedProgram ? attendedOn(dateStr) : 0;
                  const scheduled = linkedProgram ? scheduledOn(dateStr) : false;
                  const overridden = isServiceDay && logsForDay.some((l) => isOverrideNote(l.notes));
                  const look = isServiceDay
                    ? "bg-sky-300 text-black border-sky-300 hover:bg-sky-300/90"
                    : !linkedProgram
                      ? "bg-white/5 hover:bg-white/10 border-white/10 text-white"
                      : attended > 0
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-100 hover:bg-emerald-500/25"
                        : scheduled
                          ? "bg-amber-500/10 border-amber-500/40 text-amber-200 hover:bg-amber-500/20"
                          : "bg-white/[0.02] border-white/[0.06] text-white/30 hover:bg-white/5";
                  const hint = !linkedProgram ? undefined
                    : isServiceDay ? (overridden ? "Billed by override" : "Billed")
                    : attended > 0 ? `${attended} checked in — not billed yet`
                    : scheduled ? `${linkedProgram.name} day with no check-ins — click to bill it by override`
                    : `Not a ${linkedProgram.name} day`;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => handleDateClick(day)}
                      disabled={loading}
                      title={hint}
                      className={`
                        aspect-square rounded-lg border text-sm font-medium transition-all
                        flex flex-col items-center justify-center gap-0.5 relative
                        ${!isCurrentMonth ? "opacity-50" : ""}
                        ${look}
                        ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                      `}
                    >
                      <span>{format(day, "d")}</span>
                      {isServiceDay && (
                        <span className="text-[10px] opacity-80 leading-tight text-center">
                          {formatCurrency(dayTotal)}
                          {entryCount > 1 && ` (${entryCount})`}
                        </span>
                      )}
                      {linkedProgram && attended > 0 && (
                        <span className={`text-[10px] leading-tight inline-flex items-center gap-0.5 ${isServiceDay ? "text-black/70" : "text-emerald-300"}`}>
                          <Users className="w-3 h-3" /> {attended}{!isServiceDay && " · unbilled"}
                        </span>
                      )}
                      {linkedProgram && !isServiceDay && attended === 0 && scheduled && (
                        <span className="text-[10px] leading-tight text-amber-300/90">no check-ins</span>
                      )}
                      {overridden && (
                        <span className="absolute top-1 right-1 text-[9px] font-bold uppercase tracking-wide rounded px-1 bg-amber-400 text-black">override</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {linkedProgram ? (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/50">
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-300 inline-block" /> billed</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/40 border border-emerald-500/60 inline-block" /> attended, not billed</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/50 inline-block" /> {linkedProgram.name} day, no check-ins</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white/[0.04] border border-white/10 inline-block" /> not a program day</span>
                  <span className="w-full text-center text-white/35">Click a day to add or edit an entry. A day with no check-ins asks for a reason before it is billed.</span>
                </div>
              ) : (
                <p className="text-xs text-white/50 mt-4 text-center">
                  Click a date to add or edit a service entry
                </p>
              )}
            </>
          )}
        </div>
      </main>

      {/* Override: bill a partner-program day that has no attendance */}
      <AlertDialog open={!!overrideFor} onOpenChange={(open) => { if (!open) { setOverrideFor(null); setOverrideReason(""); } }}>
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Bill {overrideFor ? format(new Date(`${overrideFor}T12:00:00`), "EEEE, MMMM d") : ""} without attendance?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              No {linkedProgram?.name} check-ins were recorded that day. If the school cancelled but the day is still
              owed under the contract, say why and it will be billed with an &ldquo;override&rdquo; mark on the entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="e.g. School cancelled on short notice — contracted day"
            rows={3}
            className="bg-black/40 border-white/15 text-white"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/15 text-white hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmOverride(); }} className="bg-amber-500 text-black hover:bg-amber-400 font-semibold">
              Bill this day
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Service Entry Modal */}
      {selectedClient && selectedDate && (
        <ServiceEntryModal
          open={entryModalOpen}
          onOpenChange={(open) => {
            setEntryModalOpen(open);
            if (!open) {
              setSelectedDate(null);
              setEditingLog(null);
              setExistingLogsForDate([]);
            }
          }}
          client={selectedClient}
          date={selectedDate}
          existingLog={editingLog}
          existingLogsForDate={existingLogsForDate}
          onEditLog={(log) => setEditingLog(log)}
          onSuccess={refreshLogs}
        />
      )}

      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Service Days?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {serviceLogs.length} service entries for{" "}
              <strong>{selectedClient?.client_name}</strong> in{" "}
              <strong>{format(currentMonth, "MMMM yyyy")}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllServiceDays}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? "Clearing..." : "Clear All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
