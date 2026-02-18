import { useState, useEffect, useMemo, useRef } from "react";
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
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, FileText, Trash2 } from "lucide-react";
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

// Format currency helper
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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

  const { toast } = useToast();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  // Keep latest values for cleanup (avoid stale closures)
  const selectedClientIdRef = useRef<string>("");
  const currentMonthRef = useRef<Date>(new Date());
  const navigatingAwayRef = useRef(false);

  useEffect(() => {
    selectedClientIdRef.current = selectedClientId;
    currentMonthRef.current = currentMonth;
  }, [selectedClientId, currentMonth]);

  // Auto-clear service days when leaving this screen (unmount).
  // Skip if we're navigating to Generate Preview (it handles its own clear).
  useEffect(() => {
    return () => {
      if (navigatingAwayRef.current) return;

      const clientId = selectedClientIdRef.current;
      const monthDate = currentMonthRef.current;

      if (!clientId) return;

      const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");

      void supabase
        .from("service_logs")
        .delete()
        .eq("client_id", clientId)
        .gte("service_date", monthStart)
        .lte("service_date", monthEnd);
    };
  }, []);

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

  const clearServiceDaysForCurrentMonth = async () => {
    const clientId = selectedClientIdRef.current || selectedClientId;
    const monthDate = currentMonthRef.current || currentMonth;

    if (!clientId) return;

    const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");

    const { error } = await supabase
      .from("service_logs")
      .delete()
      .eq("client_id", clientId)
      .gte("service_date", monthStart)
      .lte("service_date", monthEnd);

    if (error) {
      console.error("[ServiceCalendar] auto-clear failed", error);
    }
  };

  const handleBack = async () => {
    // Mark that we're navigating away so unmount cleanup doesn't double-delete
    navigatingAwayRef.current = true;
    // Clear service days first so the next time you open the calendar you don't see stale boxes.
    try {
      await clearServiceDaysForCurrentMonth();
    } finally {
      navigate("/admin/invoices");
    }
  };

  const handleGeneratePreview = () => {
    // Mark that we're navigating away so unmount cleanup doesn't run
    navigatingAwayRef.current = true;
    const month = currentMonth.getMonth() + 1;
    const year = currentMonth.getFullYear();
    navigate(
      `/admin/invoices?client=${selectedClientId}&month=${month}&year=${year}&autoGenerate=true&clearServiceDays=true`,
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
              </div>
              <div className="flex items-center gap-2">
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

                  return (
                    <button
                      key={dateStr}
                      onClick={() => handleDateClick(day)}
                      disabled={loading}
                      className={`
                        aspect-square rounded-lg border text-sm font-medium transition-all
                        flex flex-col items-center justify-center gap-0.5
                        ${!isCurrentMonth ? "opacity-50" : ""}
                        ${isServiceDay
                          ? "bg-sky-300 text-black border-sky-300 hover:bg-sky-300/90"
                          : "bg-white/5 hover:bg-white/10 border-white/10 text-white"
                        }
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
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-white/50 mt-4 text-center">
                Click a date to add or edit a service entry
              </p>
            </>
          )}
        </div>
      </main>

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
