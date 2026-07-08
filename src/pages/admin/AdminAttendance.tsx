import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Star, Search, AlertTriangle, Users, Eye, ChevronLeft, ChevronRight, CalendarDays,
  Clock, TrendingUp, TrendingDown, School, Lightbulb, Activity, Trash2, X, Pencil, UserPlus, Mail,
  Plus, Truck, Bus, CheckCircle2, Lock, Unlock
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, LabelList, ComposedChart,
} from "recharts";
import {
  startOfMonth, endOfMonth, format,
  addMonths, subMonths, getDay, getDaysInMonth, isToday, parseISO,
  isWeekend, isSameMonth,
} from "date-fns";
import { toast } from "sonner";
import { ExcursionHistorySection } from "@/components/admin/ExcursionHistorySection";
import ExcursionRideComparison from "@/components/admin/ExcursionRideComparison";
import { getProgramYearForRegistration, shortProgramYear } from "@/lib/programYear";

/* ───────── Types ───────── */
interface Registration {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string;
  child_headshot_url: string | null;
  is_bald_eagle: boolean;
  bald_eagle_active: boolean;
  child_sex: string;
  child_school_district: string;
  household_income_range: string;
  free_or_reduced_lunch: string | null;
  child_race_ethnicity: string | null;
  // Raw dropdown answer from the registration form. One of:
  // "Dad and Mom", "Mom + Partner", "Dad + Partner", "Mom Only",
  // "Dad Only", "Grandparent(s)", "Other", or null for legacy rows.
  family_structure: string | null;
  program_year: string | null;
}

interface AttendanceRecord {
  id: string;
  registration_id: string;
  check_in_date: string;
  check_in_at: string;
  program_source: string;
  is_manual: boolean;
  excursion_id?: string | null;
}

interface PracticeDay {
  id: string;
  date: string;
  is_practice_day: boolean;
}

interface Excursion {
  id: string;
  date: string;
  name: string;
  youth_count: number;
  notes: string | null;
  created_at: string;
  roster_locked_at: string | null;
  arrived_at: string | null;
  returned_at: string | null;
  arrival_note: string | null;
  return_note: string | null;
  return_plan: string | null;
}

type DayType = "practice" | "non-practice" | "excursion";

/** Vehicle quick-add presets for the Edit Excursion modal — mirrors the
 *  same picker available in Coach Mode at /excursion-coach so admin
 *  backfills produce the same vehicle records as live trips. */
const EDIT_VEHICLE_PRESETS: Array<{ name: string; seat_cap: number; icon: typeof Truck }> = [
  { name: "Van A", seat_cap: 14, icon: Truck },
  { name: "Van B", seat_cap: 14, icon: Truck },
  { name: "Mini-Van", seat_cap: 6, icon: Truck },
  { name: "Mini-Bus", seat_cap: 21, icon: Bus },
];

interface WeatherDay {
  date: string;
  temp_high: number | null;
  temp_low: number | null;
  /** Full 24-hour precipitation total, in inches. Powers the calendar tooltip. */
  precipitation: number | null;
  /** Sum of hourly precipitation between local 8:00 and 19:00 inclusive.
   *  Powers the rainy-day classification used by the chart correlation panel
   *  and the insights bullets. Overnight rain that cleared by morning is
   *  excluded — a day with 0.4" overnight and 0" daytime reads as dry here. */
  precipitation_8am_8pm: number | null;
  condition: string;
  condition_code: number | null;
}

const POVERTY_INCOMES = ["Under $25,000", "Less than $25,000", "Less than $35,000"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ───── Weather helpers ───── */
const WMO_MAP: Record<number, { label: string; emoji: string }> = {
  0: { label: "Sunny", emoji: "☀️" },
  1: { label: "Mostly Sunny", emoji: "🌤️" },
  2: { label: "Partly Cloudy", emoji: "⛅" },
  3: { label: "Cloudy", emoji: "☁️" },
  45: { label: "Foggy", emoji: "🌫️" },
  48: { label: "Foggy", emoji: "🌫️" },
  51: { label: "Light Drizzle", emoji: "🌦️" },
  53: { label: "Drizzle", emoji: "🌦️" },
  55: { label: "Heavy Drizzle", emoji: "🌧️" },
  61: { label: "Light Rain", emoji: "🌧️" },
  63: { label: "Rainy", emoji: "🌧️" },
  65: { label: "Heavy Rain", emoji: "🌧️" },
  66: { label: "Freezing Rain", emoji: "🌧️" },
  67: { label: "Freezing Rain", emoji: "🌧️" },
  71: { label: "Light Snow", emoji: "🌨️" },
  73: { label: "Snowy", emoji: "❄️" },
  75: { label: "Heavy Snow", emoji: "❄️" },
  77: { label: "Snow Grains", emoji: "❄️" },
  80: { label: "Rain Showers", emoji: "🌧️" },
  81: { label: "Rain Showers", emoji: "🌧️" },
  82: { label: "Heavy Showers", emoji: "🌧️" },
  85: { label: "Snow Showers", emoji: "🌨️" },
  86: { label: "Heavy Snow Showers", emoji: "❄️" },
  95: { label: "Stormy", emoji: "🌩️" },
  96: { label: "Stormy w/ Hail", emoji: "🌩️" },
  99: { label: "Stormy w/ Hail", emoji: "🌩️" },
};

const getWeatherInfo = (code: number | null) => {
  if (code === null) return { label: "Unknown", emoji: "❓" };
  return WMO_MAP[code] || { label: "Unknown", emoji: "❓" };
};



/* ── Weather-day classification ──
 *  Single set of rules used by the chart correlation panel AND the
 *  insights bullets so the two never disagree.
 *
 *  Rainy: actually measured precipitation ≥ 0.1". A "Drizzle" WMO code with
 *         zero recorded precip should not count as a rainy day for our
 *         purposes (kids walked to practice in fine weather).
 *  Sunny: WMO code 0–1 AND no measured precip. Excludes partly-cloudy.
 *  Cold:  absolute threshold (50°F). Bottom-quartile relative thresholds
 *         produced misleading "Coldest days below 78°F" insights in summer.
 */
const RAIN_THRESHOLD_IN = 0.1;
const COLD_THRESHOLD_F = 50;
const MIN_DAYS_PER_BUCKET = 4; // insights need at least N days per side to surface

// Rainy / sunny classification reads the 8am-8pm window total, not the
// full 24-hour total — so overnight rain that cleared by morning doesn't
// count against attendance. Falls back to the full-day total only when
// the windowed value is missing (legacy cached rows pre-migration).
const dayPrecip = (w: { precipitation: number | null; precipitation_8am_8pm: number | null }): number =>
  w.precipitation_8am_8pm ?? w.precipitation ?? 0;

const isRainyDay = (w: { precipitation: number | null; precipitation_8am_8pm: number | null }): boolean =>
  dayPrecip(w) >= RAIN_THRESHOLD_IN;
const isSunnyDay = (w: { precipitation: number | null; precipitation_8am_8pm: number | null; condition_code: number | null }): boolean =>
  w.condition_code !== null && w.condition_code <= 1 && dayPrecip(w) < RAIN_THRESHOLD_IN;

/* ── Condition buckets ──
 *  Groups raw WMO codes into the categories users actually think in.
 *  Prevents "Snowy" and "Snow Grains" from being treated as different
 *  weather for the "best condition" insight.
 */
const getWeatherBucket = (code: number | null): string | null => {
  if (code === null) return null;
  if (code <= 1) return "Sunny";
  if (code <= 3) return "Cloudy";
  if (code === 45 || code === 48) return "Foggy";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "Rainy";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Snowy";
  if (code >= 95) return "Stormy";
  return null;
};

const now = new Date();
const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

const pct = (n: number, d: number) => (d === 0 ? "0%" : `${Math.round((n / d) * 100)}%`);

/* ───── Helper: is a date a practice day by default (weekday)? ───── */
const isDefaultPracticeDay = (dateStr: string): boolean => {
  const d = parseISO(dateStr);
  return !isWeekend(d);
};

/* ───────── Component ───────── */
const AdminAttendance = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "bald-eagles">("all");
  const [selectedYouth, setSelectedYouth] = useState<Registration | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calendarFilter, setCalendarFilter] = useState<"all" | "bald-eagles">("all");
  const [calendarProgramFilter, setCalendarProgramFilter] = useState<string>("all");
  const [drillDistrictFilter, setDrillDistrictFilter] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; date: string } | null>(null);
  const [daySearch, setDaySearch] = useState("");
  const [addEagleOpen, setAddEagleOpen] = useState(false);
  const [eagleSearch, setEagleSearch] = useState("");
  const [noShowReportRunning, setNoShowReportRunning] = useState(false);
  const [noShowReportDate, setNoShowReportDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [excursionModalOpen, setExcursionModalOpen] = useState(false);
  const [excursionDate, setExcursionDate] = useState<string>("");
  const [excursionName, setExcursionName] = useState("");
  const [excursionNotes, setExcursionNotes] = useState("");
  const [excursionPrevState, setExcursionPrevState] = useState<boolean>(true);
  const [editingExcursion, setEditingExcursion] = useState<Excursion | null>(null);
  const [deleteExcursionTarget, setDeleteExcursionTarget] = useState<Excursion | null>(null);
  // Pending excursion→practice/non-practice conversion. When set, the user
  // chose a non-excursion day type from the context menu on a purple tile;
  // we hold the action behind a confirmation dialog so a single accidental
  // click can't wipe a backfilled trip + its roster + vehicles + personnel.
  const [convertExcursionTarget, setConvertExcursionTarget] = useState<{
    excursion: Excursion;
    targetType: "practice" | "non-practice";
  } | null>(null);

  // ── Interactive Edit Excursion modal: vehicle + youth + personnel controls
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
  const [weatherTooltipDay, setWeatherTooltipDay] = useState<string | null>(null);
  const [contextMenuDay, setContextMenuDay] = useState<{ dateStr: string; x: number; y: number } | null>(null);
  const [noShowAlertDismissed, setNoShowAlertDismissed] = useState(false);
  const [manualAddMode, setManualAddMode] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualAdding, setManualAdding] = useState(false);
  // On an excursion day, whether a manual add goes to practice or the trip.
  const [manualAddTarget, setManualAddTarget] = useState<"practice" | "excursion">("practice");
  const _noShowAlertOpen = false; // reserved for future expansion
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenuDay) return;
    const handler = () => setContextMenuDay(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenuDay]);
  const invalidateAttendance = () => {
    queryClient.invalidateQueries({ queryKey: ["calendar-attendance"] });
    queryClient.invalidateQueries({ queryKey: ["all-attendance-for-profile"] });
    queryClient.invalidateQueries({ queryKey: ["attendance-records-prev"] });
  };

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("attendance_records").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Failed to delete check-in"); return; }
    toast.success(`Removed check-in for ${deleteTarget.name}`);
    setDeleteTarget(null);
    invalidateAttendance();
    // Excursion check-ins live in a separate query — refresh it too, otherwise
    // a deleted excursion sign-in lingers on screen until a reload.
    queryClient.invalidateQueries({ queryKey: ["excursion-attendance-month", calMonthStart, calMonthEnd] });
    queryClient.invalidateQueries({ queryKey: ["excursion-checkin-counts-all"] });
  };

  const getHeadshotUrl = (url: string | null): string | null => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/youth-photos/${url}`;
  };

  const calMonthStart = format(startOfMonth(calendarMonth), "yyyy-MM-dd");
  const calMonthEnd = format(endOfMonth(calendarMonth), "yyyy-MM-dd");

  /* ───── Data Queries ───── */
  // Pull every registration once; scope by program_year client-side via
  // the filter dropdown so switching cohorts is instant (no refetch).
  // Default to the current program year per programYear.ts — flips
  // automatically when the calendar crosses Aug 1.
  const [programYearFilter, setProgramYearFilter] = useState<string>(() => getProgramYearForRegistration());
  const { data: allRegistrations = [] } = useQuery({
    queryKey: ["registrations-attendance-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, child_boxing_program, child_headshot_url, is_bald_eagle, bald_eagle_active, child_sex, child_school_district, household_income_range, free_or_reduced_lunch, child_race_ethnicity, family_structure, program_year")
        .order("child_last_name");
      if (error) throw error;
      return data as Registration[];
    },
  });
  // Distinct program years across all registrations, for the dropdown.
  const availableProgramYears = useMemo(() => {
    const years = new Set<string>();
    allRegistrations.forEach((r) => { if (r.program_year) years.add(r.program_year); });
    return [...years].sort().reverse(); // newest first
  }, [allRegistrations]);
  const registrations = useMemo(() => {
    if (programYearFilter === "__all__") return allRegistrations;
    // Defensive: if the Phase B migration hasn't been applied yet, no row
    // will have program_year set. Treat the filter as a no-op so the page
    // (calendar tile counts, demographic cards, etc.) doesn't go blank.
    const anyTagged = allRegistrations.some((r) => r.program_year);
    if (!anyTagged) return allRegistrations;
    return allRegistrations.filter((r) => r.program_year === programYearFilter);
  }, [allRegistrations, programYearFilter]);

  /* ───── Is viewing current month? ───── */
  const isCurrentMonth = isSameMonth(calendarMonth, now);
  
  const viewedMonthShort = format(calendarMonth, "MMMM");

  // Previous month relative to viewed month (for comparison insights)
  const prevOfViewedStart = format(startOfMonth(subMonths(calendarMonth, 1)), "yyyy-MM-dd");
  const prevOfViewedEnd = format(endOfMonth(subMonths(calendarMonth, 1)), "yyyy-MM-dd");

  // Calendar month attendance (primary data source for everything).
  // Paginated — high-volume months (40-80 check-ins per day × 30 days)
  // can exceed PostgREST's silent 1000-row cap on a single .select(),
  // which previously caused late-month days (e.g. May 29-31) to show
  // a fraction of their real sign-ins on the calendar tile. Same trap
  // the YTD query below explicitly works around.
  const { data: calendarAttendance = [] } = useQuery({
    queryKey: ["calendar-attendance", calMonthStart],
    queryFn: async () => {
      const pageSize = 1000;
      let from = 0;
      const all: AttendanceRecord[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("attendance_records")
          .select("id, registration_id, check_in_date, check_in_at, program_source, is_manual")
          .eq("program_source", "NLA")
          .gte("check_in_date", calMonthStart)
          .lte("check_in_date", calMonthEnd)
          .order("check_in_at", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data || []) as AttendanceRecord[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  // Full Excursion attendance records for the calendar month. Used for
  // both the per-date count on the calendar tile AND the day-detail
  // modal's roster (the main calendarAttendance query is NLA-only).
  // Paginated for the same 1000-row-cap reason as above.
  const { data: excursionAttendanceMonth = [] } = useQuery({
    queryKey: ["excursion-attendance-month", calMonthStart, calMonthEnd],
    queryFn: async () => {
      const pageSize = 1000;
      let from = 0;
      const all: AttendanceRecord[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("attendance_records")
          .select("id, registration_id, check_in_date, check_in_at, program_source, is_manual, excursion_id")
          .eq("program_source", "Excursion")
          .gte("check_in_date", calMonthStart)
          .lte("check_in_date", calMonthEnd)
          .order("check_in_at", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data || []) as AttendanceRecord[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const excursionDailyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    excursionAttendanceMonth.forEach((r) => {
      counts[r.check_in_date] = (counts[r.check_in_date] || 0) + 1;
    });
    return counts;
  }, [excursionAttendanceMonth]);

  // Per-excursion-id actual check-in counts, derived from the same paginated
  // attendance query. Replaces the legacy planning-estimate field
  // (excursions.youth_count) anywhere we render a "youth on this trip" number.
  const excursionCountsById = useMemo(() => {
    const counts: Record<string, number> = {};
    excursionAttendanceMonth.forEach((r) => {
      if (r.excursion_id) counts[r.excursion_id] = (counts[r.excursion_id] || 0) + 1;
    });
    return counts;
  }, [excursionAttendanceMonth]);

  // (Weather data is loaded once via `weatherMap` further down — both the
  // calendar emojis and the chart correlation panel read from that single
  // source so the calendar and chart never disagree on the day's weather.)

  // YTD attendance since the new check-in system launched (March 9, 2026)
  const YTD_START = "2026-03-09";

  const { data: ytdAttendance = [] } = useQuery({
    queryKey: ["attendance-records-ytd", YTD_START],
    queryFn: async () => {
      const pageSize = 1000;
      let from = 0;
      const all: AttendanceRecord[] = [];
      // Paginate because PostgREST caps responses at ~1000 rows regardless of .limit().
      while (true) {
        const { data, error } = await supabase
          .from("attendance_records")
          .select("id, registration_id, check_in_date, check_in_at, program_source, is_manual")
          .eq("program_source", "NLA")
          .gte("check_in_date", YTD_START)
          .order("check_in_date", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data || []) as AttendanceRecord[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const { data: ytdPracticeDays = [] } = useQuery({
    queryKey: ["practice-days-ytd", YTD_START],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_days")
        .select("id, date, is_practice_day")
        .gte("date", YTD_START)
        .limit(10000);
      if (error) throw error;
      return (data || []) as PracticeDay[];
    },
  });

  const { data: ytdExcursions = [] } = useQuery({
    queryKey: ["excursions-ytd", YTD_START],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursions")
        .select("date")
        .gte("date", YTD_START)
        .limit(10000);
      if (error) throw error;
      return data || [];
    },
  });

  // Previous month attendance (for comparison insights). Paginated
  // for the same 1000-row cap reason as the calendar-month query.
  const { data: prevMonthAttendance = [] } = useQuery({
    queryKey: ["attendance-records-prev", prevOfViewedStart],
    queryFn: async () => {
      const pageSize = 1000;
      let from = 0;
      const all: AttendanceRecord[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("attendance_records")
          .select("id, registration_id, check_in_date, check_in_at, program_source, is_manual")
          .eq("program_source", "NLA")
          .gte("check_in_date", prevOfViewedStart)
          .lte("check_in_date", prevOfViewedEnd)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data || []) as AttendanceRecord[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  // Profile attendance
  const { data: allAttendance = [] } = useQuery({
    queryKey: ["all-attendance-for-profile", selectedYouth?.id],
    queryFn: async () => {
      if (!selectedYouth) return [];
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, registration_id, check_in_date, check_in_at, program_source, is_manual")
        .eq("registration_id", selectedYouth.id)
        .order("check_in_date", { ascending: false });
      if (error) throw error;
      return data as AttendanceRecord[];
    },
    enabled: !!selectedYouth,
  });

  // Practice days for calendar month
  const { data: practiceDaysCalMonth = [] } = useQuery({
    queryKey: ["practice-days-cal", calMonthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_days")
        .select("id, date, is_practice_day")
        .gte("date", calMonthStart)
        .lte("date", calMonthEnd);
      if (error) throw error;
      return (data || []) as PracticeDay[];
    },
  });

  // Practice days for previous month
  const { data: practiceDaysPrevMonth = [] } = useQuery({
    queryKey: ["practice-days-prev", prevOfViewedStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_days")
        .select("id, date, is_practice_day")
        .gte("date", prevOfViewedStart)
        .lte("date", prevOfViewedEnd);
      if (error) throw error;
      return (data || []) as PracticeDay[];
    },
  });

  // Excursions for calendar month
  const { data: excursionsCalMonth = [] } = useQuery({
    queryKey: ["excursions-cal", calMonthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursions")
        .select("*")
        .gte("date", calMonthStart)
        .lte("date", calMonthEnd)
        .order("date");
      if (error) throw error;
      return (data || []) as Excursion[];
    },
  });

  // Excursions for previous month (needed to exclude from prev month comparisons)
  const { data: excursionsPrevMonth = [] } = useQuery({
    queryKey: ["excursions-prev", prevOfViewedStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursions")
        .select("*")
        .gte("date", prevOfViewedStart)
        .lte("date", prevOfViewedEnd)
        .order("date");
      if (error) throw error;
      return (data || []) as Excursion[];
    },
  });



  /* ───── Weather Data (Open-Meteo + DB cache) ─────
   *  Single source of truth for both the calendar emojis/tooltips and the
   *  attendance correlation analysis. Cached in weather_data to avoid
   *  re-hitting Open-Meteo on every page load.
   *
   *  Each row stores two precipitation values: the 24-hour total (powers
   *  the tooltip, reads like a normal weather widget) and the 8am-8pm
   *  window total (powers the "rainy practice day" analysis — excludes
   *  overnight rain that cleared by school time).
   */
  const { data: weatherMap = {}, isLoading: weatherLoading } = useQuery({
    queryKey: ["weather-data", calMonthStart],
    queryFn: async () => {
      // 1. Check DB cache first. Any row missing the windowed value is
      //    treated as stale and re-fetched (legacy daily-only rows
      //    from before the schema migration).
      const { data: cached } = await (supabase
        .from("weather_data") as any)
        .select("date, temp_high, temp_low, precipitation, precipitation_8am_8pm, condition, condition_code")
        .eq("location", "rio_grande_nj")
        .gte("date", calMonthStart)
        .lte("date", calMonthEnd);

      const cachedMap: Record<string, WeatherDay> = {};
      (cached || []).forEach((w: any) => {
        if (w.precipitation_8am_8pm !== null) {
          cachedMap[w.date] = w;
        }
      });

      // Check if we have all days
      const daysInMonth = getDaysInMonth(calendarMonth);
      const missingDates: string[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = format(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d), "yyyy-MM-dd");
        if (!cachedMap[ds]) missingDates.push(ds);
      }

      if (missingDates.length === 0) return cachedMap;

      // 2. Fetch from Open-Meteo — split into historical and forecast ranges.
      //    Hourly precipitation comes back as an array keyed by hourly.time
      //    (one ISO string per hour, in the requested timezone). We sum the
      //    hours where hour-of-day is 8..19 inclusive for each date.
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = format(today, "yyyy-MM-dd");
        const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
        const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);

        const params = "daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&hourly=precipitation&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America/New_York&latitude=39.0018&longitude=-74.8774";

        const fetches: Promise<any>[] = [];

        // Historical: month start to min(yesterday, month end)
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (monthStart <= yesterday) {
          const histEnd = monthEnd <= yesterday ? format(monthEnd, "yyyy-MM-dd") : format(yesterday, "yyyy-MM-dd");
          const histStart = format(monthStart, "yyyy-MM-dd");
          fetches.push(
            fetch(`https://archive-api.open-meteo.com/v1/archive?${params}&start_date=${histStart}&end_date=${histEnd}`)
              .then(r => r.ok ? r.json() : null).catch(() => null)
          );
        }

        // Forecast: max(today, month start) to month end (if month end >= today)
        if (monthEnd >= today) {
          const fcastStart = monthStart >= today ? format(monthStart, "yyyy-MM-dd") : todayStr;
          const fcastEnd = format(monthEnd, "yyyy-MM-dd");
          fetches.push(
            fetch(`https://api.open-meteo.com/v1/forecast?${params}&start_date=${fcastStart}&end_date=${fcastEnd}`)
              .then(r => r.ok ? r.json() : null).catch(() => null)
          );
        }

        const results = await Promise.all(fetches);
        const rows: any[] = [];

        for (const json of results) {
          if (!json?.daily?.time) continue;
          const daily = json.daily;

          // Build a date → 8am-8pm precipitation sum from the hourly array.
          // Hourly times are local strings like "2026-03-09T08:00" because
          // we passed timezone=America/New_York to Open-Meteo.
          const windowedByDate: Record<string, number> = {};
          if (json.hourly?.time && Array.isArray(json.hourly.precipitation)) {
            for (let i = 0; i < json.hourly.time.length; i++) {
              const t: string = json.hourly.time[i];
              if (!t || t.length < 13) continue;
              const datePart = t.slice(0, 10);
              const hour = parseInt(t.slice(11, 13), 10);
              if (hour >= 8 && hour <= 19) {
                const p = json.hourly.precipitation[i];
                if (p !== null && p !== undefined) {
                  windowedByDate[datePart] = (windowedByDate[datePart] || 0) + Number(p);
                }
              }
            }
          }

          for (let i = 0; i < daily.time.length; i++) {
            const dateStr = daily.time[i];
            if (cachedMap[dateStr]) continue;
            const code = daily.weather_code?.[i] ?? null;
            const info = getWeatherInfo(code);
            // Round to 2 decimals so the stored value matches what
            // the tooltip displays.
            const windowedRaw = windowedByDate[dateStr];
            const windowed = windowedRaw !== undefined ? Math.round(windowedRaw * 100) / 100 : 0;
            const row = {
              date: dateStr,
              location: "rio_grande_nj",
              temp_high: daily.temperature_2m_max?.[i] ?? null,
              temp_low: daily.temperature_2m_min?.[i] ?? null,
              precipitation: daily.precipitation_sum?.[i] ?? null,
              precipitation_8am_8pm: windowed,
              condition: info.label,
              condition_code: code,
            };
            rows.push(row);
            cachedMap[dateStr] = row as WeatherDay;
          }
        }

        // Save to DB (fire and forget)
        if (rows.length > 0) {
          (supabase.from("weather_data") as any).upsert(rows, { onConflict: "date,location" }).then();
        }
      } catch (e) {
        console.warn("Weather fetch failed:", e);
      }

      return cachedMap;
    },
    staleTime: 1000 * 60 * 30, // 30 min cache
  });

  const calPracticeDayMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    practiceDaysCalMonth.forEach((p) => { m[p.date] = p.is_practice_day; });
    return m;
  }, [practiceDaysCalMonth]);

  const prevPracticeDayMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    practiceDaysPrevMonth.forEach((p) => { m[p.date] = p.is_practice_day; });
    return m;
  }, [practiceDaysPrevMonth]);

  const isPracticeDay = useCallback((dateStr: string, map: Record<string, boolean>): boolean => {
    if (dateStr in map) return map[dateStr];
    return isDefaultPracticeDay(dateStr);
  }, []);

  /* ───── Excursion maps ───── */
  const excursionDayMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    excursionsCalMonth.forEach((e) => { m[e.date] = true; });
    return m;
  }, [excursionsCalMonth]);

  const prevExcursionDayMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    excursionsPrevMonth.forEach((e) => { m[e.date] = true; });
    return m;
  }, [excursionsPrevMonth]);

  const isExcursionDay = useCallback((dateStr: string): boolean => {
    return !!excursionDayMap[dateStr];
  }, [excursionDayMap]);

  /* ───── Filter attendance to practice days ─────
     calendarAttendance is NLA-only (excursion check-ins are program_source
     'Excursion', held in a separate query), so we no longer exclude excursion
     days. A day can now be BOTH a practice day and host an excursion — the
     evening practice (NLA) check-ins still count as practice attendance here,
     while the daytime excursion check-ins are counted separately. */
  const practiceAttendance = useMemo(
    () => calendarAttendance.filter((a) => isPracticeDay(a.check_in_date, calPracticeDayMap)),
    [calendarAttendance, calPracticeDayMap, isPracticeDay]
  );

  const prevPracticeAttendance = useMemo(
    () => prevMonthAttendance.filter((a) => isPracticeDay(a.check_in_date, prevPracticeDayMap)),
    [prevMonthAttendance, prevPracticeDayMap, isPracticeDay]
  );

  /* ───── Quick Toggle: single click cycles Practice → Non-Practice → Excursion → Practice … ───── */
  const cycleDayType = async (dateStr: string) => {
    // The dot now only toggles practice ↔ non-practice. Excursions are an
    // independent add-on managed from the right-click menu, so they're no
    // longer part of this cycle (a day can be a practice day AND an excursion).
    const isPrac = isPracticeDay(dateStr, calPracticeDayMap);
    await setDayPractice(dateStr, !isPrac);
  };

  /* ───── Practice / non-practice toggle — independent of excursions ───── */
  const setDayPractice = async (dateStr: string, isPrac: boolean) => {
    setContextMenuDay(null);
    const existingPracticeDay = practiceDaysCalMonth.find((p) => p.date === dateStr);
    if (existingPracticeDay) {
      await supabase.from("practice_days").update({ is_practice_day: isPrac }).eq("id", existingPracticeDay.id);
    } else {
      await supabase.from("practice_days").insert({ date: dateStr, is_practice_day: isPrac });
    }
    queryClient.invalidateQueries({ queryKey: ["practice-days-cal"] });
    toast.success(isPrac ? "Marked as practice day" : "Marked as non-practice day");
  };

  /* ───── Add / edit the excursion attached to a day — independent of
     practice status. Adding an excursion no longer changes whether the day
     is a practice day, so a normal practice day can also host a daytime
     excursion. ───── */
  const openExcursionEditor = (dateStr: string) => {
    setContextMenuDay(null);
    const existingExcursion = excursionsCalMonth.find((e) => e.date === dateStr);
    if (existingExcursion) {
      setEditingExcursion(existingExcursion);
      return;
    }
    // New excursion modal — name + notes only (the real youth count is
    // derived from check-ins, not a pre-trip guess).
    setExcursionDate(dateStr);
    setExcursionName("");
    setExcursionNotes("");
    setExcursionModalOpen(true);
  };

  // Runs the actual excursion delete + day-type swap once the user has
  // confirmed in the conversion dialog. Mirrors the pre-confirmation
  // logic that used to live inline in setDayType.
  const performExcursionConversion = async () => {
    if (!convertExcursionTarget) return;
    const { excursion: ex, targetType } = convertExcursionTarget;
    const dateStr = ex.date;
    const isPracTarget = targetType === "practice";

    const { error: delError } = await supabase.from("excursions").delete().eq("id", ex.id);
    if (delError) { toast.error("Failed to delete excursion."); return; }

    const existingPracticeDay = practiceDaysCalMonth.find((p) => p.date === dateStr);
    if (existingPracticeDay) {
      await supabase.from("practice_days").update({ is_practice_day: isPracTarget }).eq("id", existingPracticeDay.id);
    } else {
      await supabase.from("practice_days").insert({ date: dateStr, is_practice_day: isPracTarget });
    }

    queryClient.invalidateQueries({ queryKey: ["excursions-cal"] });
    queryClient.invalidateQueries({ queryKey: ["practice-days-cal"] });
    queryClient.invalidateQueries({ queryKey: ["excursions-ytd", YTD_START] });
    queryClient.invalidateQueries({ queryKey: ["excursions-history-all"] });
    queryClient.invalidateQueries({ queryKey: ["excursion-attendance-month", calMonthStart, calMonthEnd] });
    queryClient.invalidateQueries({ queryKey: ["excursion-checkin-counts-all"] });

    toast.success(isPracTarget ? "Trip deleted. Marked as practice day." : "Trip deleted. Marked as non-practice day.");
    setConvertExcursionTarget(null);
  };

  const openDotContextMenu = (e: React.MouseEvent | React.TouchEvent, dateStr: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenuDay({ dateStr, x: rect.left, y: rect.bottom + 4 });
  };

  const saveExcursion = async () => {
    if (!excursionName.trim()) {
      toast.error("Please fill in an excursion name");
      return;
    }
    const { error } = await supabase.from("excursions").insert({
      date: excursionDate,
      name: excursionName.trim(),
      youth_count: 0, // retired field — kept zeroed for the NOT NULL constraint
      notes: excursionNotes.trim() || null,
    });
    if (error) { toast.error("Failed to save excursion"); return; }
    // Excursions are now an add-on: creating one leaves the day's practice /
    // non-practice status untouched, so a practice day can also host an excursion.
    queryClient.invalidateQueries({ queryKey: ["excursions-cal"] });
    setExcursionModalOpen(false);
    toast.success("Excursion saved");
  };

  const cancelExcursionModal = () => {
    // Adding an excursion no longer changes practice status, so cancelling
    // simply closes the modal — there's nothing to revert.
    setExcursionModalOpen(false);
  };

  const handleDeleteExcursion = async () => {
    if (!deleteExcursionTarget) return;
    const { error } = await supabase.from("excursions").delete().eq("id", deleteExcursionTarget.id);
    if (error) { toast.error("Failed to delete excursion"); return; }
    // The day keeps its practice / non-practice status — removing the
    // excursion overlay doesn't change whether it's a practice day.
    // (CASCADE deletes already wiped attendance, vehicles, assignments,
    // and personnel rows.)
    queryClient.invalidateQueries({ queryKey: ["excursions-cal"] });
    queryClient.invalidateQueries({ queryKey: ["excursions-prev"] });
    queryClient.invalidateQueries({ queryKey: ["excursions-ytd", YTD_START] });
    queryClient.invalidateQueries({ queryKey: ["excursions-history-all"] });
    queryClient.invalidateQueries({ queryKey: ["excursion-attendance-month", calMonthStart, calMonthEnd] });
    queryClient.invalidateQueries({ queryKey: ["excursion-checkin-counts-all"] });
    queryClient.invalidateQueries({ queryKey: ["practice-days-cal"] });
    queryClient.invalidateQueries({ queryKey: ["calendar-attendance", calMonthStart] });
    setDeleteExcursionTarget(null);
    setEditingExcursion(null); // Close Edit modal too if delete was triggered from there
    toast.success("Excursion deleted");
  };

  // Trip roster (vehicles + youth + personnel) for the Excursion currently
  // being edited. Pulled via the same Coach-Mode RPCs so the read-only
  // admin view stays in sync with whatever Chrissy set up on the kiosk.
  const editingExcursionId = editingExcursion?.id ?? null;
  const { data: editingRosterYouth = [] } = useQuery({
    queryKey: ["admin-edit-excursion-roster-youth", editingExcursionId],
    enabled: !!editingExcursionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_excursion_roster_youth", {
        _excursion_id: editingExcursionId!,
      });
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
      const { data, error } = await supabase.rpc("get_excursion_vehicles", {
        _excursion_id: editingExcursionId!,
      });
      if (error) throw error;
      return data as Array<{
        id: string;
        name: string;
        seat_cap: number;
        driver_name: string;
        assigned_count: number;
      }>;
    },
  });
  const { data: editingPersonnel = [] } = useQuery({
    queryKey: ["admin-edit-excursion-personnel", editingExcursionId],
    enabled: !!editingExcursionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_excursion_personnel", {
        _excursion_id: editingExcursionId!,
      });
      if (error) throw error;
      return data as Array<{ id: string; name: string; vehicle_id: string | null; return_vehicle_id: string | null; created_at: string }>;
    },
  });

  const saveEditExcursion = async () => {
    if (!editingExcursion) return;
    // Phase B (2026-06-16): youth_count omitted — retired in favor of the
    // real check-in count derived from attendance_records.
    const { error } = await supabase.from("excursions").update({
      name: editingExcursion.name,
      notes: editingExcursion.notes,
      arrived_at: editingExcursion.arrived_at,
      returned_at: editingExcursion.returned_at,
      arrival_note: editingExcursion.arrival_note,
      return_note: editingExcursion.return_note,
    }).eq("id", editingExcursion.id);
    if (error) { toast.error("Failed to update excursion"); return; }
    queryClient.invalidateQueries({ queryKey: ["excursions-cal"] });
    queryClient.invalidateQueries({ queryKey: ["excursions-ytd", YTD_START] });
    setEditingExcursion(null);
    toast.success("Excursion updated");
  };

  // Submit (lock) / unlock the roster from the admin modal — same lock the
  // phone Coach Mode uses, so an excursion can be finalized from either place.
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
    queryClient.invalidateQueries({ queryKey: ["excursions-cal"] });
  };

  // Helpers for the datetime-local inputs in the Edit Excursion modal.
  // datetime-local format is local time without offset (YYYY-MM-DDTHH:mm),
  // so we convert to/from ISO at the boundary.
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

  /* ───── Edit Excursion modal — interactive controls ─────
     Lets an admin backfill youth attendance + vehicles + personnel for any
     past Excursion (the case where a trip happened but nobody used the
     kiosk live). Uses the same RPCs Coach Mode does. */

  // Reset all transient inputs whenever the modal closes or switches trips.
  useEffect(() => {
    setEditAddingVehicle(null);
    setEditDriverNameInput("");
    setEditCustomNameInput("");
    setEditCustomSeatInput("");
    setEditPersonnelInput("");
    setEditYouthSearch("");
    setEditYouthResults([]);
  }, [editingExcursionId]);

  // Debounced youth search for the "Add youth" field inside the modal.
  useEffect(() => {
    if (!editingExcursionId) return;
    if (editYouthSearch.trim().length < 2) {
      setEditYouthResults([]);
      return;
    }
    setEditYouthSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_excursion_youth", {
        _search: editYouthSearch,
      });
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

  // Centralized refresh of every query the modal depends on, plus the
  // calendar tile counts so the underlying page stays consistent.
  const invalidateEditExcursionQueries = useCallback(() => {
    if (!editingExcursionId) return;
    queryClient.invalidateQueries({ queryKey: ["admin-edit-excursion-roster-youth", editingExcursionId] });
    queryClient.invalidateQueries({ queryKey: ["admin-edit-excursion-vehicles", editingExcursionId] });
    queryClient.invalidateQueries({ queryKey: ["admin-edit-excursion-personnel", editingExcursionId] });
    queryClient.invalidateQueries({ queryKey: ["excursion-checkin-counts-all"] });
    queryClient.invalidateQueries({ queryKey: ["excursion-attendance-month", calMonthStart, calMonthEnd] });
  }, [editingExcursionId, queryClient, calMonthStart, calMonthEnd]);

  // All handlers below call the admin_* RPCs from the 2026-06-16 migration.
  // Two behavioral differences from Coach Mode's RPCs:
  //   1. attendance backfill uses the excursion's actual date (not today)
  //   2. admin writes ignore roster_locked_at — the lock is Chrissy's
  //      safety rail, not a barrier for retroactive admin edits.

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
    const { error } = await supabase.rpc("admin_assign_youth_to_vehicle", {
      _vehicle_id: vehicleId,
      _registration_id: registrationId,
    });
    if (error) { toast.error(error.message || "Couldn't assign youth."); return; }
    invalidateEditExcursionQueries();
  };

  const handleEditUnassignYouth = async (registrationId: string) => {
    if (!editingExcursionId) return;
    const { error } = await supabase.rpc("admin_unassign_youth_from_vehicle", {
      _excursion_id: editingExcursionId,
      _registration_id: registrationId,
    });
    if (error) { toast.error(error.message || "Couldn't unassign youth."); return; }
    invalidateEditExcursionQueries();
  };

  const handleEditAddPersonnel = async () => {
    if (!editingExcursionId || !editPersonnelInput.trim()) return;
    setEditSavingPersonnel(true);
    const { error } = await supabase.rpc("admin_add_excursion_personnel", {
      _excursion_id: editingExcursionId,
      _name: editPersonnelInput.trim(),
    });
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

  // Backfill a youth into the excursion's roster, dated to the trip's
  // actual date — NOT today. Fixes the June 13 calendar tile that was
  // showing 0 because admin-added kids were landing on today's date.
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

  /* ───── Derived Data ───── */
  const regMap = useMemo(() => {
    const m: Record<string, Registration> = {};
    registrations.forEach((r) => (m[r.id] = r));
    return m;
  }, [registrations]);

  const programs = useMemo(() => {
    const set = new Set(registrations.map((r) => r.child_boxing_program));
    return Array.from(set).sort();
  }, [registrations]);

  // Attendance by registration (viewed month, practice days only)
  const attendanceByReg = useMemo(() => {
    const map: Record<string, AttendanceRecord[]> = {};
    practiceAttendance.forEach((a) => {
      if (!map[a.registration_id]) map[a.registration_id] = [];
      map[a.registration_id].push(a);
    });
    return map;
  }, [practiceAttendance]);

  const getStats = (regId: string) => {
    const records = attendanceByReg[regId] || [];
    const todayCount = records.filter((r) => r.check_in_date === todayStr).length;
    const monthCount = records.length;
    const lastDate = records.length > 0 ? records[records.length - 1].check_in_date : null;
    return { present: todayCount > 0, weekCount: 0, monthCount, lastDate };
  };

  /* ───── STAT BOX 1: Present Today / Peak Day ───── */
  const todayIsPractice = isPracticeDay(todayStr, calPracticeDayMap);

  const todayRecords = useMemo(
    () => isCurrentMonth && todayIsPractice
      ? practiceAttendance.filter((a) => a.check_in_date === todayStr)
      : [],
    [practiceAttendance, todayIsPractice, isCurrentMonth]
  );
  const todayRegIds = useMemo(() => new Set(todayRecords.map((a) => a.registration_id)), [todayRecords]);
  const totalPresentToday = todayRegIds.size;

  /* ───── EFFECTIVE "TODAY" for snapshot widgets ─────
     If we're viewing the current month but today has no attendance yet
     (non-practice day, before check-ins, etc.), fall back to the most
     recent practice day this month that has check-ins so the cards stay
     fresh and update daily. */
  const { effectiveDate, effectiveRecords, effectiveRegIds, effectiveLabel } = useMemo(() => {
    if (isCurrentMonth && todayRecords.length > 0) {
      return {
        effectiveDate: todayStr,
        effectiveRecords: todayRecords,
        effectiveRegIds: todayRegIds,
        effectiveLabel: "Today",
      };
    }
    if (isCurrentMonth) {
      // Find most recent practice day this month <= today with attendance
      const byDate: Record<string, typeof practiceAttendance> = {};
      practiceAttendance.forEach((a) => {
        if (a.check_in_date <= todayStr) {
          (byDate[a.check_in_date] ||= []).push(a);
        }
      });
      const dates = Object.keys(byDate).sort().reverse();
      if (dates.length > 0) {
        const d = dates[0];
        const recs = byDate[d];
        const ids = new Set(recs.map((a) => a.registration_id));
        const label = format(parseISO(d), "MMM d");
        return { effectiveDate: d, effectiveRecords: recs, effectiveRegIds: ids, effectiveLabel: `Last Practice — ${label}` };
      }
    }
    // Viewing a past/future month → show all month aggregates (existing behavior)
    const ids = new Set(practiceAttendance.map((a) => a.registration_id));
    return { effectiveDate: null, effectiveRecords: practiceAttendance, effectiveRegIds: ids, effectiveLabel: viewedMonthShort };
  }, [isCurrentMonth, todayRecords, todayRegIds, practiceAttendance, viewedMonthShort]);

  // Attendance High & Low for practice days
  const { attendanceHigh, attendanceLow } = useMemo(() => {
    const dayCounts: Record<string, Set<string>> = {};
    practiceAttendance.forEach((a) => {
      if (!dayCounts[a.check_in_date]) dayCounts[a.check_in_date] = new Set();
      dayCounts[a.check_in_date].add(a.registration_id);
    });
    let maxDate = "";
    let maxCount = 0;
    let minDate = "";
    let minCount = Infinity;
    Object.entries(dayCounts).forEach(([date, ids]) => {
      if (ids.size > maxCount) { maxCount = ids.size; maxDate = date; }
      if (ids.size < minCount) { minCount = ids.size; minDate = date; }
    });
    if (minCount === Infinity) { minCount = 0; minDate = ""; }
    return {
      attendanceHigh: { count: maxCount, date: maxDate },
      attendanceLow: { count: minCount, date: minDate },
    };
  }, [practiceAttendance]);

  /* ───── STAT BOX: Month Avg → avg per practice day in the viewed month ───── */
  const mtdAvg = useMemo(() => {
    const days = new Set(practiceAttendance.map((a) => a.check_in_date));
    return days.size > 0 ? Math.round(practiceAttendance.length / days.size) : 0;
  }, [practiceAttendance]);

  /* ───── YTD practice attendance (practice days), since 2026-03-09 ─────
     ytdAttendance is NLA-only, so excursion check-ins (program_source
     'Excursion') are already excluded here. We no longer drop days that have
     an excursion: a day can be both a practice day and host an excursion, and
     its evening practice attendance should count — matching the Month Avg. */
  const ytdPracticeDayMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    ytdPracticeDays.forEach((p) => { m[p.date] = p.is_practice_day; });
    return m;
  }, [ytdPracticeDays]);

  const ytdPracticeAttendance = useMemo(
    () => ytdAttendance.filter((a) => isPracticeDay(a.check_in_date, ytdPracticeDayMap)),
    [ytdAttendance, ytdPracticeDayMap, isPracticeDay]
  );

  /* ───── STAT BOX: Year Avg → avg per green-practice day since 2026-03-09 ───── */
  const yearAvg = useMemo(() => {
    const days = new Set(ytdPracticeAttendance.map((a) => a.check_in_date));
    return days.size > 0 ? Math.round(ytdPracticeAttendance.length / days.size) : 0;
  }, [ytdPracticeAttendance]);

  /* ───── STAT BOX: Avg Arrival Time (Year) → across all green-practice days since 2026-03-09 ───── */
  const avgArrivalYear = useMemo(() => {
    const records = ytdPracticeAttendance;
    if (records.length === 0) return null;
    const totalMs = records.reduce((sum, a) => {
      const d = new Date(a.check_in_at);
      return sum + (d.getHours() * 60 + d.getMinutes());
    }, 0);
    const avgMin = Math.round(totalMs / records.length);
    const h = Math.floor(avgMin / 60);
    const m = avgMin % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  }, [ytdPracticeAttendance]);

  /* ───── PROGRAM SPLIT (viewed month) ───── */
  const programSplitToday = useMemo(() => {
    const regIds = isCurrentMonth ? effectiveRegIds : new Set(practiceAttendance.map((a) => a.registration_id));
    const counts: Record<string, number> = {};
    regIds.forEach((id) => {
      const reg = regMap[id];
      if (reg) counts[reg.child_boxing_program] = (counts[reg.child_boxing_program] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [isCurrentMonth, effectiveRegIds, practiceAttendance, regMap]);

  /* ───── BOY / GIRL RATIO ───── */
  const sexSplitToday = useMemo(() => {
    const regIds = isCurrentMonth ? effectiveRegIds : new Set(practiceAttendance.map((a) => a.registration_id));
    const counts: Record<string, number> = {};
    regIds.forEach((id) => {
      const reg = regMap[id];
      if (reg) counts[reg.child_sex] = (counts[reg.child_sex] || 0) + 1;
    });
    return counts;
  }, [isCurrentMonth, effectiveRegIds, practiceAttendance, regMap]);

  /* ───── POVERTY % ───── */
  const povertyToday = useMemo(() => {
    const regIds = isCurrentMonth ? effectiveRegIds : new Set(practiceAttendance.map((a) => a.registration_id));
    let below = 0;
    regIds.forEach((id) => {
      const reg = regMap[id];
      if (reg && (POVERTY_INCOMES.includes(reg.household_income_range) || reg.free_or_reduced_lunch === "Yes")) below++;
    });
    return { below, total: regIds.size };
  }, [isCurrentMonth, effectiveRegIds, practiceAttendance, regMap]);

  /* ───── TOP SCHOOL DISTRICT ───── */
  const topDistrictToday = useMemo(() => {
    const regIds = isCurrentMonth ? effectiveRegIds : new Set(practiceAttendance.map((a) => a.registration_id));
    const counts: Record<string, number> = {};
    regIds.forEach((id) => {
      const reg = regMap[id];
      if (reg) counts[reg.child_school_district] = (counts[reg.child_school_district] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0] : null;
  }, [isCurrentMonth, effectiveRegIds, practiceAttendance, regMap]);

  /* ───── TODAY-ONLY snapshot (resets daily, live) ───── */
  const todayOnlyRegIds = useMemo(() => {
    if (!isCurrentMonth) return new Set<string>();
    return new Set(practiceAttendance.filter(a => a.check_in_date === todayStr).map(a => a.registration_id));
  }, [isCurrentMonth, practiceAttendance]);

  const buildSnapshot = useCallback((regIds: Set<string>) => {
    const program: Record<string, number> = {};
    const sex: Record<string, number> = {};
    const district: Record<string, number> = {};
    let belowPoverty = 0;
    regIds.forEach((id) => {
      const reg = regMap[id];
      if (!reg) return;
      program[reg.child_boxing_program] = (program[reg.child_boxing_program] || 0) + 1;
      sex[reg.child_sex] = (sex[reg.child_sex] || 0) + 1;
      district[reg.child_school_district] = (district[reg.child_school_district] || 0) + 1;
      if (POVERTY_INCOMES.includes(reg.household_income_range) || reg.free_or_reduced_lunch === "Yes") belowPoverty++;
    });
    const programSorted = Object.entries(program).sort((a, b) => b[1] - a[1]);
    const districtSorted = Object.entries(district).sort((a, b) => b[1] - a[1]);
    return {
      program: programSorted,
      sex,
      poverty: { below: belowPoverty, total: regIds.size },
      topDistrict: districtSorted.length > 0 ? districtSorted[0] : null,
      total: regIds.size,
    };
  }, [regMap]);

  const todaySnapshot = useMemo(() => buildSnapshot(todayOnlyRegIds), [buildSnapshot, todayOnlyRegIds]);

  const mtdRegIds = useMemo(() => {
    const ids = new Set<string>();
    practiceAttendance.forEach((a) => {
      if (!isCurrentMonth || a.check_in_date <= todayStr) ids.add(a.registration_id);
    });
    return ids;
  }, [practiceAttendance, isCurrentMonth]);

  const mtdSnapshot = useMemo(() => buildSnapshot(mtdRegIds), [buildSnapshot, mtdRegIds]);

  const mtdRaceBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    mtdRegIds.forEach((id) => {
      const reg = regMap[id];
      if (reg?.child_race_ethnicity) {
        counts[reg.child_race_ethnicity] = (counts[reg.child_race_ethnicity] || 0) + 1;
      }
    });
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const whiteCount = counts["White"] || 0;
    const minorityCount = total - whiteCount;
    return { counts: sorted, total, whiteCount, minorityCount };
  }, [mtdRegIds, regMap]);

  /* ───── SINGLE PARENT HOUSEHOLDS (funder-facing) ─────
   * Counts youth living in single-parent households using the
   * family_structure dropdown answer from the registration form.
   * Three labels roll up into the headline number:
   *   - "Mom Only"
   *   - "Dad Only"
   *   - "Single Parent Household" (backfill label for legacy/imported
   *     rows where adults_in_household = 1 but the specific Mom/Dad
   *     answer is unknown)
   * All other answers (Dad and Mom, Mom + Partner, Dad + Partner,
   * Grandparent(s), Other) are excluded per the 2026-06-16 strategic
   * decision — Josh only wants single-parent on the funder snapshot.
   * Denominator is all distinct MTD youth (not just those with an
   * answer) so the % matches the Race/Ethnicity card. */
  const mtdSingleParentBreakdown = useMemo(() => {
    let momOnly = 0;
    let dadOnly = 0;
    let unspecified = 0;
    mtdRegIds.forEach((id) => {
      const reg = regMap[id];
      const fs = reg?.family_structure;
      if (fs === "Mom Only") momOnly++;
      else if (fs === "Dad Only") dadOnly++;
      else if (fs === "Single Parent Household") unspecified++;
    });
    const singleParent = momOnly + dadOnly + unspecified;
    return { singleParent, momOnly, dadOnly, unspecified, total: mtdRegIds.size };
  }, [mtdRegIds, regMap]);

  const mtdLabel = isCurrentMonth ? `Month-to-Date — ${viewedMonthShort}` : viewedMonthShort;

  /* ───── AVG ARRIVAL TIME for the viewed month's practice days ───── */
  const avgArrivalMonth = useMemo(() => {
    const records = practiceAttendance;
    if (records.length === 0) return null;
    const totalMs = records.reduce((sum, a) => {
      const d = new Date(a.check_in_at);
      return sum + (d.getHours() * 60 + d.getMinutes());
    }, 0);
    const avgMin = Math.round(totalMs / records.length);
    const h = Math.floor(avgMin / 60);
    const m = avgMin % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  }, [practiceAttendance]);

  /* ───── DAILY ATTENDANCE TREND (viewed month, practice days only) ───── */
  const dailyTrend = useMemo(() => {
    const counts: Record<string, number> = {};
    practiceAttendance.forEach((a) => { counts[a.check_in_date] = (counts[a.check_in_date] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => {
        const w = weatherMap[date] as WeatherDay | undefined;
        return {
          date: format(parseISO(date), "M/d"),
          count,
          fullDate: date,
          // Chart tooltip reads these — keep the field names stable.
          tempMax: w?.temp_high ?? null,
          // `precip` drives the chart's blue precipitation line AND the
          // chart-bottom rainy/dry correlation panel, so it needs to be
          // the 8am-8pm window total (with fallback to 24-hour for
          // legacy cached rows pre-migration).
          precip: w ? dayPrecip(w) : null,
        };
      });
  }, [practiceAttendance, weatherMap]);

  /* ───── WEATHER vs ATTENDANCE CORRELATION ─────
   *  Drives the chart-bottom panel. Sample-size guard: only surfaces when
   *  there are at least MIN_DAYS_PER_BUCKET rainy AND dry practice days,
   *  to avoid declaring patterns on 1-2 data points. */
  const weatherCorrelation = useMemo(() => {
    const withWeather = dailyTrend.filter((d) => d.precip !== null);
    if (withWeather.length === 0) return null;
    const rainy = withWeather.filter((d) => (d.precip ?? 0) >= RAIN_THRESHOLD_IN);
    const dry = withWeather.filter((d) => (d.precip ?? 0) < RAIN_THRESHOLD_IN);
    if (rainy.length < MIN_DAYS_PER_BUCKET || dry.length < MIN_DAYS_PER_BUCKET) return null;
    // Round at the end so dropCount isn't a rounded-minus-rounded artifact.
    const rainyTotal = rainy.reduce((s, r) => s + r.count, 0);
    const dryTotal = dry.reduce((s, r) => s + r.count, 0);
    const rainyAvg = Math.round(rainyTotal / rainy.length);
    const dryAvg = Math.round(dryTotal / dry.length);
    const rawDiff = (dryTotal / dry.length) - (rainyTotal / rainy.length);
    const dropPct = dryAvg > 0 && rawDiff > 0 ? Math.round((rawDiff / (dryTotal / dry.length)) * 100) : 0;
    return {
      rainyAvg,
      dryAvg,
      rainyDays: rainy.length,
      dryDays: dry.length,
      dropPct,
      dropCount: Math.round(rawDiff),
    };
  }, [dailyTrend]);

  /* ───── AVERAGE ATTENDANCE BY WEEK (Mon–Fri weeks, practice days only) ───── */
  const weeklyAvgData = useMemo(() => {
    // Group practice attendance by date
    const dailyCounts: Record<string, number> = {};
    practiceAttendance.forEach((a) => { dailyCounts[a.check_in_date] = (dailyCounts[a.check_in_date] || 0) + 1; });

    // Build weeks (Mon–Fri) for the viewed month
    const mStart = startOfMonth(calendarMonth);
    const mEnd = endOfMonth(calendarMonth);
    const weeks: { label: string; dates: string[] }[] = [];
    let current = mStart;
    let weekNum = 1;

    while (current <= mEnd) {
      const dow = getDay(current);
      // Find the Monday of this week (or month start if it's mid-week)
      if (dow >= 1 && dow <= 5) {
        // It's a weekday
        const mondayOfWeek = new Date(current);
        mondayOfWeek.setDate(mondayOfWeek.getDate() - (dow - 1));
        const weekKey = format(mondayOfWeek, "yyyy-MM-dd");
        
        let existingWeek = weeks.find((w) => w.label === `Wk ${weekNum}` && w.dates.length > 0 && format(new Date(new Date(w.dates[0]).getTime() + (7 * 24 * 60 * 60 * 1000)), "yyyy-MM-dd") >= format(current, "yyyy-MM-dd"));
        
        if (!existingWeek) {
          // Check if this date belongs to the current last week
          const lastWeek = weeks[weeks.length - 1];
          if (lastWeek) {
            const lastDate = parseISO(lastWeek.dates[lastWeek.dates.length - 1]);
            const daysDiff = (current.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff <= 3 && dow > getDay(lastDate)) {
              lastWeek.dates.push(format(current, "yyyy-MM-dd"));
              current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
              continue;
            }
          }
          weeks.push({ label: `Wk ${weekNum}`, dates: [format(current, "yyyy-MM-dd")] });
          weekNum++;
        }
      }
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }

    return weeks.map((w) => {
      const practiceDates = w.dates.filter((d) => dailyCounts[d] !== undefined);
      const total = practiceDates.reduce((sum, d) => sum + (dailyCounts[d] || 0), 0);
      const avg = practiceDates.length > 0 ? Math.round(total / practiceDates.length) : 0;
      const firstDate = w.dates[0] ? format(parseISO(w.dates[0]), "M/d") : "";
      const lastDate = w.dates[w.dates.length - 1] ? format(parseISO(w.dates[w.dates.length - 1]), "M/d") : "";
      return { week: w.label, avg, total, days: practiceDates.length, range: `${firstDate} – ${lastDate}` };
    }).filter((w) => w.days > 0);
  }, [practiceAttendance, calendarMonth]);

  /* ───── PROGRAM ATTENDANCE TREND (practice days only) ───── */
  const programTrend = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    practiceAttendance.forEach((a) => {
      const reg = regMap[a.registration_id];
      if (!reg) return;
      const prog = reg.child_boxing_program.includes("Junior") ? "Junior" : reg.child_boxing_program.includes("Senior") ? "Senior" : "Other";
      if (!map[a.check_in_date]) map[a.check_in_date] = {};
      map[a.check_in_date][prog] = (map[a.check_in_date][prog] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, progs]) => ({
        date: format(parseISO(date), "M/d"),
        Junior: progs["Junior"] || 0,
        Senior: progs["Senior"] || 0,
        Other: progs["Other"] || 0,
      }));
  }, [practiceAttendance, regMap]);

  /* ───── SCHOOL DISTRICT BREAKDOWN (viewed month, practice days only) ───── */
  const districtBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    const ids = new Set(practiceAttendance.map((a) => a.registration_id));
    ids.forEach((id) => {
      const reg = regMap[id];
      if (reg) counts[reg.child_school_district] = (counts[reg.child_school_district] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [practiceAttendance, regMap]);

  /* ───── POVERTY SUMMARY (viewed month, practice days only) ───── */
  const povertyMonth = useMemo(() => {
    const ids = new Set(practiceAttendance.map((a) => a.registration_id));
    let below = 0;
    ids.forEach((id) => {
      const reg = regMap[id];
      if (reg && (POVERTY_INCOMES.includes(reg.household_income_range) || reg.free_or_reduced_lunch === "Yes")) below++;
    });
    return { below, total: ids.size };
  }, [practiceAttendance, regMap]);

  /* ───── SMART INSIGHTS (practice days only) ───── */
  const smartInsights = useMemo(() => {
    const insights: string[] = [];

    const strongest = weeklyAvgData.reduce((a, b) => (b.avg > a.avg ? b : a), weeklyAvgData[0]);
    const weakest = weeklyAvgData.reduce((a, b) => (b.avg < a.avg ? b : a), weeklyAvgData[0]);
    if (strongest && strongest.avg > 0) {
      insights.push(`${strongest.week} (${strongest.range}) has the strongest average attendance in ${viewedMonthShort} (${strongest.avg}/day).`);
    }
    if (weakest && weakest.avg > 0 && weakest.week !== strongest?.week) {
      insights.push(`${weakest.week} (${weakest.range}) has lower average attendance (${weakest.avg}/day).`);
    }

    const monthRegIds = new Set(practiceAttendance.map((a) => a.registration_id));
    const jrIds = new Set(practiceAttendance.filter((a) => regMap[a.registration_id]?.child_boxing_program.includes("Junior")).map((a) => a.registration_id));
    const srIds = new Set(practiceAttendance.filter((a) => regMap[a.registration_id]?.child_boxing_program.includes("Senior")).map((a) => a.registration_id));
    if (jrIds.size > 0 || srIds.size > 0) {
      insights.push(`${srIds.size} Senior Boxers and ${jrIds.size} Junior Boxers attended in ${viewedMonthShort} (Junior Boxing meets once per week).`);
    }

    if (isCurrentMonth && topDistrictToday && totalPresentToday > 0) {
      insights.push(`Most youth attending today are from ${topDistrictToday[0]}.`);
    }

    if (avgArrivalMonth) {
      insights.push(`Average arrival time in ${viewedMonthShort} is ${avgArrivalMonth}.`);
    }

    const prevDays = new Set(prevPracticeAttendance.map((a) => a.check_in_date));
    const prevAvg = prevDays.size > 0 ? Math.round(prevPracticeAttendance.length / prevDays.size) : 0;
    if (prevAvg > 0 && mtdAvg > 0) {
      const prevMonthName = format(subMonths(calendarMonth, 1), "MMMM");
      if (mtdAvg > prevAvg) insights.push(`${viewedMonthShort}'s average attendance is higher than ${prevMonthName}.`);
      else if (mtdAvg < prevAvg) insights.push(`${viewedMonthShort}'s average attendance is lower than ${prevMonthName}.`);
    }

    /* ── Weather-based insights ──
     *  Honest copy: descriptive numbers, no causation language, no
     *  funding-hook framing. Sample-size guard: every comparison
     *  requires ≥ MIN_DAYS_PER_BUCKET days per side, so we never
     *  declare "rainy days are X% worse" off of one rainy Tuesday. */
    const weatherEntries = Object.values(weatherMap) as WeatherDay[];
    const practiceDailyCountsMap: Record<string, number> = {};
    practiceAttendance.forEach((a) => { practiceDailyCountsMap[a.check_in_date] = (practiceDailyCountsMap[a.check_in_date] || 0) + 1; });

    // Only consider days that were actually practice days with attendance.
    const practiceWeatherEntries = weatherEntries.filter((w) => practiceDailyCountsMap[w.date] !== undefined);
    const avgAttendance = (rows: WeatherDay[]) =>
      rows.length === 0 ? 0 : Math.round(rows.reduce((s, w) => s + (practiceDailyCountsMap[w.date] || 0), 0) / rows.length);

    if (practiceWeatherEntries.length >= MIN_DAYS_PER_BUCKET * 2) {
      // Rainy vs sunny — uses the same precipitation-based definition as
      // the chart correlation panel so the two never disagree.
      const rainyDays = practiceWeatherEntries.filter((w) => isRainyDay(w));
      const sunnyDays = practiceWeatherEntries.filter((w) => isSunnyDay(w));

      if (rainyDays.length >= MIN_DAYS_PER_BUCKET && sunnyDays.length >= MIN_DAYS_PER_BUCKET) {
        const rainyAvg = avgAttendance(rainyDays);
        const sunnyAvg = avgAttendance(sunnyDays);
        insights.push(
          `🌧️ Average attendance was ${rainyAvg} on the ${rainyDays.length} rainy days this month vs ${sunnyAvg} on the ${sunnyDays.length} sunny days.`
        );
      }

      // Cold vs not-cold — absolute 50°F threshold so summer "coldest"
      // never reads as "below 78°F". Skip entirely when there aren't
      // enough cold days to compare.
      const withTemp = practiceWeatherEntries.filter((w) => w.temp_high !== null);
      const coldDays = withTemp.filter((w) => w.temp_high! < COLD_THRESHOLD_F);
      const notColdDays = withTemp.filter((w) => w.temp_high! >= COLD_THRESHOLD_F);
      if (coldDays.length >= MIN_DAYS_PER_BUCKET && notColdDays.length >= MIN_DAYS_PER_BUCKET) {
        const coldAvg = avgAttendance(coldDays);
        const notColdAvg = avgAttendance(notColdDays);
        insights.push(
          `🌡️ Average attendance was ${coldAvg} on the ${coldDays.length} cold days (below ${COLD_THRESHOLD_F}°F) vs ${notColdAvg} on the ${notColdDays.length} warmer days.`
        );
      }

      // Best weather bucket — group by category (Sunny/Cloudy/Rainy/...)
      // instead of by raw condition string, and require ≥ MIN_DAYS_PER_BUCKET
      // days in the winning bucket to surface the insight at all.
      const bucketGroups: Record<string, WeatherDay[]> = {};
      practiceWeatherEntries.forEach((w) => {
        const bucket = getWeatherBucket(w.condition_code);
        if (!bucket) return;
        if (!bucketGroups[bucket]) bucketGroups[bucket] = [];
        bucketGroups[bucket].push(w);
      });
      let bestBucket = "";
      let bestAvg = 0;
      let bestCount = 0;
      Object.entries(bucketGroups).forEach(([bucket, days]) => {
        if (days.length >= MIN_DAYS_PER_BUCKET) {
          const avg = avgAttendance(days);
          if (avg > bestAvg) { bestAvg = avg; bestBucket = bucket; bestCount = days.length; }
        }
      });
      if (bestBucket) {
        insights.push(`☀️ ${bestBucket} days (${bestCount} this month) saw the highest average attendance: ${bestAvg}.`);
      }
    }

    /* ── Excursion insights ── */
    if (excursionsCalMonth.length > 0) {
      const totalYouthExc = excursionsCalMonth.reduce((s, e) => s + (excursionCountsById[e.id] || 0), 0);
      insights.push(`🟣 ${excursionsCalMonth.length} Excursion${excursionsCalMonth.length > 1 ? "s" : ""} this month reached ${totalYouthExc} youth total.`);
    }

    return insights;
  }, [weeklyAvgData, practiceAttendance, regMap, topDistrictToday, totalPresentToday, avgArrivalMonth, prevPracticeAttendance, mtdAvg, isCurrentMonth, viewedMonthShort, calendarMonth, weatherMap, excursionsCalMonth, excursionCountsById]);

  /* ───── BALD EAGLES ───── */
  // Inactive ≠ "doesn't count." Inactive only means "don't include this
  // youth in the no-call-no-show alert" (e.g., a kid we agreed only
  // comes on Wednesdays). Their actual attendance still feeds every
  // stat below. The `activeBaldEagles` slice is reserved for the alert
  // logic in `baldEagleNoShows`.
  const baldEagles = registrations.filter((r) => r.is_bald_eagle);
  const activeBaldEagles = baldEagles.filter((r) => r.bald_eagle_active);
  const baldEaglesPresent = isCurrentMonth ? baldEagles.filter((r) => getStats(r.id).present).length : 0;
  const baldEaglesMonth = baldEagles.reduce((sum, r) => sum + getStats(r.id).monthCount, 0);

  const baldEagleTrend = useMemo(() => {
    const counts: Record<string, number> = {};
    practiceAttendance.forEach((a) => {
      if (regMap[a.registration_id]?.is_bald_eagle) {
        counts[a.check_in_date] = (counts[a.check_in_date] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date: format(parseISO(date), "M/d"), count }));
  }, [practiceAttendance, regMap]);

  const alerts: (Registration & { prevWeekCount: number; lastDate: string })[] = [];

  /* ───── BALD EAGLE NO-SHOW ALERT ───── */
  const { data: todayCallouts = [] } = useQuery({
    queryKey: ["today-callouts", todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("callouts" as any)
        .select("first_name, last_name")
        .eq("date", todayStr);
      return (data || []) as unknown as { first_name: string; last_name: string }[];
    },
  });

  const todayIsPracticeForAlert = useMemo(() => {
    const pdEntry = calPracticeDayMap[todayStr];
    if (pdEntry !== undefined) return pdEntry;
    const d = new Date(todayStr + "T12:00:00");
    return !isWeekend(d);
  }, [calPracticeDayMap, todayStr]);

  const todayIsExcursionForAlert = useMemo(() => !!excursionDayMap[todayStr], [excursionDayMap, todayStr]);

  const baldEagleNoShows = useMemo(() => {
    if (!todayIsPracticeForAlert || todayIsExcursionForAlert) return [];
    const estNow = new Date();
    const estHour = parseInt(estNow.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }));
    if (estHour < 20) return [];

    const todayCheckedInIds = new Set(
      calendarAttendance.filter((a) => a.check_in_date === todayStr).map((a) => a.registration_id)
    );
    const calledOutNames = new Set(
      todayCallouts.map((c) => `${c.first_name.toLowerCase()}|${c.last_name.toLowerCase()}`)
    );

    return activeBaldEagles.filter((r) => {
      if (todayCheckedInIds.has(r.id)) return false;
      if (calledOutNames.has(`${r.child_first_name.toLowerCase()}|${r.child_last_name.toLowerCase()}`)) return false;
      return true;
    });
  }, [activeBaldEagles, calendarAttendance, todayCallouts, todayStr, todayIsPracticeForAlert, todayIsExcursionForAlert]);

  /* ───── CALENDAR ───── */
  const calendarRegIds = useMemo(() => {
    let filtered = registrations;
    if (calendarFilter === "bald-eagles") filtered = filtered.filter((r) => r.is_bald_eagle);
    if (calendarProgramFilter !== "all") filtered = filtered.filter((r) => r.child_boxing_program === calendarProgramFilter);
    return new Set(filtered.map((r) => r.id));
  }, [registrations, calendarFilter, calendarProgramFilter]);

  const filteredCalendarAttendance = useMemo(
    () => calendarAttendance.filter((a) => calendarRegIds.has(a.registration_id)),
    [calendarAttendance, calendarRegIds]
  );

  const dailyCounts = useMemo(() => {
    const map: Record<string, number> = {};
    filteredCalendarAttendance.forEach((a) => { map[a.check_in_date] = (map[a.check_in_date] || 0) + 1; });
    return map;
  }, [filteredCalendarAttendance]);

  const daySignIns = useMemo(() => {
    if (!selectedDay) return [];
    // A day can carry both practice (NLA) sign-ins and an excursion roster.
    // Excursion check-ins are program_source 'Excursion' (separate query);
    // practice check-ins come from the NLA-only calendar query. Show both —
    // excursion first — so a dual day surfaces everyone.
    const excSource = isExcursionDay(selectedDay)
      ? excursionAttendanceMonth.filter((a) => a.check_in_date === selectedDay)
      : [];
    const nlaSource = filteredCalendarAttendance.filter((a) => a.check_in_date === selectedDay);
    const all = [...excSource, ...nlaSource]
      .map((a) => ({ ...a, reg: regMap[a.registration_id] }))
      .filter((a) => a.reg);
    if (!daySearch.trim()) return all;
    const q = daySearch.toLowerCase();
    return all.filter((a) => `${a.reg.child_first_name} ${a.reg.child_last_name}`.toLowerCase().includes(q));
  }, [selectedDay, filteredCalendarAttendance, excursionAttendanceMonth, isExcursionDay, regMap, daySearch]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const startDow = getDay(monthStart);
    const daysInMonth = getDaysInMonth(calendarMonth);
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarMonth]);

  /* ───── FILTERED TABLE ───── */
  const todayCheckInMap = useMemo(() => {
    const map: Record<string, string> = {};
    todayRecords.forEach((r) => {
      if (!map[r.registration_id] || r.check_in_at < map[r.registration_id]) {
        map[r.registration_id] = r.check_in_at;
      }
    });
    return map;
  }, [todayRecords]);

  const filtered = registrations
    .filter((r) => todayRegIds.has(r.id))
    .filter((r) => filter === "all" || r.is_bald_eagle)
    .filter((r) => drillDistrictFilter ? r.child_school_district === drillDistrictFilter : true)
    .filter(
      (r) =>
        r.child_first_name.toLowerCase().includes(search.toLowerCase()) ||
        r.child_last_name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (todayCheckInMap[a.id] || "").localeCompare(todayCheckInMap[b.id] || ""));

  const toggleBaldEagle = async (reg: Registration) => {
    const { error } = await supabase
      .from("youth_registrations")
      .update({ is_bald_eagle: !reg.is_bald_eagle })
      .eq("id", reg.id);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    toast.success(reg.is_bald_eagle ? "Bald Eagle removed" : "Marked as Bald Eagle");
    queryClient.invalidateQueries({ queryKey: ["registrations-attendance-full"] });
  };

  const nonEagleYouth = useMemo(() => {
    if (!addEagleOpen) return [];
    const q = eagleSearch.toLowerCase().trim();
    return registrations
      .filter((r) => !r.is_bald_eagle)
      .filter((r) => !q || `${r.child_first_name} ${r.child_last_name}`.toLowerCase().includes(q));
  }, [registrations, addEagleOpen, eagleSearch]);

  const addBaldEagle = async (reg: Registration) => {
    const { error } = await supabase
      .from("youth_registrations")
      .update({ is_bald_eagle: true })
      .eq("id", reg.id);
    if (error) { toast.error("Failed to add Bald Eagle"); return; }
    toast.success(`${reg.child_first_name} ${reg.child_last_name} marked as Bald Eagle`);
    queryClient.invalidateQueries({ queryKey: ["registrations-attendance-full"] });
  };

  const toggleEagleActive = async (reg: Registration) => {
    const newActive = !reg.bald_eagle_active;
    const { error } = await supabase
      .from("youth_registrations")
      .update({ bald_eagle_active: newActive })
      .eq("id", reg.id);
    if (error) { toast.error("Failed to update status"); return; }
    toast.success(`${reg.child_first_name} ${reg.child_last_name}: Call-Out Alert ${newActive ? "ON" : "OFF"}`);
    queryClient.invalidateQueries({ queryKey: ["registrations-attendance-full"] });
  };

  const handleRunNoShowReport = async () => {
    if (noShowReportRunning) return;
    setNoShowReportRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("report-bald-eagle-no-shows", {
        body: { date: noShowReportDate },
      });
      if (error) {
        toast.error(`Report failed: ${error.message}`);
        return;
      }
      if (data?.sent) {
        toast.success(`Email sent — ${data.no_shows} Bald Eagle no-show(s)`);
      } else if (data?.reason) {
        toast.success(`No email sent — ${data.reason}`);
      } else {
        toast.success("Report run");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Report failed");
    } finally {
      setNoShowReportRunning(false);
    }
  };

  const chartTooltipStyle = {
    backgroundColor: "#111",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "8px",
    color: "#fff",
    fontSize: 12,
  };

  return (
    <div className="space-y-8">

      {/* ═══════════ BALD EAGLE NO-SHOW ALERT ═══════════ */}
      {baldEagleNoShows.length > 0 && !noShowAlertDismissed && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-red-400 font-bold flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4" />
              🦅 Bald Eagle No-Show Alert
            </h3>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400/60 hover:text-red-400 h-6 px-2 text-xs"
              onClick={() => setNoShowAlertDismissed(true)}
            >
              Dismiss
            </Button>
          </div>
          <p className="text-white/60 text-xs mb-3">
            The following Bald Eagles did not sign in and did not call out today:
          </p>
          <div className="flex flex-wrap gap-2">
            {baldEagleNoShows.map((r) => (
              <Badge key={r.id} className="bg-red-500/20 text-red-300 border-red-500/30 text-xs py-1 px-2.5">
                <Star className="w-3 h-3 mr-1 text-amber-400" />
                {r.child_first_name} {r.child_last_name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════ ATTENDANCE INSIGHTS ═══════════ */}
      <div>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-400" /> Attendance Intelligence
          </h2>
          {/* Program-year filter — scopes the registrations underpinning
              every demographic card on this page (Race, Single Parent,
              Bald Eagles, etc.). Defaults to the current program year
              per programYear.ts; flips automatically on Aug 1. */}
          {availableProgramYears.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Program Year</span>
              <Select value={programYearFilter} onValueChange={setProgramYearFilter}>
                <SelectTrigger className="h-8 w-44 bg-white/5 border-white/15 text-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableProgramYears.map((y) => (
                    <SelectItem key={y} value={y}>{shortProgramYear(y)}{y === getProgramYearForRegistration() ? " (current)" : ""}</SelectItem>
                  ))}
                  <SelectItem value="__all__">All years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Key Insight Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-green-400/70">Attendance High</p>
              <p className="text-3xl font-bold mt-1 text-green-400">{attendanceHigh.count}</p>
              <p className="text-[10px] text-white/30">{attendanceHigh.date ? format(parseISO(attendanceHigh.date), "M/d") : "—"}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-amber-400/70">Attendance Low</p>
              <p className="text-3xl font-bold mt-1 text-amber-400">{attendanceLow.count}</p>
              <p className="text-[10px] text-white/30">{attendanceLow.date ? format(parseISO(attendanceLow.date), "M/d") : "—"}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Avg Arrival (Month)</p>
              <p className="text-2xl font-bold mt-1 flex items-center justify-center gap-1">
                <Clock className="w-4 h-4 text-white/40" />
                {avgArrivalMonth || "—"}
              </p>
              <p className="text-[10px] text-white/30">per practice day in {viewedMonthShort}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Month Avg</p>
              <p className="text-3xl font-bold mt-1">{mtdAvg}</p>
              <p className="text-[10px] text-white/30">per practice day in {viewedMonthShort}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Avg Arrival (Year)</p>
              <p className="text-2xl font-bold mt-1 flex items-center justify-center gap-1">
                <Clock className="w-4 h-4 text-white/40" />
                {avgArrivalYear || "—"}
              </p>
              <p className="text-[10px] text-white/30">per practice day since 3/9</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Year Avg</p>
              <p className="text-3xl font-bold mt-1">{yearAvg}</p>
              <p className="text-[10px] text-white/30">per practice day since 3/9</p>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════ ATTENDANCE CALENDAR (moved here after stats) ═══════════ */}
        <Card className="bg-white/5 border-white/10 text-white mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="w-5 h-5" /> Attendance Calendar
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Select value={calendarFilter} onValueChange={(v: "all" | "bald-eagles") => setCalendarFilter(v)}>
                  <SelectTrigger className="w-36 bg-white/5 border-white/20 text-white h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Youth</SelectItem>
                    <SelectItem value="bald-eagles">🦅 Bald Eagles</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={calendarProgramFilter} onValueChange={setCalendarProgramFilter}>
                  <SelectTrigger className="w-44 bg-white/5 border-white/20 text-white h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    {programs.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/10" onClick={() => setCalendarMonth((m) => subMonths(m, 1))}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <h3 className="text-lg font-semibold tracking-wide">{format(calendarMonth, "MMMM yyyy")}</h3>
              <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/10" onClick={() => setCalendarMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-white/40 py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className="aspect-square" />;
                const dateStr = format(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day), "yyyy-MM-dd");
                const dateObj = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                const isCurrentDay = isToday(dateObj);
                const isSelected = selectedDay === dateStr;
                const isPrac = isPracticeDay(dateStr, calPracticeDayMap);
                const isExc = isExcursionDay(dateStr);
                // A day can now be both. "Excursion-only" = an excursion on a
                // non-practice day (the classic Saturday trip); "dual" = a
                // practice day that also hosts an excursion.
                const excursionOnly = isExc && !isPrac;
                const dualDay = isExc && isPrac;
                // Practice and excursion are tracked separately. On an
                // excursion day the tile shows BOTH — a green practice count and
                // a purple excursion count — so neither metric is diluted.
                const practiceCount = dailyCounts[dateStr] || 0;
                const excursionCount = (excursionDailyCounts as Record<string, number>)[dateStr] || 0;
                const count = excursionOnly ? excursionCount : practiceCount;
                const hasActivity = practiceCount > 0 || excursionCount > 0;
                const weather = weatherMap[dateStr] as WeatherDay | undefined;
                const wInfo = weather ? getWeatherInfo(weather.condition_code) : null;
                const rowIndex = Math.floor(idx / 7);
                const totalRows = Math.ceil(calendarDays.length / 7);
                return (
                  <div
                    key={dateStr}
                    className="relative aspect-square"
                    onMouseEnter={() => {
                      if (weather) {
                        const timer = window.setTimeout(() => setWeatherTooltipDay(dateStr), 400);
                        (window as any).__weatherTimer = timer;
                      }
                    }}
                    onMouseLeave={() => {
                      clearTimeout((window as any).__weatherTimer);
                      setWeatherTooltipDay(null);
                    }}
                  >
                    <button
                      onClick={() => setSelectedDay(dateStr)}
                      className={`
                        w-full h-full rounded-lg p-1.5 flex flex-col items-center justify-center transition-all relative
                        ${isSelected ? "bg-blue-500/25 border border-blue-400/50 ring-1 ring-blue-400/30" : ""}
                        ${isCurrentDay && !isSelected ? "border border-white/30" : ""}
                        ${!isSelected && !isCurrentDay ? "border border-white/[0.06]" : ""}
                        ${hasActivity ? "hover:bg-white/10 cursor-pointer" : "cursor-default"}
                        ${dualDay ? "" : isExc ? "bg-purple-500/[0.08]" : !isPrac ? "bg-red-500/[0.06]" : "bg-white/[0.03]"}
                      `}
                      style={dualDay && !isSelected ? { backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.04) 48%, rgba(124,58,237,0.16) 52%, rgba(124,58,237,0.16) 100%)" } : undefined}
                    >
                      {/* Date number with weather emoji hint */}
                      <span className={`absolute top-1 right-1.5 text-[10px] leading-none flex items-center gap-0.5 ${
                        isExc ? "text-purple-400 font-medium" :
                        !isPrac ? "text-red-400 font-medium" :
                        isCurrentDay ? "text-blue-400 font-semibold" : "text-white/35"
                      }`}>
                        {wInfo ? <span className="text-[8px]">{wInfo.emoji}</span> : weatherLoading ? <span className="text-[8px] animate-pulse">·</span> : null}
                        <span className={wInfo ? "border-b border-dotted border-white/20" : ""}>{day}</span>
                      </span>

                      {isExc ? (
                        // Excursion day — two circles: green practice + purple excursion.
                        <div className="flex items-center gap-1">
                          <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                            practiceCount > 0
                              ? "bg-green-500/20 border border-green-500/40 text-green-400"
                              : "bg-white/[0.03] border border-white/[0.06] text-white/20"
                          }`}>{practiceCount}</span>
                          <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                            excursionCount > 0
                              ? "bg-purple-500/20 border border-purple-500/40 text-purple-400"
                              : "bg-purple-500/[0.03] border border-purple-500/[0.08] text-purple-400/30"
                          }`}>{excursionCount}</span>
                        </div>
                      ) : count > 0 ? (
                        <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm sm:text-base font-bold ${
                          isPrac
                            ? "bg-green-500/20 border border-green-500/40 text-green-400"
                            : "bg-red-500/20 border border-red-500/40 text-red-400"
                        }`}>{count}</span>
                      ) : (
                        <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs ${
                          isPrac
                            ? "bg-white/[0.03] border border-white/[0.06] text-white/15"
                            : "bg-red-500/[0.03] border border-red-500/[0.08] text-red-400/30"
                        }`}>{isPrac ? "0" : <X className="w-3 h-3" />}</span>
                      )}
                    </button>
                    {/* Weather tooltip - positioned outside cell */}
                    {weatherTooltipDay === dateStr && weather && wInfo && (
                      <div
                        className={`absolute z-[60] pointer-events-none left-1/2 -translate-x-1/2 ${
                          rowIndex >= Math.ceil(totalRows / 2)
                            ? "bottom-full mb-1.5"
                            : "top-full mt-1.5"
                        }`}
                      >
                        <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-left shadow-2xl min-w-[150px] whitespace-nowrap">
                          <p className="text-xs font-semibold text-white flex items-center gap-1">
                            {wInfo.emoji} {weather.condition}
                          </p>
                          <p className="text-[11px] text-white/70 mt-0.5">
                            {weather.temp_high !== null ? `${Math.round(weather.temp_high)}°F` : "—"} / {weather.temp_low !== null ? `${Math.round(weather.temp_low)}°F` : "—"}
                          </p>
                          {weather.precipitation !== null && weather.precipitation > 0 && (
                            <p className="text-[10px] text-blue-300/70 mt-0.5">
                              💧 {weather.precipitation.toFixed(2)} in
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Toggle day type dot: click cycles Non-Practice → Practice → Excursion, right-click/long-press = context menu */}
                    <button
                      onClick={(e) => { e.stopPropagation(); cycleDayType(dateStr); }}
                      onContextMenu={(e) => openDotContextMenu(e, dateStr)}
                      onTouchStart={(e) => {
                        longPressTimer.current = setTimeout(() => {
                          e.preventDefault();
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setContextMenuDay({ dateStr, x: rect.left, y: rect.bottom + 4 });
                        }, 500);
                      }}
                      onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                      onTouchMove={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                      className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all hover:scale-125 cursor-pointer z-10 touch-manipulation ${
                        isPrac
                          ? "bg-green-500 border-green-300 shadow-[0_0_4px_rgba(34,197,94,0.5)]"
                          : "bg-red-500 border-red-300 shadow-[0_0_4px_rgba(239,68,68,0.5)]"
                      }`}
                      title={
                        isPrac
                          ? "Practice day — left-click to make non-practice. Right-click to add an excursion."
                          : "Non-practice day — left-click to make practice. Right-click to add an excursion."
                      }
                    />
                    {/* Excursion overlay marker — an excursion is an add-on to
                        the day's practice status, so it gets its own purple dot
                        (top-left) rather than replacing the practice dot. */}
                    {isExc && (
                      <span
                        className="absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-purple-500 border border-purple-300 shadow-[0_0_4px_rgba(124,58,237,0.6)] z-10 pointer-events-none"
                        title="Excursion scheduled"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Context menu portal */}
            {contextMenuDay && (
              <div
                className="fixed z-[100] bg-gray-900 border border-white/20 rounded-lg shadow-2xl py-1 min-w-[200px]"
                style={{ left: contextMenuDay.x, top: contextMenuDay.y }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Practice status — independent of any excursion on the day. */}
                <button
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/10 transition-colors ${
                    isPracticeDay(contextMenuDay.dateStr, calPracticeDayMap) ? "text-green-400" : "text-white/70"
                  }`}
                  onClick={() => setDayPractice(contextMenuDay.dateStr, true)}
                >
                  <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                  Mark as Practice Day
                  {isPracticeDay(contextMenuDay.dateStr, calPracticeDayMap) && <span className="ml-auto text-green-400">✓</span>}
                </button>
                <button
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/10 transition-colors ${
                    !isPracticeDay(contextMenuDay.dateStr, calPracticeDayMap) ? "text-red-400" : "text-white/70"
                  }`}
                  onClick={() => setDayPractice(contextMenuDay.dateStr, false)}
                >
                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                  Mark as Non-Practice Day
                  {!isPracticeDay(contextMenuDay.dateStr, calPracticeDayMap) && <span className="ml-auto text-red-400">✓</span>}
                </button>

                {/* Excursion — an add-on the day can carry on top of its
                    practice status. Add/edit, and remove separately. */}
                <div className="my-1 border-t border-white/10" />
                <button
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/10 transition-colors text-white/70"
                  onClick={() => openExcursionEditor(contextMenuDay.dateStr)}
                >
                  <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
                  {isExcursionDay(contextMenuDay.dateStr) ? "Edit Excursion" : "Add Excursion"}
                  {isExcursionDay(contextMenuDay.dateStr) && <span className="ml-auto text-purple-400">✓</span>}
                </button>
                {isExcursionDay(contextMenuDay.dateStr) && (
                  <button
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-red-500/10 transition-colors text-red-400/90"
                    onClick={() => {
                      const ex = excursionsCalMonth.find((e) => e.date === contextMenuDay.dateStr);
                      setContextMenuDay(null);
                      if (ex) setDeleteExcursionTarget(ex);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Excursion
                  </button>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/10 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs text-white/50">Practice Day</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs text-white/50">Non-Practice Day</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-xs text-white/50">Excursion (can overlay a practice day)</span>
              </div>
              <span className="text-[10px] text-white/30 ml-auto">Click a day → add/edit excursion • Click dot → practice ↔ non-practice</span>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════ EXCURSIONS — month list + history ═══════════ */}
        <ExcursionHistorySection
          monthExcursions={excursionsCalMonth}
          viewedMonthShort={viewedMonthShort}
          onEdit={(exc) => setEditingExcursion(exc)}
        />

        {/* TODAY row (live, resets daily) — only when viewing current month */}
        {isCurrentMonth && [
          { label: "Today", snap: todaySnapshot, key: "today" },
        ].map(({ label, snap, key }) => (
          <div key={key} className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {/* Program Split */}
            <Card className="bg-white/5 border-white/10 text-white">
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Program Split — {label}</p>
                {snap.program.length === 0 ? (
                  <p className="text-white/30 text-sm">—</p>
                ) : (
                  <div className="space-y-1">
                    {snap.program.map(([prog, count]) => (
                      <div key={prog} className="flex justify-between items-center">
                        <span className="text-xs text-white/70 truncate">{prog.replace(/\s*\(.*\)/, "")}</span>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Boy / Girl Ratio */}
            <Card className="bg-white/5 border-white/10 text-white">
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Boy / Girl — {label}</p>
                <div className="flex items-center gap-3">
                  <div className="text-center flex-1">
                    <p className="text-2xl font-bold text-blue-400">{snap.sex["Male"] || 0}</p>
                    <p className="text-[10px] text-white/40">Boys</p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="text-center flex-1">
                    <p className="text-2xl font-bold text-pink-400">{snap.sex["Female"] || 0}</p>
                    <p className="text-[10px] text-white/40">Girls</p>
                  </div>
                </div>
                <div className="border-t border-white/10 mt-2 pt-1.5 text-center">
                  <p className="text-xs text-white/60"><span className="font-semibold text-white">{(snap.sex["Male"] || 0) + (snap.sex["Female"] || 0)}</span> Total Distinct Youth</p>
                </div>
              </CardContent>
            </Card>

            {/* Poverty % */}
            <Card className="bg-white/5 border-white/10 text-white">
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Below Poverty — {label}</p>
                <p className="text-3xl font-bold mt-1">{pct(snap.poverty.below, snap.poverty.total)}</p>
                <p className="text-[10px] text-white/30">{snap.poverty.below} of {snap.poverty.total}</p>
              </CardContent>
            </Card>

            {/* Top District */}
            <Card className="bg-white/5 border-white/10 text-white">
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/40 flex items-center justify-center gap-1">
                  <School className="w-3 h-3" /> Top District — {label}
                </p>
                {snap.topDistrict ? (
                  <>
                    <p className="text-sm font-bold mt-1.5 truncate">{snap.topDistrict[0]}</p>
                    <p className="text-[10px] text-white/30">{snap.topDistrict[1]} youth</p>
                  </>
                ) : (
                  <p className="text-white/30 text-sm mt-1">—</p>
                )}
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Second row of insight cards — only render when it wouldn't duplicate the TODAY row above.
            On current month + today-has-check-ins, the TODAY row already covers this exact data. */}
        {!(isCurrentMonth && effectiveLabel === "Today") && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {/* Program Split */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">{isCurrentMonth ? `Program Split — ${effectiveLabel}` : `Program Split — ${viewedMonthShort}`}</p>
              {programSplitToday.length === 0 ? (
                <p className="text-white/30 text-sm">—</p>
              ) : (
                <div className="space-y-1">
                  {programSplitToday.map(([prog, count]) => (
                    <div key={prog} className="flex justify-between items-center">
                      <span className="text-xs text-white/70 truncate">{prog.replace(/\s*\(.*\)/, "")}</span>
                      <span className="text-sm font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Boy / Girl Ratio */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">{isCurrentMonth ? `Boy / Girl — ${effectiveLabel}` : `Boy / Girl — ${viewedMonthShort}`}</p>
              <div className="flex items-center gap-3">
                <div className="text-center flex-1">
                  <p className="text-2xl font-bold text-blue-400">{sexSplitToday["Male"] || 0}</p>
                  <p className="text-[10px] text-white/40">Boys</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center flex-1">
                  <p className="text-2xl font-bold text-pink-400">{sexSplitToday["Female"] || 0}</p>
                  <p className="text-[10px] text-white/40">Girls</p>
                </div>
              </div>
              <div className="border-t border-white/10 mt-2 pt-1.5 text-center">
                <p className="text-xs text-white/60"><span className="font-semibold text-white">{(sexSplitToday["Male"] || 0) + (sexSplitToday["Female"] || 0)}</span> Total Distinct Youth</p>
              </div>
            </CardContent>
          </Card>

          {/* Poverty % */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">{isCurrentMonth ? `Below Poverty — ${effectiveLabel}` : `Below Poverty — ${viewedMonthShort}`}</p>
              <p className="text-3xl font-bold mt-1">{pct(povertyToday.below, povertyToday.total)}</p>
              <p className="text-[10px] text-white/30">{povertyToday.below} of {povertyToday.total}</p>
            </CardContent>
          </Card>

          {/* Top District */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40 flex items-center justify-center gap-1">
                <School className="w-3 h-3" /> {isCurrentMonth ? `Top District — ${effectiveLabel}` : `Top District — ${viewedMonthShort}`}
              </p>
              {topDistrictToday ? (
                <>
                  <p className="text-sm font-bold mt-1.5 truncate">{topDistrictToday[0]}</p>
                  <p className="text-[10px] text-white/30">{topDistrictToday[1]} youth</p>
                </>
              ) : (
                <p className="text-white/30 text-sm mt-1">—</p>
              )}
            </CardContent>
          </Card>
        </div>
        )}

        {/* MONTH-TO-DATE row — only when viewing current month (Today row is rendered above the Last Practice row) */}
        {isCurrentMonth && [
          { label: mtdLabel, snap: mtdSnapshot, key: "mtd" },
        ].map(({ label, snap, key }) => (
          <div key={key} className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {/* Program Split */}
            <Card className="bg-white/5 border-white/10 text-white">
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Program Split — {label}</p>
                {snap.program.length === 0 ? (
                  <p className="text-white/30 text-sm">—</p>
                ) : (
                  <div className="space-y-1">
                    {snap.program.map(([prog, count]) => (
                      <div key={prog} className="flex justify-between items-center">
                        <span className="text-xs text-white/70 truncate">{prog.replace(/\s*\(.*\)/, "")}</span>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Boy / Girl Ratio */}
            <Card className="bg-white/5 border-white/10 text-white">
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Boy / Girl — {label}</p>
                <div className="flex items-center gap-3">
                  <div className="text-center flex-1">
                    <p className="text-2xl font-bold text-blue-400">{snap.sex["Male"] || 0}</p>
                    <p className="text-[10px] text-white/40">Boys</p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="text-center flex-1">
                    <p className="text-2xl font-bold text-pink-400">{snap.sex["Female"] || 0}</p>
                    <p className="text-[10px] text-white/40">Girls</p>
                  </div>
                </div>
                <div className="border-t border-white/10 mt-2 pt-1.5 text-center">
                  <p className="text-xs text-white/60"><span className="font-semibold text-white">{(snap.sex["Male"] || 0) + (snap.sex["Female"] || 0)}</span> Total Distinct Youth</p>
                </div>
              </CardContent>
            </Card>

            {/* Poverty % */}
            <Card className="bg-white/5 border-white/10 text-white">
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Below Poverty — {label}</p>
                <p className="text-3xl font-bold mt-1">{pct(snap.poverty.below, snap.poverty.total)}</p>
                <p className="text-[10px] text-white/30">{snap.poverty.below} of {snap.poverty.total}</p>
              </CardContent>
            </Card>

            {/* Top District */}
            <Card className="bg-white/5 border-white/10 text-white">
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/40 flex items-center justify-center gap-1">
                  <School className="w-3 h-3" /> Top District — {label}
                </p>
                {snap.topDistrict ? (
                  <>
                    <p className="text-sm font-bold mt-1.5 truncate">{snap.topDistrict[0]}</p>
                    <p className="text-[10px] text-white/30">{snap.topDistrict[1]} youth</p>
                  </>
                ) : (
                  <p className="text-white/30 text-sm mt-1">—</p>
                )}
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Race / Ethnicity + Minority — Month-to-Date */}
        {mtdRaceBreakdown.total > 0 && (
          <div className="flex flex-col md:flex-row gap-4 mb-4 max-w-5xl">
            <Card className="bg-white/5 border-white/10 text-white flex-1 max-w-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Race / Ethnicity — {mtdLabel}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mtdRaceBreakdown.counts.map(([race, count]) => {
                    const pctVal = Math.round((count / mtdRaceBreakdown.total) * 100);
                    return (
                      <div key={race} className="flex items-center gap-3">
                        <span className="text-xs text-white/70 w-52 flex-shrink-0 truncate" title={race}>{race}</span>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden min-w-0">
                          <div
                            className="h-full bg-[#bf0f3e] rounded-full"
                            style={{ width: `${pctVal}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-white w-10 text-right tabular-nums">{pctVal}%</span>
                        <span className="text-[10px] text-white/40 w-14 text-right tabular-nums">{count} youth</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-white/30 mt-3 text-right">
                  {mtdRaceBreakdown.total} distinct youth served {isCurrentMonth ? "this month" : `in ${viewedMonthShort}`}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 text-white w-full md:w-64">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/60">Minority — {mtdLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="text-center flex-1">
                    <p className="text-3xl font-bold text-[#bf0f3e]">
                      {Math.round((mtdRaceBreakdown.minorityCount / mtdRaceBreakdown.total) * 100)}%
                    </p>
                    <p className="text-[10px] text-white/60 mt-0.5">Minority</p>
                    <p className="text-[10px] text-white/30">{mtdRaceBreakdown.minorityCount} youth</p>
                  </div>
                  <div className="w-px h-12 bg-white/10" />
                  <div className="text-center flex-1">
                    <p className="text-3xl font-bold text-white/70">
                      {Math.round((mtdRaceBreakdown.whiteCount / mtdRaceBreakdown.total) * 100)}%
                    </p>
                    <p className="text-[10px] text-white/60 mt-0.5">White</p>
                    <p className="text-[10px] text-white/30">{mtdRaceBreakdown.whiteCount} youth</p>
                  </div>
                </div>
                <div className="border-t border-white/10 mt-3 pt-1.5 text-center">
                  <p className="text-[10px] text-white/40">
                    <span className="font-semibold text-white/70">{mtdRaceBreakdown.total}</span> total youth served
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Single Parent Households — Month-to-Date
            Funder-facing demographic, focused on a single high-impact
            stat (Mom Only + Dad Only + "Single Parent Household"
            backfill label). Other family-structure answers
            (Dad and Mom, Mom + Partner, etc.) are intentionally
            excluded per the 2026-06-16 decision — Josh only wants the
            single-parent count here. */}
        {mtdSingleParentBreakdown.total > 0 && (
          <Card className="bg-white/5 border-white/10 text-white mb-4 max-w-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                <Users className="w-4 h-4" /> Single Parent Households — {mtdLabel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <p className="text-5xl font-bold text-[#bf0f3e] tabular-nums leading-none">
                    {mtdSingleParentBreakdown.singleParent}
                  </p>
                  <p className="text-[11px] text-white/60 mt-1">youth in single-parent households</p>
                </div>
                <div className="text-right ml-auto">
                  <p className="text-3xl font-bold text-white tabular-nums leading-none">
                    {Math.round((mtdSingleParentBreakdown.singleParent / mtdSingleParentBreakdown.total) * 100)}%
                  </p>
                  <p className="text-[11px] text-white/60 mt-1">
                    of {mtdSingleParentBreakdown.total} distinct youth {isCurrentMonth ? "this month" : `in ${viewedMonthShort}`}
                  </p>
                </div>
              </div>
              <div className="border-t border-white/10 mt-4 pt-3">
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1.5">Breakdown</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
                  <span><span className="font-bold text-white">{mtdSingleParentBreakdown.momOnly}</span> Mom Only</span>
                  <span><span className="font-bold text-white">{mtdSingleParentBreakdown.dadOnly}</span> Dad Only</span>
                  {mtdSingleParentBreakdown.unspecified > 0 && (
                    <span><span className="font-bold text-white">{mtdSingleParentBreakdown.unspecified}</span> Single Parent Household (unspecified)</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════ TREND CHARTS ═══════════ */}

        {/* Attendance vs Weather */}
        {dailyTrend.length > 1 && (
          <Card className="bg-white/5 border-white/10 text-white mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Attendance vs Weather — {format(calendarMonth, "MMMM yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "rgba(96,165,250,0.7)", fontSize: 10 }} tickFormatter={(v) => `${v}"`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0].payload;
                        const dateLabel = item.fullDate ? format(parseISO(item.fullDate), "MMMM d, yyyy") : item.date;
                        return (
                          <div style={{ ...chartTooltipStyle, padding: "8px 12px" }}>
                            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: 0 }}>{dateLabel}</p>
                            <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: "4px 0 0" }}>{item.count} Sign-Ins</p>
                            {item.tempMax !== null && (
                              <p style={{ color: "rgba(251,191,36,0.9)", fontSize: 11, margin: "2px 0 0" }}>High: {Math.round(item.tempMax)}°F</p>
                            )}
                            {item.precip !== null && (
                              <p style={{ color: "rgba(96,165,250,0.9)", fontSize: 11, margin: "2px 0 0" }}>Rain: {item.precip.toFixed(2)}"</p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Bar yAxisId="left" dataKey="count" name="Sign-Ins" radius={[3, 3, 0, 0]}>
                      <LabelList dataKey="count" position="top" style={{ fill: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: 600 }} />
                      {dailyTrend.map((_, i) => (
                        <Cell key={i} fill="hsl(142, 71%, 45%)" fillOpacity={0.7} />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="precip"
                      name="Precipitation (in)"
                      stroke="hsl(217, 91%, 70%)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "hsl(217, 91%, 70%)" }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {weatherCorrelation ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/5 rounded-md p-2">
                      <p className="text-white/50">Avg on dry days</p>
                      <p className="text-white font-semibold text-base">
                        {weatherCorrelation.dryAvg}
                        <span className="text-white/40 text-xs font-normal ml-1">
                          ({weatherCorrelation.dryDays} day{weatherCorrelation.dryDays === 1 ? "" : "s"})
                        </span>
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-md p-2">
                      <p className="text-white/50">Avg on rainy days</p>
                      <p className="text-white font-semibold text-base">
                        {weatherCorrelation.rainyAvg}
                        <span className="text-white/40 text-xs font-normal ml-1">
                          ({weatherCorrelation.rainyDays} day{weatherCorrelation.rainyDays === 1 ? "" : "s"})
                        </span>
                      </p>
                    </div>
                  </div>
                  {weatherCorrelation.dropPct >= 10 && weatherCorrelation.dropCount > 0 && (
                    <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-md p-3 flex items-start gap-3">
                      <TrendingDown className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-amber-300 font-semibold text-sm">
                          {weatherCorrelation.dropPct}% lower attendance on rainy days this month
                        </p>
                        <p className="text-white/60 text-xs mt-0.5">
                          About {weatherCorrelation.dropCount} fewer youth per session on the {weatherCorrelation.rainyDays} rainy days vs the {weatherCorrelation.dryDays} dry days. Single-month observation — could shift next month.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : weatherLoading ? (
                <p className="mt-2 text-xs text-white/30">Loading weather data…</p>
              ) : (
                <p className="mt-2 text-xs text-white/30">
                  Not enough rainy / dry practice days this month to compare.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Weekly Average */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Avg Attendance by Week — {format(calendarMonth, "MMMM")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyAvgData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                    <Tooltip content={({ active, payload }) => { if (!active || !payload?.length) return null; const item = payload[0].payload; return (<div style={{ ...chartTooltipStyle, padding: "8px 12px" }}><p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: 0 }}>{item.week} ({item.range})</p><p style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: "4px 0 0" }}>{item.avg} Avg/Day</p><p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, margin: "2px 0 0" }}>{item.total} total across {item.days} days</p></div>); }} />
                    <Bar dataKey="avg" name="Avg/Day" radius={[3, 3, 0, 0]}>
                      <LabelList dataKey="avg" position="top" style={{ fill: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: 600 }} />
                      {weeklyAvgData.map((d, i) => (
                        <Cell key={i} fill={d.avg === Math.max(...weeklyAvgData.map((x) => x.avg)) ? "hsl(142, 71%, 45%)" : "hsl(217, 91%, 60%)"} fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* School District Breakdown */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5" /> School District Breakdown ({viewedMonthShort})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {districtBreakdown.length === 0 ? (
                <p className="text-sm text-white/30">No data</p>
              ) : (
                <>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {districtBreakdown.map(([dist, count]) => {
                      const distTotal = districtBreakdown.reduce((s, [, c]) => s + c, 0);
                      const pctVal = distTotal > 0 ? Math.round((count / distTotal) * 100) : 0;
                      return (
                        <button
                          key={dist}
                          onClick={() => setDrillDistrictFilter(drillDistrictFilter === dist ? null : dist)}
                          className={`w-full text-left flex items-center gap-2 p-1.5 rounded hover:bg-white/5 transition-colors ${drillDistrictFilter === dist ? "bg-white/10" : ""}`}
                        >
                          <span className="text-xs text-white/70 truncate flex-1 min-w-0">{dist}</span>
                          <span className="text-xs text-white/50 tabular-nums">{pctVal}%</span>
                          <span className="text-xs font-bold text-white tabular-nums w-6 text-right">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-white/30 mt-2 text-right">
                    {districtBreakdown.reduce((s, [, c]) => s + c, 0)} total youth
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Poverty Summary */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Below Poverty Line ({viewedMonthShort})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-4">
              <p className="text-5xl font-black text-white">{pct(povertyMonth.below, povertyMonth.total)}</p>
              <p className="text-sm text-white/40 mt-1">{povertyMonth.below} of {povertyMonth.total} unique youth</p>
            </CardContent>
          </Card>
        </div>

        {/* Smart Insights */}
        {smartInsights.length > 0 && (
          <Card className="bg-white/5 border-white/10 text-white mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-400" /> Smart Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {smartInsights.map((insight, i) => (
                  <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* ═══════════ EXCURSION LOG ═══════════ */}
        <Card className="bg-purple-500/5 border-purple-500/20 text-white mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-purple-400">
              🟣 Excursion Log — {format(calendarMonth, "MMMM yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {excursionsCalMonth.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Excursions</p>
                    <p className="text-2xl font-bold mt-1 text-purple-400">{excursionsCalMonth.length}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Total Youth</p>
                    <p className="text-2xl font-bold mt-1 text-purple-400">{excursionsCalMonth.reduce((s, e) => s + (excursionCountsById[e.id] || 0), 0)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Avg Youth</p>
                    <p className="text-2xl font-bold mt-1 text-purple-400">{Math.round(excursionsCalMonth.reduce((s, e) => s + (excursionCountsById[e.id] || 0), 0) / excursionsCalMonth.length)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {excursionsCalMonth.map((exc) => (
                    <div key={exc.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/[0.06]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{exc.name}</span>
                          <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-[10px]">{excursionCountsById[exc.id] || 0} youth</Badge>
                        </div>
                        <p className="text-xs text-white/40 mt-0.5">{format(parseISO(exc.date), "EEEE, MMMM d, yyyy")}</p>
                        {exc.notes && <p className="text-xs text-white/50 mt-1">{exc.notes}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setEditingExcursion({ ...exc })} className="p-1.5 rounded hover:bg-white/10 text-white/30 hover:text-white transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteExcursionTarget(exc)} className="p-1.5 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-white/30 text-center py-4">No excursions recorded this month</p>
            )}
          </CardContent>
        </Card>


        <Card className="bg-white/5 border-white/10 text-white mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-400">
              <Eye className="w-5 h-5" /> Bald Eagles Monitor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 rounded-lg bg-white/5">
                <p className="text-[10px] uppercase tracking-wider text-white/40">{isCurrentMonth ? "Present Today" : `${viewedMonthShort} Attendance`}</p>
                <p className="text-2xl font-bold mt-1">{baldEaglesPresent}</p>
                <p className="text-[10px] text-white/30">of {activeBaldEagles.length} active</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5">
                <p className="text-[10px] uppercase tracking-wider text-white/40">{viewedMonthShort} Total</p>
                <p className="text-2xl font-bold mt-1">{baldEaglesMonth}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Month Total</p>
                <p className="text-2xl font-bold mt-1">{baldEaglesMonth}</p>
              </div>
            </div>

            {baldEagleTrend.length > 1 && (
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={baldEagleTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Line type="monotone" dataKey="count" stroke="hsl(45, 93%, 47%)" strokeWidth={2} dot={false} name="Bald Eagles" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="bg-red-500/5 border-red-500/30 text-white mb-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" /> Bald Eagles Attendance Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-white/60">Photo</TableHead>
                      <TableHead className="text-white/60">First Name</TableHead>
                      <TableHead className="text-white/60">Last Name</TableHead>
                      <TableHead className="text-white/60">Program</TableHead>
                      <TableHead className="text-white/60">Last Attended</TableHead>
                      <TableHead className="text-white/60">Last Week Practices</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((a) => (
                      <TableRow key={a.id} className="border-white/10 cursor-pointer hover:bg-white/5" onClick={() => setSelectedYouth(a)}>
                        <TableCell>
                          <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
                            {getHeadshotUrl(a.child_headshot_url) ? (
                              <img src={getHeadshotUrl(a.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="flex items-center justify-center w-full h-full text-xs text-white/40">{a.child_first_name[0]}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-white">{a.child_first_name}</TableCell>
                        <TableCell className="text-white">{a.child_last_name}</TableCell>
                        <TableCell className="text-white/60 text-xs">{a.child_boxing_program}</TableCell>
                        <TableCell className="text-white/60">{a.lastDate === "Never" ? "Never" : format(new Date(a.lastDate), "MMM d")}</TableCell>
                        <TableCell>
                          <Badge variant={a.prevWeekCount === 0 ? "destructive" : "outline"} className={a.prevWeekCount === 0 ? "" : "border-yellow-500 text-yellow-400"}>
                            {a.prevWeekCount === 0 ? "None" : `${a.prevWeekCount}`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bald Eagles Watch List with last attendance */}
          <Card className="bg-amber-500/5 border-amber-500/20 text-white">
            <CardHeader>
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-lg flex items-center gap-2 text-amber-400">
                  <Star className="w-5 h-5 fill-amber-400" /> Bald Eagles Watch List
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 bg-black border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => { setAddEagleOpen(true); setEagleSearch(""); }}
                >
                  <Users className="w-4 h-4" /> Add Bald Eagle
                </Button>
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="date"
                    value={noShowReportDate}
                    onChange={(e) => setNoShowReportDate(e.target.value)}
                    className="h-8 rounded-md bg-black border border-white/10 text-white text-xs px-2"
                    title="Day to scan for the no-show email"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 bg-black border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={handleRunNoShowReport}
                    disabled={noShowReportRunning}
                    title="Send the Bald Eagle no-show email now for the selected day"
                  >
                    <Mail className="w-4 h-4" />
                    {noShowReportRunning ? "Running…" : "Run No-Show Email"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-white/60">Photo</TableHead>
                      <TableHead className="text-white/60">First Name</TableHead>
                      <TableHead className="text-white/60">Last Name</TableHead>
                      <TableHead className="text-white/60">Program</TableHead>
                      <TableHead className="text-white/60">Call-Out Alert</TableHead>
                      <TableHead className="text-white/60">Last Attended</TableHead>
                      <TableHead className="text-white/60">This Week</TableHead>
                      <TableHead className="text-white/60">This Month</TableHead>
                      <TableHead className="text-white/60 w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baldEagles.map((r) => {
                      const stats = getStats(r.id);
                      return (
                        <TableRow key={r.id} className={`border-white/10 cursor-pointer hover:bg-white/5 ${!r.bald_eagle_active ? 'opacity-50' : ''}`} onClick={() => setSelectedYouth(r)}>
                          <TableCell>
                            <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
                              {getHeadshotUrl(r.child_headshot_url) ? (
                                <img src={getHeadshotUrl(r.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="flex items-center justify-center w-full h-full text-xs text-white/40">{r.child_first_name[0]}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-white">{r.child_first_name}</TableCell>
                          <TableCell className="text-white">{r.child_last_name}</TableCell>
                          <TableCell className="text-white/60 text-xs">{r.child_boxing_program}</TableCell>
                          <TableCell>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleEagleActive(r); }}
                              title={r.bald_eagle_active
                                ? "Turn off no-call-no-show alert for this youth"
                                : "Turn on no-call-no-show alert for this youth"}
                            >
                              <Badge
                                variant="outline"
                                className={r.bald_eagle_active
                                  ? "border-green-500/40 text-green-400 bg-green-500/10 hover:bg-green-500/20 cursor-pointer"
                                  : "border-white/20 text-white/40 bg-white/5 hover:bg-white/10 cursor-pointer"
                                }
                              >
                                {r.bald_eagle_active ? "ON" : "OFF"}
                              </Badge>
                            </button>
                          </TableCell>
                          <TableCell className="text-white/60">{stats.lastDate ? format(new Date(stats.lastDate), "MMM d") : "—"}</TableCell>
                          <TableCell className="text-white">{stats.weekCount}</TableCell>
                          <TableCell className="text-white">{stats.monthCount}</TableCell>
                          <TableCell>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleBaldEagle(r); }}
                              className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                              title="Remove Bald Eagle"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {baldEagles.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-6 text-white/30">
                          No Bald Eagles yet. Click "Add Bald Eagle" to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

      {/* Add Bald Eagle Dialog */}
      <Dialog open={addEagleOpen} onOpenChange={() => { setAddEagleOpen(false); setEagleSearch(""); }}>
        <DialogContent className="bg-black border-white/10 text-white max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <Star className="w-5 h-5 fill-amber-400" /> Add Bald Eagle
            </DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              value={eagleSearch}
              onChange={(e) => setEagleSearch(e.target.value)}
              placeholder="Search registered youth..."
              className="pl-9 bg-white/5 border-white/20 text-white placeholder:text-white/30 h-9"
              autoFocus
            />
          </div>
          <div className="space-y-1 overflow-y-auto flex-1">
            {eagleSearch.trim().length < 2 ? (
              <p className="text-sm text-white/30 text-center py-4">Type at least 2 characters to search</p>
            ) : nonEagleYouth.length === 0 ? (
              <p className="text-sm text-white/30 text-center py-4">No matching youth found</p>
            ) : (
              nonEagleYouth.slice(0, 30).map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                    {getHeadshotUrl(r.child_headshot_url) ? (
                      <img src={getHeadshotUrl(r.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full text-xs text-white/40">{r.child_first_name[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-white">{r.child_first_name} {r.child_last_name}</span>
                    <p className="text-xs text-white/40">{r.child_boxing_program}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 flex-shrink-0"
                    onClick={() => addBaldEagle(r)}
                  >
                    <Star className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>

      {/* Day Detail Modal */}
      <Dialog open={!!selectedDay} onOpenChange={() => { setSelectedDay(null); setDaySearch(""); setManualAddMode(false); setManualSearch(""); }}>
        <DialogContent className="bg-black border-white/10 text-white max-w-lg max-h-[80vh] flex flex-col">
          {selectedDay && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-blue-400" />
                    {format(new Date(selectedDay + "T12:00:00"), "EEEE, MMMM d, yyyy")}
                  </div>
                  {!manualAddMode && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setManualAddMode(true)}
                      className="border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300 h-8 text-xs"
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1" />
                      Add Youth
                    </Button>
                  )}
                </DialogTitle>
              </DialogHeader>

              {/* Manual Add Youth Section */}
              {manualAddMode && (
                <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-amber-400">Add Manual Check-In</span>
                    <button onClick={() => { setManualAddMode(false); setManualSearch(""); }} className="text-white/40 hover:text-white/60">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {/* On an excursion day, choose whether this add is practice
                      attendance or goes onto the trip roster. */}
                  {isExcursionDay(selectedDay) && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs text-white/50">Add to:</span>
                      <button
                        onClick={() => setManualAddTarget("practice")}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition-colors ${manualAddTarget === "practice" ? "bg-green-500/20 border-green-500/40 text-green-300" : "border-white/15 text-white/50 hover:bg-white/5"}`}
                      >
                        Practice
                      </button>
                      <button
                        onClick={() => setManualAddTarget("excursion")}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition-colors ${manualAddTarget === "excursion" ? "bg-purple-500/20 border-purple-500/40 text-purple-200" : "border-white/15 text-white/50 hover:bg-white/5"}`}
                      >
                        Excursion
                      </button>
                    </div>
                  )}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <Input
                      value={manualSearch}
                      onChange={(e) => setManualSearch(e.target.value)}
                      placeholder="Search youth by name..."
                      className="pl-9 bg-white/5 border-white/20 text-white placeholder:text-white/30 h-9"
                      autoFocus
                    />
                  </div>
                  {/* Show all youth when search is empty, filter when typing */}
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                    {registrations
                      .filter((r) => {
                        if (!manualSearch.trim()) return true;
                        const fullName = `${r.child_first_name} ${r.child_last_name}`.toLowerCase();
                        return fullName.includes(manualSearch.toLowerCase());
                      })
                      .slice(0, manualSearch.trim() ? 10 : 50)
                      .map((r) => {
                        // On an excursion day the target (practice vs excursion)
                        // decides both what "already checked in" means and where
                        // the add lands — a kid in practice can still be added to
                        // the trip, and vice versa.
                        const excForDay = excursionsCalMonth.find((e) => e.date === selectedDay);
                        const addToExcursion = !!excForDay && manualAddTarget === "excursion";
                        const alreadyCheckedIn = daySignIns.some((s) =>
                          s.registration_id === r.id &&
                          (addToExcursion ? s.program_source === "Excursion" : s.program_source === "NLA")
                        );
                        return (
                          <button
                            key={r.id}
                            disabled={alreadyCheckedIn || manualAdding}
                            onClick={async () => {
                              if (alreadyCheckedIn) return;
                              setManualAdding(true);
                              let error;
                              if (addToExcursion) {
                                // File as Excursion attendance (tagged with the
                                // excursion_id) so they land on the trip roster.
                                ({ error } = await supabase.rpc("admin_record_excursion_attendance", {
                                  _excursion_id: excForDay!.id,
                                  _registration_id: r.id,
                                  _check_in_date: selectedDay,
                                }));
                              } else {
                                const checkInTime = new Date(selectedDay + "T17:15:00");
                                ({ error } = await supabase.from("attendance_records").insert({
                                  registration_id: r.id,
                                  check_in_date: selectedDay,
                                  check_in_at: checkInTime.toISOString(),
                                  program_source: "NLA",
                                  is_manual: true,
                                  added_by_user_id: user?.id || null,
                                }));
                              }
                              if (error) {
                                toast.error("Failed to add check-in");
                              } else {
                                toast.success(`${addToExcursion ? "Added to excursion" : "Practice check-in added"} for ${r.child_first_name} ${r.child_last_name}`);
                                invalidateAttendance();
                                if (addToExcursion) {
                                  queryClient.invalidateQueries({ queryKey: ["excursion-attendance-month", calMonthStart, calMonthEnd] });
                                  queryClient.invalidateQueries({ queryKey: ["excursion-checkin-counts-all"] });
                                }
                                setManualSearch("");
                                setManualAddMode(false);
                              }
                              setManualAdding(false);
                            }}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                              alreadyCheckedIn ? "opacity-50 cursor-not-allowed bg-white/5" : "bg-white/5 hover:bg-white/10 cursor-pointer"
                            }`}
                          >
                            <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                              {getHeadshotUrl(r.child_headshot_url) ? (
                                <img src={getHeadshotUrl(r.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="flex items-center justify-center w-full h-full text-xs text-white/40">{r.child_first_name[0]}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <span className="text-sm font-medium text-white">{r.child_first_name} {r.child_last_name}</span>
                              {alreadyCheckedIn && <span className="ml-2 text-xs text-amber-400">Already checked in</span>}
                            </div>
                            {r.is_bald_eagle && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    {registrations.filter((r) => {
                      if (!manualSearch.trim()) return true;
                      return `${r.child_first_name} ${r.child_last_name}`.toLowerCase().includes(manualSearch.toLowerCase());
                    }).length === 0 && (
                      <p className="text-xs text-white/30 text-center py-2">No matching youth found</p>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-2 mb-2 flex items-center gap-3 flex-wrap">
                <Badge className="bg-green-500/15 text-green-400 border-green-500/30 flex-shrink-0">
                  {daySignIns.filter((s) => s.program_source === "NLA").length} Practice
                </Badge>
                {!isPracticeDay(selectedDay, calPracticeDayMap) && (
                  <Badge className="bg-red-500/15 text-red-400 border-red-500/30 flex-shrink-0">Non-Practice Day</Badge>
                )}
                {/* Excursion count sits with its own controls on the right,
                    so the green practice count reads on its own. */}
                {isExcursionDay(selectedDay) && (
                  <Badge className="ml-auto bg-purple-500/15 text-purple-300 border-purple-500/30 flex-shrink-0">
                    {daySignIns.filter((s) => s.program_source === "Excursion").length} Excursion
                  </Badge>
                )}
                {/* Add or edit the excursion for this day, right where the user
                    naturally looks after clicking a day. Closes this dialog and
                    opens the excursion editor. */}
                {isExcursionDay(selectedDay) && (() => {
                  const exc = excursionsCalMonth.find((e) => e.date === selectedDay);
                  return exc ? (
                    <button
                      onClick={() => navigate(`/admin/excursion-signups/${exc.id}`)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-purple-400/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 transition-colors flex-shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Sign-Ups
                    </button>
                  ) : null;
                })()}
                <button
                  onClick={() => { const d = selectedDay; setSelectedDay(null); openExcursionEditor(d); }}
                  className={`${isExcursionDay(selectedDay) ? "" : "ml-auto"} inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-purple-400/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 transition-colors flex-shrink-0`}
                >
                  <Bus className="w-3.5 h-3.5" />
                  {isExcursionDay(selectedDay) ? "Edit Excursion" : "Add Excursion"}
                </button>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  value={daySearch}
                  onChange={(e) => setDaySearch(e.target.value)}
                  placeholder="Search by name..."
                  className="pl-9 bg-white/5 border-white/20 text-white placeholder:text-white/30 h-9"
                />
              </div>
              <div className="space-y-1 overflow-y-auto flex-1">
                {daySignIns.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                      {getHeadshotUrl(s.reg.child_headshot_url) ? (
                        <img src={getHeadshotUrl(s.reg.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="flex items-center justify-center w-full h-full text-xs text-white/40">{s.reg.child_first_name[0]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm text-white">{s.reg.child_first_name} {s.reg.child_last_name}</span>
                        {s.reg.is_bald_eagle && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 flex-shrink-0" />}
                        {s.is_manual && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">Manual</Badge>}
                      </div>
                      <p className="text-xs text-white/40">{s.reg.child_boxing_program} · <span className={s.program_source === 'Lil Champs Corner' ? 'text-sky-400' : s.program_source === 'Excursion' ? 'text-purple-300' : 'text-green-400'}>{s.program_source}</span></p>
                    </div>
                    <span className={`text-xs flex-shrink-0 ${s.is_manual ? 'text-amber-400' : 'text-white/50'}`}>{format(new Date(s.check_in_at), "h:mm a")}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: s.id, name: `${s.reg.child_first_name} ${s.reg.child_last_name}`, date: s.check_in_date }); }}
                      className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                      title={s.is_manual ? "Remove manual check-in" : "Remove check-in"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {daySignIns.length === 0 && <p className="text-sm text-white/30 text-center py-4">No sign-ins for this day</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedYouth} onOpenChange={() => setSelectedYouth(null)}>
        <DialogContent className="bg-black border-white/10 text-white max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedYouth && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                    {getHeadshotUrl(selectedYouth.child_headshot_url) ? (
                      <img src={getHeadshotUrl(selectedYouth.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full text-lg text-white/40">{selectedYouth.child_first_name[0]}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-lg text-white">{selectedYouth.child_first_name} {selectedYouth.child_last_name}</p>
                    <p className="text-sm text-white/50 font-normal">{selectedYouth.child_boxing_program}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-sm font-medium">Bald Eagle Status</span>
                  <button onClick={() => toggleBaldEagle(selectedYouth)} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors">
                    <Star className={`w-4 h-4 ${selectedYouth.is_bald_eagle ? "fill-amber-400 text-amber-400" : "text-white/20"}`} />
                    <span className="text-sm">{selectedYouth.is_bald_eagle ? "Bald Eagle" : "Not Starred"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {(() => {
                    const stats = getStats(selectedYouth.id);
                    return (
                      <>
                        <div className="p-3 rounded-lg bg-white/5 text-center">
                          <p className="text-xs text-white/50">Last Attended</p>
                          <p className="font-semibold mt-1">{stats.lastDate ? format(new Date(stats.lastDate), "MMM d") : "—"}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 text-center">
                          <p className="text-xs text-white/50">This Week</p>
                          <p className="font-semibold mt-1">{stats.weekCount}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 text-center">
                          <p className="text-xs text-white/50">This Month</p>
                          <p className="font-semibold mt-1">{stats.monthCount}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div>
                  <h4 className="text-sm font-medium text-white/60 mb-2">Attendance History</h4>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {allAttendance.length === 0 ? (
                      <p className="text-sm text-white/30">No attendance records</p>
                    ) : (
                      allAttendance.map((a) => (
                        <div key={a.id} className="flex items-center justify-between p-2 rounded bg-white/5 text-sm">
                          <div className="flex items-center gap-2">
                            <span>{format(new Date(a.check_in_date), "EEEE, MMM d, yyyy")}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${a.program_source === 'Lil Champs Corner' ? 'bg-sky-500/15 text-sky-400' : 'bg-green-500/15 text-green-400'}`}>{a.program_source}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/40">{format(new Date(a.check_in_at), "h:mm a")}</span>
                            <button
                              onClick={() => setDeleteTarget({ id: a.id, name: `${selectedYouth!.child_first_name} ${selectedYouth!.child_last_name}`, date: a.check_in_date })}
                              className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                              title="Remove check-in"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Single Check-In Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Remove Check-In?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/70">
            This will delete <span className="font-medium text-white">{deleteTarget?.name}</span>'s check-in for <span className="font-medium text-white">{deleteTarget?.date ? format(new Date(deleteTarget.date + "T12:00:00"), "MMMM d, yyyy") : ""}</span>.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" className="border-white/20 text-white" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteSingle}>Remove Check-In</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excursion Details Modal */}
      <Dialog open={excursionModalOpen} onOpenChange={(open) => { if (!open) cancelExcursionModal(); }}>
        <DialogContent className="bg-black border-purple-500/20 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-purple-400 flex items-center gap-2">🟣 Add Excursion</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-purple-500/10 border border-purple-400/25 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-purple-200/70 font-semibold">Date</p>
              <p className="text-sm font-bold text-white">
                {excursionDate ? format(parseISO(excursionDate), "EEE, MMM d, yyyy") : "—"}
              </p>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Excursion Name *</label>
              <Input value={excursionName} onChange={(e) => setExcursionName(e.target.value)} placeholder="e.g. Beach Trip" className="bg-white/5 border-white/20 text-white" autoFocus />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Notes (optional)</label>
              <Input value={excursionNotes} onChange={(e) => setExcursionNotes(e.target.value)} placeholder="Optional notes..." className="bg-white/5 border-white/20 text-white" />
              <p className="text-[10px] text-white/30 mt-1">Youth count is tracked automatically as kids check in or get added to the roster.</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" className="border-white/20 text-white" onClick={cancelExcursionModal}>Cancel</Button>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={saveExcursion}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Excursion Modal */}
      <Dialog open={!!editingExcursion} onOpenChange={(open) => { if (!open) setEditingExcursion(null); }}>
        <DialogContent className="bg-black border-purple-500/20 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
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
                {/* Pre-trip planning: build the invite list before excursion day. */}
                <button
                  onClick={() => navigate(`/admin/excursion-signups/${editingExcursion.id}`)}
                  className="flex items-center gap-2 px-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 transition-colors font-semibold text-sm flex-shrink-0"
                >
                  <UserPlus className="w-4 h-4" /> Sign-Ups
                </button>
              </div>
              {/* Summary strip — at-a-glance headline for the trip. */}
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
                <label className="text-xs text-white/50 mb-1 block">Notes / Lessons for next year</label>
                <Input
                  value={editingExcursion.notes || ""}
                  onChange={(e) => setEditingExcursion({ ...editingExcursion, notes: e.target.value || null })}
                  placeholder="e.g. Stay 3 nights not 4 — book accordingly"
                  className="bg-white/5 border-white/20 text-white"
                />
                <p className="text-[10px] text-white/30 mt-1">Saved on the trip — visible in Excursion History next year for planning.</p>
              </div>

              {/* TRIP ROSTER — interactive editor (admin override)
                  Mirrors the same RPCs Coach Mode uses, but available
                  regardless of roster_locked_at so the admin can backfill
                  past trips that never went through the kiosk live. */}
              <div className="pt-3 mt-2 border-t border-white/10">
                <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">Ride to Excursion</p>

                {/* Vehicles + their assigned youth */}
                {editingVehicles.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {editingVehicles.map((v) => {
                      const inThisVehicle = editingRosterYouth.filter((y) => y.vehicle_id === v.id);
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
                          {inThisVehicle.length > 0 ? (
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
                            </div>
                          ) : (
                            <p className="text-xs text-white/30 italic">No youth assigned to this vehicle.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Unassigned youth — popover to assign to a vehicle */}
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

                {/* Add Vehicle — preset picker, then form */}
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

                {/* Add Youth — search + add directly to the roster */}
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

                {/* RIDE THERE vs RIDE HOME — a single comparison so you can
                    see who switched vans for the trip home (changed rows are
                    highlighted). Replaces the separate ride-home list. */}
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

                {/* Coaches & Volunteers riding along */}
                <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-2">
                    Coaches & Volunteers Riding Along {editingPersonnel.length > 0 && `(${editingPersonnel.length})`}
                  </p>
                  {editingPersonnel.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {editingPersonnel.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 pl-2 pr-1 py-0.5"
                        >
                          <span className="text-xs font-semibold">{p.name}</span>
                          <button
                            onClick={() => handleEditRemovePersonnel(p.id)}
                            className="w-4 h-4 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white"
                            aria-label="Remove"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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

              {/* Trip timeline — read-only roster lock + editable arrival/return */}
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
                        ? "border-white/20 text-white/70 hover:bg-white/10"
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
                          className="border-white/20 text-white/60 hover:text-white shrink-0"
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
                          className="border-white/20 text-white/60 hover:text-white shrink-0"
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
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-500/40 bg-red-500/5 text-red-300 hover:bg-red-500/15 hover:text-red-200"
                  onClick={() => setDeleteExcursionTarget(editingExcursion)}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" /> Delete Excursion
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="border-white/20 text-white" onClick={() => setEditingExcursion(null)}>Cancel</Button>
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={saveEditExcursion}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Convert Excursion → Practice / Non-Practice Confirmation
          Guards the calendar-tile context-menu path that used to silently
          delete the whole trip. */}
      <Dialog open={!!convertExcursionTarget} onOpenChange={(open) => { if (!open) setConvertExcursionTarget(null); }}>
        <DialogContent className="bg-zinc-900 border-red-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Convert this day from Excursion?
            </DialogTitle>
          </DialogHeader>
          {convertExcursionTarget && (() => {
            const ex = convertExcursionTarget.excursion;
            const targetLabel = convertExcursionTarget.targetType === "practice" ? "Practice Day" : "Non-Practice Day";
            const youthCount = excursionCountsById[ex.id] || 0;
            return (
              <div className="space-y-3">
                <p className="text-sm text-white/80">
                  You're switching{" "}
                  <span className="font-bold text-white">"{ex.name}"</span>{" "}
                  to a <span className="font-bold text-white">{targetLabel}</span>. This permanently deletes the trip.
                </p>
                <div className="rounded-lg bg-red-500/[0.08] border border-red-500/30 px-3 py-2.5 text-xs text-white/70 space-y-1">
                  <p className="font-bold text-red-300 mb-1">This will also delete:</p>
                  <ul className="space-y-0.5 pl-1">
                    <li>• {youthCount} youth check-in{youthCount === 1 ? "" : "s"} backfilled to this trip</li>
                    <li>• All vehicles + driver assignments</li>
                    <li>• All coaches & volunteers riding along</li>
                    <li>• Trip timeline (locked, arrived, returned)</li>
                    <li>• Notes / lessons for next year</li>
                  </ul>
                </div>
                <p className="text-xs text-yellow-200/80">
                  This action <span className="font-bold">cannot be undone</span>.
                </p>
              </div>
            );
          })()}
          <div className="flex gap-2 justify-end pt-3 mt-2 border-t border-white/10">
            <Button variant="outline" size="sm" className="border-white/20 text-white" onClick={() => setConvertExcursionTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={performExcursionConversion}>
              <Trash2 className="w-4 h-4 mr-1.5" /> Convert and Delete Trip
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Excursion Confirmation */}
      <Dialog open={!!deleteExcursionTarget} onOpenChange={(open) => { if (!open) setDeleteExcursionTarget(null); }}>
        <DialogContent className="bg-zinc-900 border-red-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Delete Excursion?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-white/80">
              You're about to permanently delete{" "}
              <span className="font-bold text-white">"{deleteExcursionTarget?.name}"</span>.
            </p>
            <div className="rounded-lg bg-red-500/[0.08] border border-red-500/30 px-3 py-2.5 text-xs text-white/70 space-y-1">
              <p className="font-bold text-red-300 mb-1">This will also delete:</p>
              {(() => {
                const isCurrent = deleteExcursionTarget?.id === editingExcursion?.id;
                const youthCount = isCurrent ? editingRosterYouth.length : null;
                const vehicleCount = isCurrent ? editingVehicles.length : null;
                const personnelCount = isCurrent ? editingPersonnel.length : null;
                return (
                  <ul className="space-y-0.5 pl-1">
                    <li>• {youthCount !== null ? `${youthCount} youth check-in${youthCount === 1 ? "" : "s"}` : "All youth check-ins for the day"}</li>
                    <li>• {vehicleCount !== null ? `${vehicleCount} vehicle${vehicleCount === 1 ? "" : "s"} + driver assignment${vehicleCount === 1 ? "" : "s"}` : "All vehicle + driver assignments"}</li>
                    <li>• {personnelCount !== null ? `${personnelCount} coach${personnelCount === 1 ? "" : "es"}/volunteer${personnelCount === 1 ? "" : "s"} riding along` : "All coaches & volunteers riding along"}</li>
                    <li>• Trip timeline (locked, arrived, returned)</li>
                    <li>• Notes / lessons for next year</li>
                  </ul>
                );
              })()}
            </div>
            <p className="text-xs text-yellow-200/80">
              The day reverts to a regular practice day. This action <span className="font-bold">cannot be undone</span>.
            </p>
          </div>
          <div className="flex gap-2 justify-end pt-3 mt-2 border-t border-white/10">
            <Button variant="outline" size="sm" className="border-white/20 text-white" onClick={() => setDeleteExcursionTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteExcursion}>
              <Trash2 className="w-4 h-4 mr-1.5" /> Yes, Delete Permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AdminAttendance;
