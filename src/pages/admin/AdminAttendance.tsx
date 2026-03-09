import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Star, Search, AlertTriangle, Users, Eye, ChevronLeft, ChevronRight, CalendarDays,
  Clock, TrendingUp, School, Lightbulb, Activity, Trash2
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line,
} from "recharts";
import {
  startOfWeek, startOfMonth, endOfMonth, format, differenceInCalendarDays,
  addMonths, subMonths, subWeeks, getDay, getDaysInMonth, isToday, parseISO, endOfWeek,
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
}

const POVERTY_INCOMES = ["Under $25,000", "Less than $25,000", "Less than $35,000"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const now = new Date();
const todayStr = now.toISOString().split("T")[0];
const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
const prevWeekStart = format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), "yyyy-MM-dd");
const prevWeekEnd = format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), "yyyy-MM-dd");
const currentMonthStart = format(startOfMonth(now), "yyyy-MM-dd");
const currentMonthEnd = format(endOfMonth(now), "yyyy-MM-dd");
const prevMonthStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
const prevMonthEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");

const pct = (n: number, d: number) => (d === 0 ? "0%" : `${Math.round((n / d) * 100)}%`);

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

  const invalidateAttendance = () => {
    queryClient.invalidateQueries({ queryKey: ["attendance-records-current"] });
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
        .select("id, child_first_name, child_last_name, child_boxing_program, child_headshot_url, is_bald_eagle, child_sex, child_school_district, household_income_range, free_or_reduced_lunch")
        .order("child_last_name");
      if (error) throw error;
      return data as Registration[];
    },
  });

  // Current month attendance
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance-records-current"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, registration_id, check_in_date, check_in_at")
        .gte("check_in_date", currentMonthStart)
        .lte("check_in_date", currentMonthEnd)
        .order("check_in_date", { ascending: false });
      if (error) throw error;
      return data as AttendanceRecord[];
    },
  });

  // Previous month attendance (for comparison insights)
  const { data: prevMonthAttendance = [] } = useQuery({
    queryKey: ["attendance-records-prev"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, registration_id, check_in_date, check_in_at")
        .gte("check_in_date", prevMonthStart)
        .lte("check_in_date", prevMonthEnd);
      if (error) throw error;
      return data as AttendanceRecord[];
    },
  });

  // Calendar month attendance
  const { data: calendarAttendance = [] } = useQuery({
    queryKey: ["calendar-attendance", calMonthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, registration_id, check_in_date, check_in_at")
        .gte("check_in_date", calMonthStart)
        .lte("check_in_date", calMonthEnd)
        .order("check_in_at", { ascending: true });
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
        .select("id, registration_id, check_in_date, check_in_at")
        .eq("registration_id", selectedYouth.id)
        .order("check_in_date", { ascending: false });
      if (error) throw error;
      return data as AttendanceRecord[];
    },
    enabled: !!selectedYouth,
  });

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

  // Attendance by registration
  const attendanceByReg = useMemo(() => {
    const map: Record<string, AttendanceRecord[]> = {};
    attendance.forEach((a) => {
      if (!map[a.registration_id]) map[a.registration_id] = [];
      map[a.registration_id].push(a);
    });
    return map;
  }, [attendance]);

  const getStats = (regId: string) => {
    const records = attendanceByReg[regId] || [];
    const todayCount = records.filter((r) => r.check_in_date === todayStr).length;
    const weekCount = records.filter((r) => r.check_in_date >= weekStart && r.check_in_date <= weekEnd).length;
    const monthCount = records.length;
    const lastDate = records.length > 0 ? records[0].check_in_date : null;
    return { present: todayCount > 0, weekCount, monthCount, lastDate };
  };

  /* ───── TODAY'S RECORDS ───── */
  const todayRecords = useMemo(() => attendance.filter((a) => a.check_in_date === todayStr), [attendance]);
  const todayRegIds = useMemo(() => new Set(todayRecords.map((a) => a.registration_id)), [todayRecords]);
  const totalPresentToday = todayRegIds.size;

  /* ───── WEEK-TO-DATE AVERAGE ───── */
  const weekRecords = useMemo(
    () => attendance.filter((a) => a.check_in_date >= weekStart && a.check_in_date <= weekEnd),
    [attendance]
  );
  const wtdAvg = useMemo(() => {
    const days = new Set(weekRecords.map((a) => a.check_in_date));
    return days.size > 0 ? Math.round(weekRecords.length / days.size) : 0;
  }, [weekRecords]);

  /* ───── MONTH-TO-DATE AVERAGE ───── */
  const mtdAvg = useMemo(() => {
    const days = new Set(attendance.map((a) => a.check_in_date));
    return days.size > 0 ? Math.round(attendance.length / days.size) : 0;
  }, [attendance]);

  /* ───── PROGRAM SPLIT TODAY ───── */
  const programSplitToday = useMemo(() => {
    const counts: Record<string, number> = {};
    todayRegIds.forEach((id) => {
      const reg = regMap[id];
      if (reg) counts[reg.child_boxing_program] = (counts[reg.child_boxing_program] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [todayRegIds, regMap]);

  /* ───── BOY / GIRL RATIO TODAY ───── */
  const sexSplitToday = useMemo(() => {
    const counts: Record<string, number> = {};
    todayRegIds.forEach((id) => {
      const reg = regMap[id];
      if (reg) counts[reg.child_sex] = (counts[reg.child_sex] || 0) + 1;
    });
    return counts;
  }, [todayRegIds, regMap]);

  /* ───── POVERTY % TODAY ───── */
  const povertyToday = useMemo(() => {
    let below = 0;
    todayRegIds.forEach((id) => {
      const reg = regMap[id];
      if (reg && (POVERTY_INCOMES.includes(reg.household_income_range) || reg.free_or_reduced_lunch === "Yes")) below++;
    });
    return { below, total: todayRegIds.size };
  }, [todayRegIds, regMap]);

  /* ───── TOP SCHOOL DISTRICT TODAY ───── */
  const topDistrictToday = useMemo(() => {
    const counts: Record<string, number> = {};
    todayRegIds.forEach((id) => {
      const reg = regMap[id];
      if (reg) counts[reg.child_school_district] = (counts[reg.child_school_district] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0] : null;
  }, [todayRegIds, regMap]);

  /* ───── AVG ARRIVAL TIME TODAY ───── */
  const avgArrivalToday = useMemo(() => {
    if (todayRecords.length === 0) return null;
    const totalMs = todayRecords.reduce((sum, a) => {
      const d = new Date(a.check_in_at);
      return sum + (d.getHours() * 60 + d.getMinutes());
    }, 0);
    const avgMin = Math.round(totalMs / todayRecords.length);
    const h = Math.floor(avgMin / 60);
    const m = avgMin % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  }, [todayRecords]);

  /* ───── DAILY ATTENDANCE TREND (CURRENT MONTH) ───── */
  const dailyTrend = useMemo(() => {
    const counts: Record<string, number> = {};
    attendance.forEach((a) => { counts[a.check_in_date] = (counts[a.check_in_date] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date: format(parseISO(date), "M/d"), count, fullDate: date }));
  }, [attendance]);

  /* ───── ATTENDANCE BY DAY OF WEEK ───── */
  const dowData = useMemo(() => {
    const totals: number[] = [0, 0, 0, 0, 0, 0, 0];
    const dayCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
    const datesByDow: Record<number, Set<string>> = {};
    for (let i = 0; i < 7; i++) datesByDow[i] = new Set();

    attendance.forEach((a) => {
      const dow = getDay(parseISO(a.check_in_date));
      totals[dow]++;
      datesByDow[dow].add(a.check_in_date);
    });
    for (let i = 0; i < 7; i++) dayCounts[i] = datesByDow[i].size;

    return [1, 2, 3, 4, 5].map((dow) => ({
      day: WEEKDAY_NAMES[dow].slice(0, 3),
      avg: dayCounts[dow] > 0 ? Math.round(totals[dow] / dayCounts[dow]) : 0,
      total: totals[dow],
      dow,
    }));
  }, [attendance]);

  /* ───── PROGRAM ATTENDANCE TREND ───── */
  const programTrend = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    attendance.forEach((a) => {
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
  }, [attendance, regMap]);

  /* ───── SCHOOL DISTRICT BREAKDOWN (MONTH) ───── */
  const districtBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    const ids = new Set(attendance.map((a) => a.registration_id));
    ids.forEach((id) => {
      const reg = regMap[id];
      if (reg) counts[reg.child_school_district] = (counts[reg.child_school_district] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [attendance, regMap]);

  /* ───── POVERTY SUMMARY (MONTH) ───── */
  const povertyMonth = useMemo(() => {
    const ids = new Set(attendance.map((a) => a.registration_id));
    let below = 0;
    ids.forEach((id) => {
      const reg = regMap[id];
      if (reg && (POVERTY_INCOMES.includes(reg.household_income_range) || reg.free_or_reduced_lunch === "Yes")) below++;
    });
    return { below, total: ids.size };
  }, [attendance, regMap]);

  /* ───── SMART INSIGHTS ───── */
  const smartInsights = useMemo(() => {
    const insights: string[] = [];

    // Strongest day of week
    const strongest = dowData.reduce((a, b) => (b.avg > a.avg ? b : a), dowData[0]);
    const weakest = dowData.reduce((a, b) => (b.avg < a.avg ? b : a), dowData[0]);
    if (strongest && strongest.avg > 0) {
      insights.push(`${WEEKDAY_NAMES[[1,2,3,4,5][dowData.indexOf(strongest)]]} has the strongest average attendance this month (${strongest.avg}/day).`);
    }
    if (weakest && weakest.avg > 0 && weakest.day !== strongest.day) {
      insights.push(`${weakest.day} attendance tends to be lower than midweek attendance.`);
    }

    // Program comparison this week
    const weekJr = weekRecords.filter((a) => regMap[a.registration_id]?.child_boxing_program.includes("Junior")).length;
    const weekSr = weekRecords.filter((a) => regMap[a.registration_id]?.child_boxing_program.includes("Senior")).length;
    if (weekJr > 0 || weekSr > 0) {
      if (weekSr > weekJr) insights.push("Senior Boxer attendance is higher than Junior Boxer attendance this week.");
      else if (weekJr > weekSr) insights.push("Junior Boxer attendance is higher than Senior Boxer attendance this week.");
    }

    // Top district today
    if (topDistrictToday && totalPresentToday > 0) {
      insights.push(`Most youth attending today are from ${topDistrictToday[0]}.`);
    }

    // Average arrival time comparison
    if (avgArrivalToday) {
      insights.push(`Average arrival time today is ${avgArrivalToday}.`);
    }

    // Month-over-month comparison
    const prevDays = new Set(prevMonthAttendance.map((a) => a.check_in_date));
    const prevAvg = prevDays.size > 0 ? Math.round(prevMonthAttendance.length / prevDays.size) : 0;
    if (prevAvg > 0 && mtdAvg > 0) {
      if (mtdAvg > prevAvg) insights.push("This month's average attendance is higher than last month.");
      else if (mtdAvg < prevAvg) insights.push("This month's average attendance is lower than last month.");
    }

    return insights;
  }, [dowData, weekRecords, regMap, topDistrictToday, totalPresentToday, avgArrivalToday, prevMonthAttendance, mtdAvg]);

  /* ───── BALD EAGLES ───── */
  const baldEagles = registrations.filter((r) => r.is_bald_eagle);
  const baldEaglesPresent = baldEagles.filter((r) => getStats(r.id).present).length;
  const baldEaglesWeek = baldEagles.reduce((sum, r) => sum + getStats(r.id).weekCount, 0);
  const baldEaglesMonth = baldEagles.reduce((sum, r) => sum + getStats(r.id).monthCount, 0);

  const baldEagleTrend = useMemo(() => {
    const counts: Record<string, number> = {};
    attendance.forEach((a) => {
      if (regMap[a.registration_id]?.is_bald_eagle) {
        counts[a.check_in_date] = (counts[a.check_in_date] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date: format(parseISO(date), "M/d"), count }));
  }, [attendance, regMap]);

  const alerts = baldEagles
    .map((r) => {
      const stats = getStats(r.id);
      if (!stats.lastDate) return { ...r, daysSince: 999, lastDate: "Never" };
      const days = differenceInCalendarDays(now, new Date(stats.lastDate));
      if (days >= 7) return { ...r, daysSince: days, lastDate: stats.lastDate };
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => (b?.daysSince || 0) - (a?.daysSince || 0)) as (Registration & { daysSince: number; lastDate: string })[];

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
    return filteredCalendarAttendance
      .filter((a) => a.check_in_date === selectedDay)
      .map((a) => ({ ...a, reg: regMap[a.registration_id] }))
      .filter((a) => a.reg);
  }, [selectedDay, filteredCalendarAttendance, regMap]);

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
  const filtered = registrations
    .filter((r) => filter === "all" || r.is_bald_eagle)
    .filter((r) => drillDistrictFilter ? r.child_school_district === drillDistrictFilter : true)
    .filter(
      (r) =>
        r.child_first_name.toLowerCase().includes(search.toLowerCase()) ||
        r.child_last_name.toLowerCase().includes(search.toLowerCase())
    );

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
    window.location.reload();
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
            <Activity className="w-5 h-5 text-red-400" /> Attendance Insights
          </h2>
        </div>

        {/* Key Insight Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Present Today</p>
              <p className="text-3xl font-bold mt-1">{totalPresentToday}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Week Avg</p>
              <p className="text-3xl font-bold mt-1">{wtdAvg}</p>
              <p className="text-[10px] text-white/30">per day this week</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Month Avg</p>
              <p className="text-3xl font-bold mt-1">{mtdAvg}</p>
              <p className="text-[10px] text-white/30">per day this month</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Avg Arrival</p>
              <p className="text-2xl font-bold mt-1 flex items-center justify-center gap-1">
                <Clock className="w-4 h-4 text-white/40" />
                {avgArrivalToday || "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {/* Program Split */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Program Split Today</p>
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
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Boy / Girl Today</p>
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
            </CardContent>
          </Card>

          {/* Poverty % */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Below Poverty Today</p>
              <p className="text-3xl font-bold mt-1">{pct(povertyToday.below, povertyToday.total)}</p>
              <p className="text-[10px] text-white/30">{povertyToday.below} of {povertyToday.total}</p>
            </CardContent>
          </Card>

          {/* Top District */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40 flex items-center justify-center gap-1">
                <School className="w-3 h-3" /> Top District Today
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
                <TrendingUp className="w-4 h-4" /> Daily Attendance Trend — {format(now, "MMMM yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                    <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: "rgba(255,255,255,0.6)" }} />
                    <Bar dataKey="count" name="Sign-Ins" radius={[3, 3, 0, 0]}>
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
          {/* Day of Week */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Attendance by Day of Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dowData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Bar dataKey="avg" name="Avg/Day" radius={[3, 3, 0, 0]}>
                      {dowData.map((d, i) => (
                        <Cell key={i} fill={d.avg === Math.max(...dowData.map((x) => x.avg)) ? "hsl(142, 71%, 45%)" : "hsl(217, 91%, 60%)"} fillOpacity={0.7} />
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
                <School className="w-3.5 h-3.5" /> School District Breakdown (Month)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {districtBreakdown.length === 0 ? (
                <p className="text-sm text-white/30">No data</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {districtBreakdown.map(([dist, count]) => {
                    const barW = districtBreakdown[0][1] > 0 ? Math.round((count / districtBreakdown[0][1]) * 100) : 0;
                    return (
                      <button
                        key={dist}
                        onClick={() => setDrillDistrictFilter(drillDistrictFilter === dist ? null : dist)}
                        className={`w-full text-left flex items-center gap-2 p-1.5 rounded hover:bg-white/5 transition-colors ${drillDistrictFilter === dist ? "bg-white/10" : ""}`}
                      >
                        <span className="text-xs text-white/70 truncate flex-1 min-w-0">{dist}</span>
                        <div className="w-20 h-2 bg-white/5 rounded-full overflow-hidden flex-shrink-0">
                          <div className="h-full bg-blue-500/60 rounded-full" style={{ width: `${barW}%` }} />
                        </div>
                        <span className="text-xs font-bold text-white/80 w-6 text-right flex-shrink-0">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {drillDistrictFilter && (
                <Button variant="ghost" size="sm" className="mt-2 text-xs text-white/50 hover:text-white" onClick={() => setDrillDistrictFilter(null)}>
                  Clear district filter
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Poverty Indicator Summary */}
          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Poverty Indicator Summary (Month)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 mb-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{pct(povertyMonth.below, povertyMonth.total)}</p>
                  <p className="text-[10px] text-white/40">below poverty line</p>
                </div>
                <div className="flex-1">
                  <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all"
                      style={{ width: povertyMonth.total > 0 ? `${(povertyMonth.below / povertyMonth.total) * 100}%` : "0%" }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-white/30">{povertyMonth.below} below</span>
                    <span className="text-[10px] text-white/30">{povertyMonth.total - povertyMonth.below} above</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════ SMART INSIGHT CALLOUTS ═══════════ */}
        {smartInsights.length > 0 && (
          <Card className="bg-blue-500/5 border-blue-500/20 text-white mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-400 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" /> Smart Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {smartInsights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-blue-400/60 mt-0.5">•</span>
                    <p className="text-sm text-white/80">{insight}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══════════ BALD EAGLES INSIGHT BLOCK ═══════════ */}
      <div>
        <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 fill-amber-400" /> Bald Eagles Monitor
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Card className="bg-amber-500/10 border-amber-500/30 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-amber-400/60">Present Today</p>
              <p className="text-3xl font-bold text-amber-400">{baldEaglesPresent}</p>
              <p className="text-[10px] text-white/30">of {baldEagles.length} total</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/10 border-amber-500/30 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-amber-400/60">This Week</p>
              <p className="text-3xl font-bold text-amber-400">{baldEaglesWeek}</p>
              <p className="text-[10px] text-white/30">sign-ins</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/10 border-amber-500/30 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-amber-400/60">This Month</p>
              <p className="text-3xl font-bold text-amber-400">{baldEaglesMonth}</p>
              <p className="text-[10px] text-white/30">sign-ins</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/10 border-amber-500/30 text-white">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-amber-400/60">Total Eagles</p>
              <p className="text-3xl font-bold text-amber-400">{baldEagles.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Bald Eagle Attendance Trend */}
        {baldEagleTrend.length > 1 && (
          <Card className="bg-amber-500/5 border-amber-500/20 text-white mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-400/70">🦅 Attendance Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={baldEagleTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Line type="monotone" dataKey="count" stroke="hsl(43, 96%, 56%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

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
                      <TableHead className="text-white/60">Days Since</TableHead>
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
                          <Badge variant={a.daysSince >= 14 ? "destructive" : "outline"} className={a.daysSince >= 14 ? "" : "border-yellow-500 text-yellow-400"}>
                            {a.daysSince >= 999 ? "No record" : `${a.daysSince} days`}
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
        {baldEagles.length > 0 && (
          <Card className="bg-amber-500/5 border-amber-500/20 text-white">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-amber-400">
                <Star className="w-5 h-5 fill-amber-400" /> Bald Eagles Watch List
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
                      <TableHead className="text-white/60">This Week</TableHead>
                      <TableHead className="text-white/60">This Month</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {baldEagles.map((r) => {
                      const stats = getStats(r.id);
                      return (
                        <TableRow key={r.id} className="border-white/10 cursor-pointer hover:bg-white/5" onClick={() => setSelectedYouth(r)}>
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
                          <TableCell className="text-white/60">{stats.lastDate ? format(new Date(stats.lastDate), "MMM d") : "—"}</TableCell>
                          <TableCell className="text-white">{stats.weekCount}</TableCell>
                          <TableCell className="text-white">{stats.monthCount}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══════════ ATTENDANCE CALENDAR ═══════════ */}
      <Card className="bg-white/5 border-white/10 text-white">
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

              return (
                <button
                  key={dateStr}
                  onClick={() => count > 0 && setSelectedDay(dateStr)}
                  className={`
                    aspect-square rounded-lg p-1.5 flex flex-col items-center justify-center transition-all relative
                    ${isSelected ? "bg-blue-500/25 border border-blue-400/50 ring-1 ring-blue-400/30" : ""}
                    ${isCurrentDay && !isSelected ? "border border-white/30" : ""}
                    ${!isSelected && !isCurrentDay ? "border border-white/[0.06]" : ""}
                    ${count > 0 ? "hover:bg-white/10 cursor-pointer" : "cursor-default"}
                    bg-white/[0.03]
                  `}
                >
                  <span className={`absolute top-1 right-1.5 text-[10px] leading-none ${isCurrentDay ? "text-blue-400 font-semibold" : "text-white/35"}`}>{day}</span>
                  {count > 0 ? (
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-sm sm:text-base font-bold text-green-400">{count}</span>
                  ) : (
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-xs text-white/15">0</span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day Detail Modal */}
      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="bg-black border-white/10 text-white max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedDay && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-blue-400" />
                  {format(new Date(selectedDay + "T12:00:00"), "EEEE, MMMM d, yyyy")}
                </DialogTitle>
              </DialogHeader>
              <div className="mt-2 mb-4">
                <Badge className="bg-green-500/15 text-green-400 border-green-500/30">{daySignIns.length} youth signed in</Badge>
              </div>
              <div className="space-y-1">
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
                      <p className="text-xs text-white/40">{s.reg.child_boxing_program}</p>
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

      {/* ═══════════ FULL ATTENDANCE TABLE ═══════════ */}
      <Card className="bg-white/5 border-white/10 text-white">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" /> Daily Attendance
            </CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9 bg-white/5 border-white/20 text-white placeholder:text-white/30 h-9" />
              </div>
              <Select value={filter} onValueChange={(v: "all" | "bald-eagles") => setFilter(v)}>
                <SelectTrigger className="w-40 bg-white/5 border-white/20 text-white h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Youth</SelectItem>
                  <SelectItem value="bald-eagles">🦅 Bald Eagles</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-white/60 w-10"></TableHead>
                  <TableHead className="text-white/60">Name</TableHead>
                  <TableHead className="text-white/60">Program</TableHead>
                  <TableHead className="text-white/60">Today</TableHead>
                  <TableHead className="text-white/60">This Week</TableHead>
                  <TableHead className="text-white/60">This Month</TableHead>
                  <TableHead className="text-white/60 w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const stats = getStats(r.id);
                  return (
                    <TableRow key={r.id} className="border-white/10">
                      <TableCell>
                        <button onClick={() => toggleBaldEagle(r)} className="p-1 hover:scale-110 transition-transform" title={r.is_bald_eagle ? "Remove Bald Eagle" : "Mark as Bald Eagle"}>
                          <Star className={`w-4 h-4 ${r.is_bald_eagle ? "fill-amber-400 text-amber-400" : "text-white/20"}`} />
                        </button>
                      </TableCell>
                      <TableCell className="text-white font-medium">{r.child_first_name} {r.child_last_name}</TableCell>
                      <TableCell className="text-white/60 text-xs">{r.child_boxing_program}</TableCell>
                      <TableCell>
                        {stats.present ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Present</Badge>
                        ) : (
                          <span className="text-white/30 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-white">{stats.weekCount}</TableCell>
                      <TableCell className="text-white">{stats.monthCount}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white" onClick={() => setSelectedYouth(r)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Student Profile Modal */}
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
                          <span>{format(new Date(a.check_in_date), "EEEE, MMM d, yyyy")}</span>
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
