import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Star, Search, AlertTriangle, Users, Eye, ChevronLeft, ChevronRight, CalendarDays,
  Clock, TrendingUp, School, Lightbulb, Activity, Trash2, X
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, LabelList,
} from "recharts";
import {
  startOfMonth, endOfMonth, format,
  addMonths, subMonths, getDay, getDaysInMonth, isToday, parseISO,
  isWeekend, isSameMonth,
} from "date-fns";
import { toast } from "sonner";

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
}

interface AttendanceRecord {
  id: string;
  registration_id: string;
  check_in_date: string;
  check_in_at: string;
  program_source: string;
}

interface PracticeDay {
  id: string;
  date: string;
  is_practice_day: boolean;
}

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

const celsiusToF = (c: number) => Math.round(c * 9 / 5 + 32);
const mmToInches = (mm: number) => Math.round(mm / 25.4 * 100) / 100;

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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (url.startsWith("youth-photos/")) {
      return `${supabaseUrl}/storage/v1/object/public/youth-photos/${url}`;
    }
    return `${supabaseUrl}/storage/v1/object/public/registration-signatures/${url}`;
  };

  const calMonthStart = format(startOfMonth(calendarMonth), "yyyy-MM-dd");
  const calMonthEnd = format(endOfMonth(calendarMonth), "yyyy-MM-dd");

  /* ───── Data Queries ───── */
  const { data: registrations = [] } = useQuery({
    queryKey: ["registrations-attendance-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, child_boxing_program, child_headshot_url, is_bald_eagle, bald_eagle_active, child_sex, child_school_district, household_income_range, free_or_reduced_lunch")
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
        .select("id, registration_id, check_in_date, check_in_at, program_source")
        .eq("program_source", "NLA")
        .gte("check_in_date", calMonthStart)
        .lte("check_in_date", calMonthEnd)
        .order("check_in_at", { ascending: true });
      if (error) throw error;
      return data as AttendanceRecord[];
    },
  });

  // Previous month attendance (for comparison insights)
  const { data: prevMonthAttendance = [] } = useQuery({
    queryKey: ["attendance-records-prev", prevOfViewedStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, registration_id, check_in_date, check_in_at, program_source")
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
        .select("id, registration_id, check_in_date, check_in_at, program_source")
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

  /* ───── Practice Day Helper ───── */
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

  /* ───── Filter attendance to practice days only ───── */
  const practiceAttendance = useMemo(
    () => calendarAttendance.filter((a) => isPracticeDay(a.check_in_date, calPracticeDayMap)),
    [calendarAttendance, calPracticeDayMap, isPracticeDay]
  );

  const prevPracticeAttendance = useMemo(
    () => prevMonthAttendance.filter((a) => isPracticeDay(a.check_in_date, prevPracticeDayMap)),
    [prevMonthAttendance, prevPracticeDayMap, isPracticeDay]
  );

  /* ───── Toggle Practice Day ───── */
  const togglePracticeDay = async (dateStr: string) => {
    const currentValue = isPracticeDay(dateStr, calPracticeDayMap);
    const newValue = !currentValue;
    const existing = practiceDaysCalMonth.find((p) => p.date === dateStr);

    if (existing) {
      await supabase.from("practice_days").update({ is_practice_day: newValue }).eq("id", existing.id);
    } else {
      await supabase.from("practice_days").insert({ date: dateStr, is_practice_day: newValue });
    }

    queryClient.invalidateQueries({ queryKey: ["practice-days-cal"] });
    queryClient.invalidateQueries({ queryKey: ["practice-days-prev"] });
    toast.success(newValue ? "Marked as practice day" : "Marked as non-practice day");
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

  // Peak day for past months
  const peakDay = useMemo(() => {
    if (isCurrentMonth) return { count: totalPresentToday, date: todayStr };
    const dayCounts: Record<string, Set<string>> = {};
    practiceAttendance.forEach((a) => {
      if (!dayCounts[a.check_in_date]) dayCounts[a.check_in_date] = new Set();
      dayCounts[a.check_in_date].add(a.registration_id);
    });
    let maxDate = "";
    let maxCount = 0;
    Object.entries(dayCounts).forEach(([date, ids]) => {
      if (ids.size > maxCount) { maxCount = ids.size; maxDate = date; }
    });
    return { count: maxCount, date: maxDate };
  }, [isCurrentMonth, totalPresentToday, practiceAttendance]);

  /* ───── STAT BOX 2: Week Avg → avg per practice day this month ───── */
  const mtdAvg = useMemo(() => {
    const days = new Set(practiceAttendance.map((a) => a.check_in_date));
    return days.size > 0 ? Math.round(practiceAttendance.length / days.size) : 0;
  }, [practiceAttendance]);

  /* ───── PROGRAM SPLIT (viewed month) ───── */
  const programSplitToday = useMemo(() => {
    const regIds = isCurrentMonth ? todayRegIds : new Set(practiceAttendance.map((a) => a.registration_id));
    const counts: Record<string, number> = {};
    regIds.forEach((id) => {
      const reg = regMap[id];
      if (reg) counts[reg.child_boxing_program] = (counts[reg.child_boxing_program] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [isCurrentMonth, todayRegIds, practiceAttendance, regMap]);

  /* ───── BOY / GIRL RATIO ───── */
  const sexSplitToday = useMemo(() => {
    const regIds = isCurrentMonth ? todayRegIds : new Set(practiceAttendance.map((a) => a.registration_id));
    const counts: Record<string, number> = {};
    regIds.forEach((id) => {
      const reg = regMap[id];
      if (reg) counts[reg.child_sex] = (counts[reg.child_sex] || 0) + 1;
    });
    return counts;
  }, [isCurrentMonth, todayRegIds, practiceAttendance, regMap]);

  /* ───── POVERTY % ───── */
  const povertyToday = useMemo(() => {
    const regIds = isCurrentMonth ? todayRegIds : new Set(practiceAttendance.map((a) => a.registration_id));
    let below = 0;
    regIds.forEach((id) => {
      const reg = regMap[id];
      if (reg && (POVERTY_INCOMES.includes(reg.household_income_range) || reg.free_or_reduced_lunch === "Yes")) below++;
    });
    return { below, total: regIds.size };
  }, [isCurrentMonth, todayRegIds, practiceAttendance, regMap]);

  /* ───── TOP SCHOOL DISTRICT ───── */
  const topDistrictToday = useMemo(() => {
    const regIds = isCurrentMonth ? todayRegIds : new Set(practiceAttendance.map((a) => a.registration_id));
    const counts: Record<string, number> = {};
    regIds.forEach((id) => {
      const reg = regMap[id];
      if (reg) counts[reg.child_school_district] = (counts[reg.child_school_district] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0] : null;
  }, [isCurrentMonth, todayRegIds, practiceAttendance, regMap]);

  /* ───── AVG ARRIVAL TIME ───── */
  const avgArrivalToday = useMemo(() => {
    const records = isCurrentMonth ? todayRecords : practiceAttendance;
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
  }, [isCurrentMonth, todayRecords, practiceAttendance]);

  /* ───── DAILY ATTENDANCE TREND (viewed month, practice days only) ───── */
  const dailyTrend = useMemo(() => {
    const counts: Record<string, number> = {};
    practiceAttendance.forEach((a) => { counts[a.check_in_date] = (counts[a.check_in_date] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date: format(parseISO(date), "M/d"), count, fullDate: date }));
  }, [practiceAttendance]);

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

    if (isCurrentMonth && avgArrivalToday) {
      insights.push(`Average arrival time today is ${avgArrivalToday}.`);
    }

    const prevDays = new Set(prevPracticeAttendance.map((a) => a.check_in_date));
    const prevAvg = prevDays.size > 0 ? Math.round(prevPracticeAttendance.length / prevDays.size) : 0;
    if (prevAvg > 0 && mtdAvg > 0) {
      const prevMonthName = format(subMonths(calendarMonth, 1), "MMMM");
      if (mtdAvg > prevAvg) insights.push(`${viewedMonthShort}'s average attendance is higher than ${prevMonthName}.`);
      else if (mtdAvg < prevAvg) insights.push(`${viewedMonthShort}'s average attendance is lower than ${prevMonthName}.`);
    }

    return insights;
  }, [weeklyAvgData, practiceAttendance, regMap, topDistrictToday, totalPresentToday, avgArrivalToday, prevPracticeAttendance, mtdAvg, isCurrentMonth, viewedMonthShort, calendarMonth]);

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
    const all = filteredCalendarAttendance
      .filter((a) => a.check_in_date === selectedDay)
      .map((a) => ({ ...a, reg: regMap[a.registration_id] }))
      .filter((a) => a.reg);
    if (!daySearch.trim()) return all;
    const q = daySearch.toLowerCase();
    return all.filter((a) => `${a.reg.child_first_name} ${a.reg.child_last_name}`.toLowerCase().includes(q));
  }, [selectedDay, filteredCalendarAttendance, regMap, daySearch]);

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

      {/* ═══════════ ATTENDANCE INSIGHTS ═══════════ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-400" /> Attendance Intelligence
          </h2>
        </div>

        {/* Key Insight Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">{isCurrentMonth ? "Present Today" : "Peak Day"}</p>
              <p className="text-3xl font-bold mt-1">{isCurrentMonth ? totalPresentToday : peakDay.count}</p>
              {isCurrentMonth && !todayIsPractice && <p className="text-[10px] text-red-400">Non-practice day</p>}
              {!isCurrentMonth && peakDay.date && <p className="text-[10px] text-white/30">{peakDay.date ? format(parseISO(peakDay.date), "M/d") : ""}</p>}
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">{isCurrentMonth ? "Week Avg" : "Daily Avg"}</p>
              <p className="text-3xl font-bold mt-1">{mtdAvg}</p>
              <p className="text-[10px] text-white/30">per practice day{isCurrentMonth ? " this week" : ` in ${viewedMonthShort}`}</p>
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
              <p className="text-[10px] uppercase tracking-wider text-white/40">{isCurrentMonth ? "Avg Arrival" : "Avg Arrival Time"}</p>
              <p className="text-2xl font-bold mt-1 flex items-center justify-center gap-1">
                <Clock className="w-4 h-4 text-white/40" />
                {avgArrivalToday || "—"}
              </p>
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
                const count = dailyCounts[dateStr] || 0;
                const dateObj = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                const isCurrentDay = isToday(dateObj);
                const isSelected = selectedDay === dateStr;
                const isPrac = isPracticeDay(dateStr, calPracticeDayMap);

                return (
                  <div key={dateStr} className="relative aspect-square">
                    <button
                      onClick={() => count > 0 && setSelectedDay(dateStr)}
                      className={`
                        w-full h-full rounded-lg p-1.5 flex flex-col items-center justify-center transition-all relative
                        ${isSelected ? "bg-blue-500/25 border border-blue-400/50 ring-1 ring-blue-400/30" : ""}
                        ${isCurrentDay && !isSelected ? "border border-white/30" : ""}
                        ${!isSelected && !isCurrentDay ? "border border-white/[0.06]" : ""}
                        ${count > 0 ? "hover:bg-white/10 cursor-pointer" : "cursor-default"}
                        ${!isPrac ? "bg-red-500/[0.06]" : "bg-white/[0.03]"}
                      `}
                    >
                      <span className={`absolute top-1 right-1.5 text-[10px] leading-none ${
                        !isPrac ? "text-red-400 font-medium" :
                        isCurrentDay ? "text-blue-400 font-semibold" : "text-white/35"
                      }`}>{day}</span>
                      {count > 0 ? (
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
                    {/* Toggle practice day button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePracticeDay(dateStr); }}
                      className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border transition-all hover:scale-150 ${
                        isPrac
                          ? "bg-green-500 border-green-400/50"
                          : "bg-red-500 border-red-400/50"
                      }`}
                      title={isPrac ? "Click to mark as non-practice day" : "Click to mark as practice day"}
                    />
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mt-4 pt-3 border-t border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs text-white/50">Practice Day</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs text-white/50">Non-Practice Day</span>
              </div>
              <span className="text-[10px] text-white/30 ml-auto">Click dot to toggle</span>
            </div>
          </CardContent>
        </Card>

        {/* Second row of insight cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {/* Program Split */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">{isCurrentMonth ? "Program Split Today" : `Program Split — ${viewedMonthShort}`}</p>
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
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">{isCurrentMonth ? "Boy / Girl Today" : `Boy / Girl — ${viewedMonthShort}`}</p>
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
              <p className="text-[10px] uppercase tracking-wider text-white/40">{isCurrentMonth ? "Below Poverty Today" : `Below Poverty — ${viewedMonthShort}`}</p>
              <p className="text-3xl font-bold mt-1">{pct(povertyToday.below, povertyToday.total)}</p>
              <p className="text-[10px] text-white/30">{povertyToday.below} of {povertyToday.total}</p>
            </CardContent>
          </Card>

          {/* Top District */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40 flex items-center justify-center gap-1">
                <School className="w-3 h-3" /> {isCurrentMonth ? "Top District Today" : `Top District — ${viewedMonthShort}`}
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

        {/* ═══════════ TREND CHARTS ═══════════ */}

        {/* Daily Attendance Trend */}
        {dailyTrend.length > 1 && (
          <Card className="bg-white/5 border-white/10 text-white mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Daily Attendance Trend — {format(calendarMonth, "MMMM yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                    <Tooltip content={({ active, payload }) => { if (!active || !payload?.length) return null; const item = payload[0].payload; const dateLabel = item.fullDate ? format(parseISO(item.fullDate), "MMMM d, yyyy") : item.date; return (<div style={{ ...chartTooltipStyle, padding: "8px 12px" }}><p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, margin: 0 }}>{dateLabel}</p><p style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: "4px 0 0" }}>{item.count} Sign-Ins</p></div>); }} />
                    <Bar dataKey="count" name="Sign-Ins" radius={[3, 3, 0, 0]}>
                      <LabelList dataKey="count" position="top" style={{ fill: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: 600 }} />
                      {dailyTrend.map((_, i) => (
                        <Cell key={i} fill="hsl(142, 71%, 45%)" fillOpacity={0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
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

          {/* Program Trend */}
          {programTrend.length > 1 && (
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/60">Program Attendance Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={programTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Line type="monotone" dataKey="Junior" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Senior" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Other" stroke="hsl(45, 93%, 47%)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 mt-2 justify-center">
                  <span className="flex items-center gap-1 text-xs"><span className="w-3 h-1 rounded bg-blue-500 inline-block" /> Junior</span>
                  <span className="flex items-center gap-1 text-xs"><span className="w-3 h-1 rounded bg-red-500 inline-block" /> Senior</span>
                  <span className="flex items-center gap-1 text-xs"><span className="w-3 h-1 rounded bg-amber-500 inline-block" /> Other</span>
                </div>
              </CardContent>
            </Card>
          )}
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

        {/* ═══════════ BALD EAGLES MONITOR ═══════════ */}
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
      <Dialog open={!!selectedDay} onOpenChange={() => { setSelectedDay(null); setDaySearch(""); }}>
        <DialogContent className="bg-black border-white/10 text-white max-w-lg max-h-[80vh] flex flex-col">
          {selectedDay && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-blue-400" />
                  {format(new Date(selectedDay + "T12:00:00"), "EEEE, MMMM d, yyyy")}
                </DialogTitle>
              </DialogHeader>
              <div className="mt-2 mb-2 flex items-center gap-3">
                <Badge className="bg-green-500/15 text-green-400 border-green-500/30 flex-shrink-0">{daySignIns.length} youth signed in</Badge>
                {!isPracticeDay(selectedDay, calPracticeDayMap) && (
                  <Badge className="bg-red-500/15 text-red-400 border-red-500/30 flex-shrink-0">Non-Practice Day</Badge>
                )}
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
                      </div>
                      <p className="text-xs text-white/40">{s.reg.child_boxing_program} · <span className={s.program_source === 'Lil Champs Corner' ? 'text-sky-400' : 'text-green-400'}>{s.program_source}</span></p>
                    </div>
                    <span className="text-xs text-white/50 flex-shrink-0">{format(new Date(s.check_in_at), "h:mm a")}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: s.id, name: `${s.reg.child_first_name} ${s.reg.child_last_name}`, date: s.check_in_date }); }}
                      className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                      title="Remove check-in"
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

    </div>
  );
};

export default AdminAttendance;
