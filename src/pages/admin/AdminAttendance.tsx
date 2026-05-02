import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
  Clock, TrendingUp, TrendingDown, School, Lightbulb, Activity, Trash2, X, Pencil, UserPlus
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
}

interface AttendanceRecord {
  id: string;
  registration_id: string;
  check_in_date: string;
  check_in_at: string;
  program_source: string;
  is_manual: boolean;
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
}

type DayType = "practice" | "non-practice" | "excursion";

interface WeatherDay {
  date: string;
  temp_high: number | null;
  temp_low: number | null;
  precipitation: number | null;
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



const isRainyCode = (code: number | null) => code !== null && code >= 51;
const isSunnyCode = (code: number | null) => code !== null && code <= 2;

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
  const [excursionModalOpen, setExcursionModalOpen] = useState(false);
  const [excursionDate, setExcursionDate] = useState<string>("");
  const [excursionName, setExcursionName] = useState("");
  const [excursionYouthCount, setExcursionYouthCount] = useState<number | "">("");
  const [excursionNotes, setExcursionNotes] = useState("");
  const [excursionPrevState, setExcursionPrevState] = useState<boolean>(true);
  const [editingExcursion, setEditingExcursion] = useState<Excursion | null>(null);
  const [deleteExcursionTarget, setDeleteExcursionTarget] = useState<Excursion | null>(null);
  const [weatherTooltipDay, setWeatherTooltipDay] = useState<string | null>(null);
  const [contextMenuDay, setContextMenuDay] = useState<{ dateStr: string; x: number; y: number } | null>(null);
  const [noShowAlertDismissed, setNoShowAlertDismissed] = useState(false);
  const [manualAddMode, setManualAddMode] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualAdding, setManualAdding] = useState(false);
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
  };

  const getHeadshotUrl = (url: string | null): string | null => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/youth-photos/${url}`;
  };

  const calMonthStart = format(startOfMonth(calendarMonth), "yyyy-MM-dd");
  const calMonthEnd = format(endOfMonth(calendarMonth), "yyyy-MM-dd");

  /* ───── Data Queries ───── */
  const { data: registrations = [] } = useQuery({
    queryKey: ["registrations-attendance-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, child_boxing_program, child_headshot_url, is_bald_eagle, bald_eagle_active, child_sex, child_school_district, household_income_range, free_or_reduced_lunch, child_race_ethnicity")
        .order("child_last_name");
      if (error) throw error;
      return data as Registration[];
    },
  });

  /* ───── Is viewing current month? ───── */
  const isCurrentMonth = isSameMonth(calendarMonth, now);
  
  const viewedMonthShort = format(calendarMonth, "MMMM");

  // Previous month relative to viewed month (for comparison insights)
  const prevOfViewedStart = format(startOfMonth(subMonths(calendarMonth, 1)), "yyyy-MM-dd");
  const prevOfViewedEnd = format(endOfMonth(subMonths(calendarMonth, 1)), "yyyy-MM-dd");

  // Calendar month attendance (primary data source for everything)
  const { data: calendarAttendance = [] } = useQuery({
    queryKey: ["calendar-attendance", calMonthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, registration_id, check_in_date, check_in_at, program_source, is_manual")
        .eq("program_source", "NLA")
        .gte("check_in_date", calMonthStart)
        .lte("check_in_date", calMonthEnd)
        .order("check_in_at", { ascending: true });
      if (error) throw error;
      return data as AttendanceRecord[];
    },
  });

  // Full Excursion attendance records for the calendar month. Used for
  // both the per-date count on the calendar tile AND the day-detail
  // modal's roster (the main calendarAttendance query is NLA-only).
  const { data: excursionAttendanceMonth = [] } = useQuery({
    queryKey: ["excursion-attendance-month", calMonthStart, calMonthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, registration_id, check_in_date, check_in_at, program_source, is_manual, excursion_id")
        .eq("program_source", "Excursion")
        .gte("check_in_date", calMonthStart)
        .lte("check_in_date", calMonthEnd)
        .order("check_in_at", { ascending: true });
      if (error) throw error;
      return data as AttendanceRecord[];
    },
  });

  const excursionDailyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    excursionAttendanceMonth.forEach((r) => {
      counts[r.check_in_date] = (counts[r.check_in_date] || 0) + 1;
    });
    return counts;
  }, [excursionAttendanceMonth]);

  // Middle Township, NJ — site of No Limits Boxing Academy
  // Forecast API covers the last 92 days (including today); archive API for anything older.
  const { data: monthWeather } = useQuery({
    queryKey: ["month-weather", calMonthStart, calMonthEnd],
    queryFn: async () => {
      try {
        const ninetyDaysAgoStr = format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
        const useForecast = calMonthStart >= ninetyDaysAgoStr;
        const base = useForecast
          ? "https://api.open-meteo.com/v1/forecast"
          : "https://archive-api.open-meteo.com/v1/archive";
        const url = `${base}?latitude=39.1548&longitude=-74.7970&start_date=${calMonthStart}&end_date=${calMonthEnd}&daily=temperature_2m_max,precipitation_sum&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America/New_York`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const json = await res.json();
        const daily = json?.daily;
        if (!daily?.time) return null;
        const map: Record<string, { tempMax: number | null; precip: number | null }> = {};
        daily.time.forEach((d: string, i: number) => {
          map[d] = {
            tempMax: daily.temperature_2m_max?.[i] ?? null,
            precip: daily.precipitation_sum?.[i] ?? null,
          };
        });
        return map;
      } catch {
        return null;
      }
    },
    staleTime: 60 * 60 * 1000,
  });

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

  // Previous month attendance (for comparison insights)
  const { data: prevMonthAttendance = [] } = useQuery({
    queryKey: ["attendance-records-prev", prevOfViewedStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, registration_id, check_in_date, check_in_at, program_source, is_manual")
        .eq("program_source", "NLA")
        .gte("check_in_date", prevOfViewedStart)
        .lte("check_in_date", prevOfViewedEnd);
      if (error) throw error;
      return data as AttendanceRecord[];
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



  /* ───── Weather Data (Open-Meteo + DB cache) ───── */
  const { data: weatherMap = {}, isLoading: weatherLoading } = useQuery({
    queryKey: ["weather-data", calMonthStart],
    queryFn: async () => {
      // 1. Check DB cache first
      const { data: cached } = await supabase
        .from("weather_data")
        .select("date, temp_high, temp_low, precipitation, condition, condition_code")
        .eq("location", "rio_grande_nj")
        .gte("date", calMonthStart)
        .lte("date", calMonthEnd);

      const cachedMap: Record<string, WeatherDay> = {};
      (cached || []).forEach((w: any) => { cachedMap[w.date] = w; });

      // Check if we have all days
      const daysInMonth = getDaysInMonth(calendarMonth);
      const missingDates: string[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = format(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d), "yyyy-MM-dd");
        if (!cachedMap[ds]) missingDates.push(ds);
      }

      if (missingDates.length === 0) return cachedMap;

      // 2. Fetch from Open-Meteo — split into historical and forecast ranges
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = format(today, "yyyy-MM-dd");
        const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
        const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);

        const params = "daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America/New_York&latitude=39.0018&longitude=-74.8774";

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
          for (let i = 0; i < daily.time.length; i++) {
            const dateStr = daily.time[i];
            if (cachedMap[dateStr]) continue;
            const code = daily.weather_code?.[i] ?? null;
            const info = getWeatherInfo(code);
            const row = {
              date: dateStr,
              location: "rio_grande_nj",
              temp_high: daily.temperature_2m_max?.[i] ?? null,
              temp_low: daily.temperature_2m_min?.[i] ?? null,
              precipitation: daily.precipitation_sum?.[i] ?? null,
              condition: info.label,
              condition_code: code,
            };
            rows.push(row);
            cachedMap[dateStr] = row as WeatherDay;
          }
        }

        // Save to DB (fire and forget)
        if (rows.length > 0) {
          supabase.from("weather_data").upsert(rows, { onConflict: "date,location" }).then();
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

  /* ───── Filter attendance to practice days only (exclude excursion days) ───── */
  const practiceAttendance = useMemo(
    () => calendarAttendance.filter((a) => isPracticeDay(a.check_in_date, calPracticeDayMap) && !isExcursionDay(a.check_in_date)),
    [calendarAttendance, calPracticeDayMap, isPracticeDay, isExcursionDay]
  );

  const prevPracticeAttendance = useMemo(
    () => prevMonthAttendance.filter((a) => isPracticeDay(a.check_in_date, prevPracticeDayMap) && !prevExcursionDayMap[a.check_in_date]),
    [prevMonthAttendance, prevPracticeDayMap, isPracticeDay, prevExcursionDayMap]
  );

  /* ───── Quick Toggle: single click cycles Practice → Non-Practice → Excursion → Practice … ───── */
  const cycleDayType = async (dateStr: string) => {
    const isExc = isExcursionDay(dateStr);
    const isPrac = isPracticeDay(dateStr, calPracticeDayMap);

    if (isExc) {
      // Purple → Green
      await setDayType(dateStr, "practice");
      return;
    }
    if (!isPrac) {
      // Red → open Excursion modal (cancel will revert to Green)
      await setDayType(dateStr, "excursion");
      return;
    }
    // Green → Red
    await setDayType(dateStr, "non-practice");
  };

  /* ───── Context menu: set day type explicitly ───── */
  const setDayType = async (dateStr: string, type: "practice" | "non-practice" | "excursion") => {
    setContextMenuDay(null);
    const existingPracticeDay = practiceDaysCalMonth.find((p) => p.date === dateStr);
    const existingExcursion = excursionsCalMonth.find((e) => e.date === dateStr);
    const isExc = isExcursionDay(dateStr);

    if (type === "excursion") {
      // If already excursion, open edit modal with existing data
      if (isExc && existingExcursion) {
        setEditingExcursion(existingExcursion);
        return;
      }
      // Open new excursion modal, pre-populate youth count from sign-ins
      setExcursionDate(dateStr);
      setExcursionName("");
      setExcursionYouthCount(dailyCounts[dateStr] || 0);
      setExcursionNotes("");
      setExcursionPrevState(isPracticeDay(dateStr, calPracticeDayMap));
      setExcursionModalOpen(true);
      return;
    }

    // If currently an excursion, remove it first
    if (isExc && existingExcursion) {
      await supabase.from("excursions").delete().eq("id", existingExcursion.id);
      queryClient.invalidateQueries({ queryKey: ["excursions-cal"] });
    }

    const isPracTarget = type === "practice";
    if (existingPracticeDay) {
      await supabase.from("practice_days").update({ is_practice_day: isPracTarget }).eq("id", existingPracticeDay.id);
    } else {
      await supabase.from("practice_days").insert({ date: dateStr, is_practice_day: isPracTarget });
    }
    queryClient.invalidateQueries({ queryKey: ["practice-days-cal"] });
    toast.success(isPracTarget ? "Marked as practice day" : "Marked as non-practice day");
  };

  const openDotContextMenu = (e: React.MouseEvent | React.TouchEvent, dateStr: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenuDay({ dateStr, x: rect.left, y: rect.bottom + 4 });
  };

  const saveExcursion = async () => {
    if (!excursionName.trim() || excursionYouthCount === "" || excursionYouthCount < 0) {
      toast.error("Please fill in excursion name and youth count");
      return;
    }
    const { error } = await supabase.from("excursions").insert({
      date: excursionDate,
      name: excursionName.trim(),
      youth_count: Number(excursionYouthCount),
      notes: excursionNotes.trim() || null,
    });
    if (error) { toast.error("Failed to save excursion"); return; }
    // Also mark as non-practice (excursion days aren't practice)
    const existing = practiceDaysCalMonth.find((p) => p.date === excursionDate);
    if (existing) {
      await supabase.from("practice_days").update({ is_practice_day: false }).eq("id", existing.id);
    } else {
      await supabase.from("practice_days").insert({ date: excursionDate, is_practice_day: false });
    }
    queryClient.invalidateQueries({ queryKey: ["excursions-cal"] });
    queryClient.invalidateQueries({ queryKey: ["practice-days-cal"] });
    setExcursionModalOpen(false);
    toast.success("Excursion saved");
  };

  const cancelExcursionModal = async () => {
    const dateStr = excursionDate;
    setExcursionModalOpen(false);
    if (!dateStr) return;
    // Revert the day to Practice (green) so cancel always lands on Green,
    // even if the user reached the modal from a Non-Practice (red) click.
    const existing = practiceDaysCalMonth.find((p) => p.date === dateStr);
    if (existing) {
      await supabase.from("practice_days").update({ is_practice_day: true }).eq("id", existing.id);
    } else {
      await supabase.from("practice_days").insert({ date: dateStr, is_practice_day: true });
    }
    queryClient.invalidateQueries({ queryKey: ["practice-days-cal"] });
  };

  const handleDeleteExcursion = async () => {
    if (!deleteExcursionTarget) return;
    const { error } = await supabase.from("excursions").delete().eq("id", deleteExcursionTarget.id);
    if (error) { toast.error("Failed to delete excursion"); return; }
    // Revert to practice day (CASCADE deletes already wiped attendance,
    // vehicles, assignments, and personnel rows).
    const existing = practiceDaysCalMonth.find((p) => p.date === deleteExcursionTarget.date);
    if (existing) {
      await supabase.from("practice_days").update({ is_practice_day: true }).eq("id", existing.id);
    }
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
      return data as Array<{ id: string; name: string; created_at: string }>;
    },
  });

  const saveEditExcursion = async () => {
    if (!editingExcursion) return;
    const { error } = await supabase.from("excursions").update({
      name: editingExcursion.name,
      youth_count: editingExcursion.youth_count,
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

  /* ───── YTD practice attendance (green-only, excl. excursions), since 2026-03-09 ───── */
  const ytdPracticeDayMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    ytdPracticeDays.forEach((p) => { m[p.date] = p.is_practice_day; });
    return m;
  }, [ytdPracticeDays]);

  const ytdExcursionSet = useMemo(() => {
    const s = new Set<string>();
    ytdExcursions.forEach((e: { date: string }) => { s.add(e.date); });
    return s;
  }, [ytdExcursions]);

  const ytdPracticeAttendance = useMemo(
    () => ytdAttendance.filter((a) =>
      isPracticeDay(a.check_in_date, ytdPracticeDayMap) && !ytdExcursionSet.has(a.check_in_date)
    ),
    [ytdAttendance, ytdPracticeDayMap, ytdExcursionSet, isPracticeDay]
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
        const weather = monthWeather?.[date];
        return {
          date: format(parseISO(date), "M/d"),
          count,
          fullDate: date,
          tempMax: weather?.tempMax ?? null,
          precip: weather?.precip ?? null,
        };
      });
  }, [practiceAttendance, monthWeather]);

  /* ───── WEATHER vs ATTENDANCE CORRELATION ───── */
  const weatherCorrelation = useMemo(() => {
    const RAIN_THRESHOLD_IN = 0.1; // >= 0.1" counts as a rainy practice day
    const withWeather = dailyTrend.filter((d) => d.precip !== null);
    if (withWeather.length === 0) return null;
    const rainy = withWeather.filter((d) => (d.precip ?? 0) >= RAIN_THRESHOLD_IN);
    const dry = withWeather.filter((d) => (d.precip ?? 0) < RAIN_THRESHOLD_IN);
    const avg = (rows: typeof withWeather) =>
      rows.length === 0 ? 0 : Math.round(rows.reduce((s, r) => s + r.count, 0) / rows.length);
    const rainyAvg = avg(rainy);
    const dryAvg = avg(dry);
    const dropPct = dryAvg > 0 ? Math.round(((dryAvg - rainyAvg) / dryAvg) * 100) : 0;
    return {
      rainyAvg,
      dryAvg,
      rainyDays: rainy.length,
      dryDays: dry.length,
      dropPct,
      dropCount: dryAvg - rainyAvg,
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

    /* ── Weather-based insights ── */
    const weatherEntries = Object.values(weatherMap) as WeatherDay[];
    const practiceDailyCountsMap: Record<string, number> = {};
    practiceAttendance.forEach((a) => { practiceDailyCountsMap[a.check_in_date] = (practiceDailyCountsMap[a.check_in_date] || 0) + 1; });

    if (weatherEntries.length >= 3) {
      // Rainy vs sunny
      const rainyDays = weatherEntries.filter((w) => isRainyCode(w.condition_code) && practiceDailyCountsMap[w.date] !== undefined);
      const sunnyDays = weatherEntries.filter((w) => isSunnyCode(w.condition_code) && practiceDailyCountsMap[w.date] !== undefined);

      if (rainyDays.length >= 2 && sunnyDays.length >= 2) {
        const rainyAvg = Math.round(rainyDays.reduce((s, w) => s + (practiceDailyCountsMap[w.date] || 0), 0) / rainyDays.length);
        const sunnyAvg = Math.round(sunnyDays.reduce((s, w) => s + (practiceDailyCountsMap[w.date] || 0), 0) / sunnyDays.length);
        if (sunnyAvg > 0 && rainyAvg < sunnyAvg) {
          const diff = Math.round(((sunnyAvg - rainyAvg) / sunnyAvg) * 100);
          insights.push(`🌧️ Rainy days average ${diff}% lower attendance than sunny days this month.`);
        }
      }

      // Cold vs warm
      const withTemp = weatherEntries.filter((w) => w.temp_high !== null && practiceDailyCountsMap[w.date] !== undefined);
      if (withTemp.length >= 4) {
        const temps = withTemp.map((w) => w.temp_high!).sort((a, b) => a - b);
        const coldThresh = temps[Math.floor(temps.length * 0.25)];
        const coldDays = withTemp.filter((w) => w.temp_high! <= coldThresh);
        const warmDays = withTemp.filter((w) => w.temp_high! > coldThresh);
        if (coldDays.length >= 2 && warmDays.length >= 2) {
          const coldAvg = Math.round(coldDays.reduce((s, w) => s + (practiceDailyCountsMap[w.date] || 0), 0) / coldDays.length);
          const warmAvg = Math.round(warmDays.reduce((s, w) => s + (practiceDailyCountsMap[w.date] || 0), 0) / warmDays.length);
          insights.push(`🌡️ Coldest days (below ${Math.round(coldThresh)}°F) had avg attendance of ${coldAvg} vs ${warmAvg} on warmer days.`);
        }
      }

      // Best weather condition
      const conditionGroups: Record<string, number[]> = {};
      weatherEntries.forEach((w) => {
        if (practiceDailyCountsMap[w.date] !== undefined && w.condition) {
          if (!conditionGroups[w.condition]) conditionGroups[w.condition] = [];
          conditionGroups[w.condition].push(practiceDailyCountsMap[w.date] || 0);
        }
      });
      let bestCondition = "";
      let bestAvg = 0;
      Object.entries(conditionGroups).forEach(([cond, counts]) => {
        if (counts.length >= 2) {
          const avg = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);
          if (avg > bestAvg) { bestAvg = avg; bestCondition = cond; }
        }
      });
      if (bestCondition) {
        insights.push(`☀️ Highest attendance this month occurred on ${bestCondition} days (avg ${bestAvg}).`);
      }
    }

    /* ── Excursion insights ── */
    if (excursionsCalMonth.length > 0) {
      const totalYouthExc = excursionsCalMonth.reduce((s, e) => s + e.youth_count, 0);
      insights.push(`🟣 ${excursionsCalMonth.length} Excursion${excursionsCalMonth.length > 1 ? "s" : ""} this month reached ${totalYouthExc} youth total.`);
    }

    return insights;
  }, [weeklyAvgData, practiceAttendance, regMap, topDistrictToday, totalPresentToday, avgArrivalMonth, prevPracticeAttendance, mtdAvg, isCurrentMonth, viewedMonthShort, calendarMonth, weatherMap, excursionsCalMonth]);

  /* ───── BALD EAGLES ───── */
  const baldEagles = registrations.filter((r) => r.is_bald_eagle);
  const activeBaldEagles = baldEagles.filter((r) => r.bald_eagle_active);
  const baldEaglesPresent = isCurrentMonth ? activeBaldEagles.filter((r) => getStats(r.id).present).length : 0;
  const baldEaglesMonth = activeBaldEagles.reduce((sum, r) => sum + getStats(r.id).monthCount, 0);

  const baldEagleTrend = useMemo(() => {
    const counts: Record<string, number> = {};
    practiceAttendance.forEach((a) => {
      if (regMap[a.registration_id]?.is_bald_eagle && regMap[a.registration_id]?.bald_eagle_active) {
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
    // On Excursion days the kiosk records check-ins with program_source =
    // 'Excursion', which the main NLA-only query excludes. Pull from the
    // separate Excursion-attendance query for those days.
    const isExc = isExcursionDay(selectedDay);
    const source = isExc
      ? excursionAttendanceMonth.filter((a) => a.check_in_date === selectedDay)
      : filteredCalendarAttendance.filter((a) => a.check_in_date === selectedDay);
    const all = source
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
    toast.success(`${reg.child_first_name} ${reg.child_last_name} set to ${newActive ? "Active" : "Inactive"}`);
    queryClient.invalidateQueries({ queryKey: ["registrations-attendance-full"] });
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-400" /> Attendance Intelligence
          </h2>
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
                // On Excursion days, show the count of Excursion check-ins
                // (program_source = 'Excursion'), not the NLA practice count.
                const count = isExc
                  ? (excursionDailyCounts as Record<string, number>)[dateStr] || 0
                  : dailyCounts[dateStr] || 0;
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
                        ${count > 0 ? "hover:bg-white/10 cursor-pointer" : "cursor-default"}
                        ${isExc ? "bg-purple-500/[0.08]" : !isPrac ? "bg-red-500/[0.06]" : "bg-white/[0.03]"}
                      `}
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

                      {count > 0 ? (
                        <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm sm:text-base font-bold ${
                          isExc
                            ? "bg-purple-500/20 border border-purple-500/40 text-purple-400"
                            : isPrac
                              ? "bg-green-500/20 border border-green-500/40 text-green-400"
                              : "bg-red-500/20 border border-red-500/40 text-red-400"
                        }`}>{count}</span>
                      ) : (
                        <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs ${
                          isExc
                            ? "bg-purple-500/[0.03] border border-purple-500/[0.08] text-purple-400/30"
                            : isPrac
                              ? "bg-white/[0.03] border border-white/[0.06] text-white/15"
                              : "bg-red-500/[0.03] border border-red-500/[0.08] text-red-400/30"
                        }`}>{isExc ? "0" : isPrac ? "0" : <X className="w-3 h-3" />}</span>
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
                        isExc
                          ? "bg-purple-500 border-purple-300 shadow-[0_0_4px_rgba(124,58,237,0.5)]"
                          : isPrac
                            ? "bg-green-500 border-green-300 shadow-[0_0_4px_rgba(34,197,94,0.5)]"
                            : "bg-red-500 border-red-300 shadow-[0_0_4px_rgba(239,68,68,0.5)]"
                      }`}
                      title={
                        isExc
                          ? "Excursion — left-click to remove and make practice"
                          : isPrac
                            ? "Practice — left-click to make non-practice day"
                            : "Non-Practice — left-click to mark as excursion"
                      }
                    />
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
                <button
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/10 transition-colors ${
                    isPracticeDay(contextMenuDay.dateStr, calPracticeDayMap) && !isExcursionDay(contextMenuDay.dateStr) ? "text-green-400" : "text-white/70"
                  }`}
                  onClick={() => setDayType(contextMenuDay.dateStr, "practice")}
                >
                  <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                  Mark as Practice Day
                  {isPracticeDay(contextMenuDay.dateStr, calPracticeDayMap) && !isExcursionDay(contextMenuDay.dateStr) && <span className="ml-auto text-green-400">✓</span>}
                </button>
                <button
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/10 transition-colors ${
                    !isPracticeDay(contextMenuDay.dateStr, calPracticeDayMap) && !isExcursionDay(contextMenuDay.dateStr) ? "text-red-400" : "text-white/70"
                  }`}
                  onClick={() => setDayType(contextMenuDay.dateStr, "non-practice")}
                >
                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                  Mark as Non-Practice Day
                  {!isPracticeDay(contextMenuDay.dateStr, calPracticeDayMap) && !isExcursionDay(contextMenuDay.dateStr) && <span className="ml-auto text-red-400">✓</span>}
                </button>
                <button
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/10 transition-colors ${
                    isExcursionDay(contextMenuDay.dateStr) ? "text-purple-400" : "text-white/70"
                  }`}
                  onClick={() => setDayType(contextMenuDay.dateStr, "excursion")}
                >
                  <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
                  {isExcursionDay(contextMenuDay.dateStr) ? "Edit Excursion Day" : "Mark as Excursion Day"}
                  {isExcursionDay(contextMenuDay.dateStr) && <span className="ml-auto text-purple-400">✓</span>}
                </button>
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
                <span className="text-xs text-white/50">Excursion Day</span>
              </div>
              <span className="text-[10px] text-white/30 ml-auto">Click dot to toggle • Right-click for more options</span>
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
              {weatherCorrelation && weatherCorrelation.rainyDays > 0 && weatherCorrelation.dryDays > 0 && (
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
                  {weatherCorrelation.dropPct > 0 && (
                    <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-md p-3 flex items-start gap-3">
                      <TrendingDown className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-amber-300 font-semibold text-sm">
                          {weatherCorrelation.dropPct}% drop in attendance on rainy days
                        </p>
                        <p className="text-white/60 text-xs mt-0.5">
                          Roughly {weatherCorrelation.dropCount} fewer youth per session when it rains — a funding opportunity for reliable transportation or weather-resistant outreach.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
              {!monthWeather && (
                <p className="mt-2 text-xs text-white/30">Loading weather data…</p>
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
                    <p className="text-2xl font-bold mt-1 text-purple-400">{excursionsCalMonth.reduce((s, e) => s + e.youth_count, 0)}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Avg Youth</p>
                    <p className="text-2xl font-bold mt-1 text-purple-400">{Math.round(excursionsCalMonth.reduce((s, e) => s + e.youth_count, 0) / excursionsCalMonth.length)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {excursionsCalMonth.map((exc) => (
                    <div key={exc.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/[0.06]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{exc.name}</span>
                          <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-[10px]">{exc.youth_count} youth</Badge>
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
              <div className="flex items-center gap-3">
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
                      <TableHead className="text-white/60">Status</TableHead>
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
                              title={r.bald_eagle_active ? "Set Inactive" : "Set Active"}
                            >
                              <Badge
                                variant="outline"
                                className={r.bald_eagle_active
                                  ? "border-green-500/40 text-green-400 bg-green-500/10 hover:bg-green-500/20 cursor-pointer"
                                  : "border-white/20 text-white/40 bg-white/5 hover:bg-white/10 cursor-pointer"
                                }
                              >
                                {r.bald_eagle_active ? "Active" : "Inactive"}
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
                      className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 h-8 text-xs"
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
                        const alreadyCheckedIn = daySignIns.some((s) => s.registration_id === r.id);
                        return (
                          <button
                            key={r.id}
                            disabled={alreadyCheckedIn || manualAdding}
                            onClick={async () => {
                              if (alreadyCheckedIn) return;
                              setManualAdding(true);
                              const checkInTime = new Date(selectedDay + "T17:15:00");
                              const { error } = await supabase.from("attendance_records").insert({
                                registration_id: r.id,
                                check_in_date: selectedDay,
                                check_in_at: checkInTime.toISOString(),
                                program_source: "NLA",
                                is_manual: true,
                                added_by_user_id: user?.id || null,
                              });
                              if (error) {
                                toast.error("Failed to add check-in");
                              } else {
                                toast.success(`Manual check-in added for ${r.child_first_name} ${r.child_last_name}`);
                                invalidateAttendance();
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
                <Badge className={`${isExcursionDay(selectedDay) ? "bg-purple-500/15 text-purple-300 border-purple-500/30" : "bg-green-500/15 text-green-400 border-green-500/30"} flex-shrink-0`}>
                  {daySignIns.length} youth {isExcursionDay(selectedDay) ? "on Excursion" : "signed in"}
                </Badge>
                {isExcursionDay(selectedDay) ? (
                  <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 flex-shrink-0">Excursion Day</Badge>
                ) : !isPracticeDay(selectedDay, calPracticeDayMap) ? (
                  <Badge className="bg-red-500/15 text-red-400 border-red-500/30 flex-shrink-0">Non-Practice Day</Badge>
                ) : null}
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
                      <p className="text-xs text-white/40">{s.reg.child_boxing_program} · <span className={s.program_source === 'Lil Champs Corner' ? 'text-sky-400' : 'text-green-400'}>{s.program_source}</span></p>
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
            <div>
              <label className="text-xs text-white/50 mb-1 block">Excursion Name *</label>
              <Input value={excursionName} onChange={(e) => setExcursionName(e.target.value)} placeholder="e.g. Beach Trip" className="bg-white/5 border-white/20 text-white" autoFocus />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Number of Youth *</label>
              <Input type="number" min={0} value={excursionYouthCount} onChange={(e) => setExcursionYouthCount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" className="bg-white/5 border-white/20 text-white" />
              <p className="text-[10px] text-white/30 mt-1">Auto-filled from sign-ins — edit if needed</p>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Notes (optional)</label>
              <Input value={excursionNotes} onChange={(e) => setExcursionNotes(e.target.value)} placeholder="Optional notes..." className="bg-white/5 border-white/20 text-white" />
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
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                    Actual Youth Checked In
                  </p>
                  <p className="text-2xl font-black tabular-nums text-emerald-300">
                    {editingRosterYouth.length}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Planning estimate</label>
                  <Input type="number" min={0} value={editingExcursion.youth_count} onChange={(e) => setEditingExcursion({ ...editingExcursion, youth_count: Number(e.target.value) })} className="bg-white/5 border-white/20 text-white" />
                  <p className="text-[10px] text-white/30 mt-1">Pre-trip estimate; not the live count.</p>
                </div>
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

              {/* TRIP ROSTER — read-only mirror of Coach Mode locked view */}
              {(editingVehicles.length > 0 || editingRosterYouth.length > 0 || editingPersonnel.length > 0) && (
                <div className="pt-3 mt-2 border-t border-white/10">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">Trip Roster</p>

                  {editingVehicles.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {editingVehicles.map((v) => {
                        const inThisVehicle = editingRosterYouth.filter((y) => y.vehicle_id === v.id);
                        return (
                          <div key={v.id} className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-sm font-bold text-purple-200">🚐 {v.name}</p>
                              <span className="text-xs text-white/50 tabular-nums">
                                {v.assigned_count}/{v.seat_cap} seats
                              </span>
                            </div>
                            <p className="text-xs text-white/50 mb-2">
                              Driver: <span className="text-white/80 font-semibold">{v.driver_name}</span>
                            </p>
                            {inThisVehicle.length > 0 ? (
                              <ul className="text-xs text-white/70 space-y-0.5 pl-1">
                                {inThisVehicle.map((y) => (
                                  <li key={y.registration_id}>
                                    • {y.child_first_name} {y.child_last_name}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-white/30 italic">No youth assigned to this vehicle.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(() => {
                    const unassigned = editingRosterYouth.filter((y) => !y.vehicle_id);
                    if (unassigned.length === 0) return null;
                    return (
                      <div className="rounded-lg bg-yellow-500/[0.05] border border-yellow-400/20 p-3 mb-3">
                        <p className="text-xs font-bold text-yellow-200/80 mb-1.5">
                          Youth not assigned to any vehicle ({unassigned.length})
                        </p>
                        <ul className="text-xs text-white/70 space-y-0.5 pl-1">
                          {unassigned.map((y) => (
                            <li key={y.registration_id}>
                              • {y.child_first_name} {y.child_last_name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}

                  {editingPersonnel.length > 0 && (
                    <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
                      <p className="text-xs font-bold text-white/60 mb-1.5">
                        Coaches & Volunteers riding along ({editingPersonnel.length})
                      </p>
                      <ul className="text-xs text-white/70 space-y-0.5 pl-1">
                        {editingPersonnel.map((p) => (
                          <li key={p.id}>• {p.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-[10px] text-white/30 mt-2">
                    Read-only summary. To change vehicle assignments or personnel, use Coach Mode.
                  </p>
                </div>
              )}

              {/* Trip timeline — read-only roster lock + editable arrival/return */}
              <div className="pt-3 mt-2 border-t border-white/10">
                <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Trip Timeline</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">Roster Locked</span>
                    <span className="text-white/80 tabular-nums">
                      {editingExcursion.roster_locked_at
                        ? new Date(editingExcursion.roster_locked_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                        : "—"}
                    </span>
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
