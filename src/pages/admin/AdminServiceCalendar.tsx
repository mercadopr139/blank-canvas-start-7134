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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ServiceEntryModal from "@/components/admin/ServiceEntryModal";
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, FileText } from "lucide-react";
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

  // Map service logs by date string
  const serviceLogsByDate = useMemo(() => {
    const map: Record<string, ServiceLog> = {};
    serviceLogs.forEach((log) => {
      map[log.service_date] = log;
    });
    return map;
  }, [serviceLogs]);

  const handleDateClick = (date: Date) => {
    if (!selectedClientId) {
      toast({ title: "Please select a client first", variant: "destructive" });
      return;
    }

    const dateStr = format(date, "yyyy-MM-dd");
    const existingLog = serviceLogsByDate[dateStr];

    setSelectedDate(date);
    setEditingLog(existingLog || null);
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

  const handleGeneratePreview = () => {
    const month = currentMonth.getMonth() + 1;
    const year = currentMonth.getFullYear();
    navigate(`/admin/invoices?client=${selectedClientId}&month=${month}&year=${year}&autoGenerate=true`);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-semibold">Service Calendar</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
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
                <SelectTrigger>
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
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="min-w-[160px] text-center font-medium">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {selectedClient && (
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{serviceLogs.length}</span> service days this month
              </div>
              <div className="flex flex-col items-end gap-1">
                <Button
                  onClick={handleGeneratePreview}
                  disabled={serviceLogs.length === 0}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Preview
                </Button>
                {serviceLogs.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    Select at least 1 service day to generate a preview.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Calendar Grid */}
        <div className="bg-background rounded-lg border shadow-sm p-4">
          {clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No clients found.{" "}
              <Link to="/admin/clients" className="text-primary hover:underline">
                Add a client
              </Link>{" "}
              first.
            </div>
          ) : !selectedClientId ? (
            <div className="text-center py-8 text-muted-foreground">
              Select a client to view their service calendar.
            </div>
          ) : (
            <>
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium text-muted-foreground py-2"
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
                  const isServiceDay = !!serviceLogsByDate[dateStr];
                  const isCurrentMonth = isSameMonth(day, currentMonth);

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
                          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                          : "bg-background hover:bg-muted border-border"
                        }
                        ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                      `}
                    >
                      <span>{format(day, "d")}</span>
                      {isServiceDay && serviceLogsByDate[dateStr] && (
                        <span className="text-[10px] opacity-80 leading-tight text-center">
                          {serviceLogsByDate[dateStr].billing_method === "flat_rate" 
                            ? `$${serviceLogsByDate[dateStr].line_total || 0} (Per Day)` 
                            : `$${serviceLogsByDate[dateStr].line_total || 0} (${serviceLogsByDate[dateStr].hours || 0} hrs)`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground mt-4 text-center">
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
            }
          }}
          client={selectedClient}
          date={selectedDate}
          existingLog={editingLog}
          onSuccess={refreshLogs}
        />
      )}
    </div>
  );
}
