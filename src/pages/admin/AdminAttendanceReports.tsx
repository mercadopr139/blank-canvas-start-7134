import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, Star, Search, Trash2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isWeekend } from "date-fns";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ───────── Types ───────── */
interface Registration {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string;
  child_sex: string;
  child_school_district: string;
  child_headshot_url: string | null;
  is_bald_eagle: boolean;
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

type ReportType = "daily" | "weekly" | "monthly" | "yearly" | "individual";

const POVERTY_INCOMES = ["Under $25,000", "Less than $25,000", "Less than $35,000"];

/* ───────── Helpers ───────── */
const pct = (n: number, d: number) => (d === 0 ? "0%" : `${Math.round((n / d) * 100)}%`);

const breakdownBy = (records: AttendanceRecord[], regMap: Record<string, Registration>, field: keyof Registration) => {
  const counts: Record<string, number> = {};
  records.forEach((r) => {
    const reg = regMap[r.registration_id];
    if (!reg) return;
    const val = String(reg[field] || "Unknown");
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
};

const uniqueYouth = (records: AttendanceRecord[]) => new Set(records.map((r) => r.registration_id)).size;

const povertyCount = (records: AttendanceRecord[], regMap: Record<string, Registration>) => {
  const ids = new Set(records.map((r) => r.registration_id));
  let below = 0;
  ids.forEach((id) => {
    const reg = regMap[id];
    if (reg && (POVERTY_INCOMES.includes(reg.household_income_range) || reg.free_or_reduced_lunch === "Yes")) below++;
  });
  return { below, total: ids.size };
};

/* ───────── PDF Generator ───────── */
const exportPdf = (title: string, dateRange: string, summaryRows: [string, string][], tableHeaders: string[], tableData: string[][]) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, pw, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("NO LIMITS ACADEMY", 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Attendance Report", 14, 18);
  doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy h:mm a")}`, 14, 23);

  let y = 36;
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(dateRange, 14, y);
  y += 8;

  // Summary
  if (summaryRows.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: summaryRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [17, 24, 39], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Detail table
  if (tableHeaders.length > 0 && tableData.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Details", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [tableHeaders],
      body: tableData,
      theme: "striped",
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [17, 24, 39], textColor: 255 },
      margin: { left: 14, right: 14 },
    });
  }

  doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
};

/* ───────── Component ───────── */
const AdminAttendanceReports = () => {
  const queryClient = useQueryClient();
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedWeekStart, setSelectedWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [individualRange, setIndividualRange] = useState<"week" | "month" | "year" | "custom">("month");
  const [youthSearch, setYouthSearch] = useState("");
  const [selectedYouthId, setSelectedYouthId] = useState<string | null>(null);
  const [programFilter, setProgramFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [sexFilter, setSexFilter] = useState("all");
  const [baldEaglesOnly, setBaldEaglesOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; date: string } | null>(null);

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("attendance_records").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Failed to delete check-in"); return; }
    toast.success(`Removed check-in for ${deleteTarget.name}`);
    setDeleteTarget(null);
    queryClient.invalidateQueries({ queryKey: ["report-attendance"] });
  };

  // Fetch all registrations
  const { data: registrations = [] } = useQuery({
    queryKey: ["report-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, child_boxing_program, child_sex, child_school_district, child_headshot_url, is_bald_eagle, household_income_range, free_or_reduced_lunch")
        .order("child_last_name");
      if (error) throw error;
      return data as Registration[];
    },
  });

  // Determine date range for query
  const dateRange = useMemo(() => {
    if (reportType === "daily") return { from: selectedDate, to: selectedDate };
    if (reportType === "weekly") {
      const ws = parseISO(selectedWeekStart);
      return { from: selectedWeekStart, to: format(endOfWeek(ws, { weekStartsOn: 1 }), "yyyy-MM-dd") };
    }
    if (reportType === "monthly") {
      const d = parseISO(selectedMonth + "-01");
      return { from: format(startOfMonth(d), "yyyy-MM-dd"), to: format(endOfMonth(d), "yyyy-MM-dd") };
    }
    if (reportType === "yearly") {
      return { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` };
    }
    // individual
    if (individualRange === "week") {
      const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
      return { from: format(ws, "yyyy-MM-dd"), to: format(endOfWeek(ws, { weekStartsOn: 1 }), "yyyy-MM-dd") };
    }
    if (individualRange === "month") {
      return { from: format(startOfMonth(new Date()), "yyyy-MM-dd"), to: format(endOfMonth(new Date()), "yyyy-MM-dd") };
    }
    if (individualRange === "year") {
      return { from: format(startOfYear(new Date()), "yyyy-MM-dd"), to: format(endOfYear(new Date()), "yyyy-MM-dd") };
    }
    return { from: customStart || format(startOfMonth(new Date()), "yyyy-MM-dd"), to: customEnd || format(new Date(), "yyyy-MM-dd") };
  }, [reportType, selectedDate, selectedWeekStart, selectedMonth, selectedYear, individualRange, customStart, customEnd]);

  // Fetch practice days for the date range
  const { data: practiceDaysData = [] } = useQuery({
    queryKey: ["report-practice-days", dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_days")
        .select("date, is_practice_day")
        .gte("date", dateRange.from)
        .lte("date", dateRange.to);
      if (error) throw error;
      return data as { date: string; is_practice_day: boolean }[];
    },
  });

  const practiceDayMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    practiceDaysData.forEach((p) => (m[p.date] = p.is_practice_day));
    return m;
  }, [practiceDaysData]);

  const isPracticeDay = useCallback((dateStr: string): boolean => {
    if (dateStr in practiceDayMap) return practiceDayMap[dateStr];
    const d = parseISO(dateStr);
    return !isWeekend(d);
  }, [practiceDayMap]);

  // Fetch attendance for range
  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ["report-attendance", dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, registration_id, check_in_date, check_in_at, program_source")
        .gte("check_in_date", dateRange.from)
        .lte("check_in_date", dateRange.to)
        .order("check_in_date")
        .order("check_in_at");
      if (error) throw error;
      return data as AttendanceRecord[];
    },
  });

  // Filter attendance to only include practice days
  const practiceFilteredAttendance = useMemo(() => {
    return attendance.filter((a) => isPracticeDay(a.check_in_date));
  }, [attendance, isPracticeDay]);

  const regMap = useMemo(() => {
    const m: Record<string, Registration> = {};
    registrations.forEach((r) => (m[r.id] = r));
    return m;
  }, [registrations]);

  const programs = useMemo(() => Array.from(new Set(registrations.map((r) => r.child_boxing_program))).sort(), [registrations]);
  const districts = useMemo(() => Array.from(new Set(registrations.map((r) => r.child_school_district))).sort(), [registrations]);

  // Apply filters to attendance (now based on practice-filtered data)
  const filteredAttendance = useMemo(() => {
    return practiceFilteredAttendance.filter((a) => {
      const reg = regMap[a.registration_id];
      if (!reg) return false;
      if (baldEaglesOnly && !reg.is_bald_eagle) return false;
      if (programFilter !== "all" && reg.child_boxing_program !== programFilter) return false;
      if (districtFilter !== "all" && reg.child_school_district !== districtFilter) return false;
      if (sexFilter !== "all" && reg.child_sex !== sexFilter) return false;
      if (reportType === "individual" && selectedYouthId && a.registration_id !== selectedYouthId) return false;
      return true;
    });
  }, [practiceFilteredAttendance, regMap, baldEaglesOnly, programFilter, districtFilter, sexFilter, reportType, selectedYouthId]);

  // Computed stats
  const totalAttendance = filteredAttendance.length;
  const uniqueCount = uniqueYouth(filteredAttendance);
  const poverty = povertyCount(filteredAttendance, regMap);
  const programBreakdown = breakdownBy(filteredAttendance, regMap, "child_boxing_program");
  const sexBreakdown = breakdownBy(filteredAttendance, regMap, "child_sex");

  // Daily counts for charts
  const dailyChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredAttendance.forEach((a) => {
      counts[a.check_in_date] = (counts[a.check_in_date] || 0) + 1;
    });
    const days = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
    return days.map(([date, count]) => ({
      date: reportType === "yearly" ? format(parseISO(date), "MMM d") : format(parseISO(date), "EEE M/d"),
      count,
      fullDate: date,
    }));
  }, [filteredAttendance, reportType]);

  const avgAttendance = dailyChartData.length > 0 ? Math.round(totalAttendance / dailyChartData.length) : 0;
  const highestDay = dailyChartData.length > 0 ? dailyChartData.reduce((a, b) => (b.count > a.count ? b : a)) : null;
  const lowestDay = dailyChartData.length > 0 ? dailyChartData.reduce((a, b) => (b.count < a.count ? b : a)) : null;

  // Bald eagles stats
  const baldEagleRecords = useMemo(() => practiceFilteredAttendance.filter((a) => regMap[a.registration_id]?.is_bald_eagle), [practiceFilteredAttendance, regMap]);
  const baldEagleUniqueCount = uniqueYouth(baldEagleRecords);

  // Individual youth data
  const selectedYouthReg = selectedYouthId ? regMap[selectedYouthId] : null;
  const youthSearchResults = useMemo(() => {
    if (!youthSearch || youthSearch.length < 2) return [];
    const s = youthSearch.toLowerCase();
    return registrations.filter((r) =>
      r.child_first_name.toLowerCase().includes(s) || r.child_last_name.toLowerCase().includes(s)
    ).slice(0, 8);
  }, [youthSearch, registrations]);

  const dateRangeLabel = useMemo(() => {
    if (reportType === "daily") return format(parseISO(selectedDate), "EEEE, MMMM d, yyyy");
    if (reportType === "weekly") return `${format(parseISO(dateRange.from), "MMM d")} – ${format(parseISO(dateRange.to), "MMM d, yyyy")}`;
    if (reportType === "monthly") return format(parseISO(dateRange.from), "MMMM yyyy");
    if (reportType === "yearly") return selectedYear;
    return `${format(parseISO(dateRange.from), "MMM d, yyyy")} – ${format(parseISO(dateRange.to), "MMM d, yyyy")}`;
  }, [reportType, selectedDate, dateRange, selectedYear]);

  /* ───── PDF Export ───── */
  const handleExportPdf = () => {
    const titleMap: Record<ReportType, string> = {
      daily: "Daily Attendance Report",
      weekly: "Weekly Attendance Report",
      monthly: "Monthly Attendance Report",
      yearly: "Yearly Attendance Report",
      individual: `Individual Attendance Report – ${selectedYouthReg ? `${selectedYouthReg.child_first_name} ${selectedYouthReg.child_last_name}` : ""}`,
    };

    const summary: [string, string][] = [
      ["Total Sign-Ins", String(totalAttendance)],
      ["Unique Youth", String(uniqueCount)],
    ];

    if (reportType !== "daily") {
      summary.push(["Average Daily Attendance", String(avgAttendance)]);
    }
    if (highestDay && reportType !== "daily") {
      summary.push(["Highest Attendance Day", `${highestDay.count} (${highestDay.fullDate})`]);
    }
    if (lowestDay && reportType !== "daily") {
      summary.push(["Lowest Attendance Day", `${lowestDay.count} (${lowestDay.fullDate})`]);
    }

    programBreakdown.forEach(([prog, count]) => summary.push([`Program: ${prog}`, String(count)]));
    sexBreakdown.forEach(([sex, count]) => summary.push([`Sex: ${sex}`, String(count)]));
    summary.push(["Below Federal Poverty Line", `${poverty.below} of ${poverty.total} (${pct(poverty.below, poverty.total)})`]);
    summary.push(["Bald Eagles Sign-Ins", String(baldEagleRecords.length)]);
    summary.push(["Bald Eagles Unique", String(baldEagleUniqueCount)]);

    if (reportType === "individual" && selectedYouthReg) {
      summary.push(["Program", selectedYouthReg.child_boxing_program]);
      summary.push(["School District", selectedYouthReg.child_school_district]);
      summary.push(["Bald Eagle", selectedYouthReg.is_bald_eagle ? "Yes" : "No"]);
    }

    const tableHeaders = ["#", "Date", "Name", "Program", "Source", "Sign-In Time"];
    const tableData = filteredAttendance.map((a, i) => {
      const reg = regMap[a.registration_id];
      return [
        String(i + 1),
        format(parseISO(a.check_in_date), "MMM d, yyyy"),
        reg ? `${reg.child_first_name} ${reg.child_last_name}` : "Unknown",
        reg?.child_boxing_program || "",
        a.program_source || "NLA",
        format(new Date(a.check_in_at), "h:mm a"),
      ];
    });

    exportPdf(titleMap[reportType], dateRangeLabel, summary, tableHeaders, tableData);
  };

  /* ───── Render ───── */
  return (
    <div className="space-y-6">
      {/* Report Type Selector */}
      <div className="flex flex-wrap gap-2">
        {([
          ["daily", "Daily"],
          ["weekly", "Weekly"],
          ["monthly", "Monthly"],
          ["yearly", "Yearly"],
          ["individual", "Individual Youth"],
        ] as [ReportType, string][]).map(([val, label]) => (
          <Button
            key={val}
            variant="ghost"
            size="sm"
            onClick={() => setReportType(val)}
            className={reportType === val ? "bg-red-600 hover:bg-red-700 text-white" : "bg-white/10 border border-white/20 text-white/70 hover:text-white hover:bg-white/15"}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Filters Row */}
      <Card className="bg-white/5 border-white/10 text-white">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Date selectors per report type */}
            {reportType === "daily" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/50">Date</label>
                <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-44 bg-white/5 border-white/20 text-white h-9" />
              </div>
            )}
            {reportType === "weekly" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/50">Week Starting</label>
                <Input type="date" value={selectedWeekStart} onChange={(e) => setSelectedWeekStart(e.target.value)} className="w-44 bg-white/5 border-white/20 text-white h-9" />
              </div>
            )}
            {reportType === "monthly" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/50">Month</label>
                <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-44 bg-white/5 border-white/20 text-white h-9" />
              </div>
            )}
            {reportType === "yearly" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/50">Year</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32 bg-white/5 border-white/20 text-white h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {reportType === "individual" && (
              <>
                <div className="flex flex-col gap-1 relative">
                  <label className="text-xs text-white/50">Search Youth</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                    <Input
                      value={youthSearch}
                      onChange={(e) => { setYouthSearch(e.target.value); setSelectedYouthId(null); }}
                      placeholder="Name..."
                      className="w-52 pl-8 bg-white/5 border-white/20 text-white h-9"
                    />
                  </div>
                  {youthSearchResults.length > 0 && !selectedYouthId && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-black border border-white/20 rounded-lg z-50 max-h-48 overflow-y-auto shadow-xl">
                      {youthSearchResults.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => { setSelectedYouthId(r.id); setYouthSearch(`${r.child_first_name} ${r.child_last_name}`); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 flex items-center gap-2"
                        >
                          {r.is_bald_eagle && <Star className="w-3 h-3 fill-amber-400 text-amber-400" />}
                          <span>{r.child_first_name} {r.child_last_name}</span>
                          <span className="text-white/30 text-xs ml-auto">{r.child_boxing_program}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">Range</label>
                  <Select value={individualRange} onValueChange={(v: any) => setIndividualRange(v)}>
                    <SelectTrigger className="w-36 bg-white/5 border-white/20 text-white h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="year">This Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {individualRange === "custom" && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-white/50">From</label>
                      <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-40 bg-white/5 border-white/20 text-white h-9" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-white/50">To</label>
                      <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-40 bg-white/5 border-white/20 text-white h-9" />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Common filters (not for individual) */}
            {reportType !== "individual" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">Program</label>
                  <Select value={programFilter} onValueChange={setProgramFilter}>
                    <SelectTrigger className="w-44 bg-white/5 border-white/20 text-white h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programs</SelectItem>
                      {programs.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">Sex</label>
                  <Select value={sexFilter} onValueChange={setSexFilter}>
                    <SelectTrigger className="w-28 bg-white/5 border-white/20 text-white h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">District</label>
                  <Select value={districtFilter} onValueChange={setDistrictFilter}>
                    <SelectTrigger className="w-44 bg-white/5 border-white/20 text-white h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">&nbsp;</label>
                  <Button
                    variant={baldEaglesOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBaldEaglesOnly((v) => !v)}
                    className={baldEaglesOnly ? "bg-amber-600 hover:bg-amber-700 text-white h-9" : "border-white/20 text-foreground hover:text-foreground hover:bg-white/10 h-9"}
                  >
                    <Star className="w-3.5 h-3.5 mr-1" /> Bald Eagles Only
                  </Button>
                </div>
              </>
            )}

            {/* Export */}
            <div className="flex flex-col gap-1 ml-auto">
              <label className="text-xs text-white/50">&nbsp;</label>
              <Button onClick={handleExportPdf} size="sm" className="bg-green-600 hover:bg-green-700 text-white h-9">
                <Download className="w-4 h-4 mr-1.5" /> Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Header */}
      <div className="flex items-center gap-2 text-white">
        <FileText className="w-5 h-5 text-red-400" />
        <h2 className="text-lg font-semibold">{reportType === "individual" && selectedYouthReg ? `${selectedYouthReg.child_first_name} ${selectedYouthReg.child_last_name}` : `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`}</h2>
        <span className="text-sm text-white/40 ml-2">{dateRangeLabel}</span>
      </div>

      {isLoading && <p className="text-white/40 text-sm">Loading attendance data...</p>}

      {/* Individual Youth Header */}
      {reportType === "individual" && selectedYouthReg && (
        <Card className="bg-white/5 border-white/10 text-white">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
              {selectedYouthReg.child_headshot_url ? (
                <img src={selectedYouthReg.child_headshot_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="flex items-center justify-center w-full h-full text-xl text-white/40">{selectedYouthReg.child_first_name[0]}</span>
              )}
            </div>
            <div>
              <p className="text-lg font-semibold">{selectedYouthReg.child_first_name} {selectedYouthReg.child_last_name}</p>
              <p className="text-sm text-white/50">{selectedYouthReg.child_boxing_program} · {selectedYouthReg.child_school_district}</p>
              <div className="flex gap-2 mt-1">
                {selectedYouthReg.is_bald_eagle && (
                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">🦅 Bald Eagle</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compact Summary Strip */}
      <Card className="bg-white/5 border-white/10 text-white">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-x-8 gap-y-2 items-center">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Sign-Ins</p>
              <p className="text-xl font-bold">{totalAttendance}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Unique Youth</p>
              <p className="text-xl font-bold">{uniqueCount}</p>
            </div>
            {reportType !== "daily" && (
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Avg Daily</p>
                <p className="text-xl font-bold">{avgAttendance}</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Below Poverty</p>
              <p className="text-xl font-bold">{pct(poverty.below, poverty.total)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-amber-400/60">🦅 Bald Eagles</p>
              <p className="text-xl font-bold text-amber-400">{baldEagleRecords.length} <span className="text-xs text-white/30 font-normal">({baldEagleUniqueCount} unique)</span></p>
            </div>
            {reportType !== "daily" && reportType !== "individual" && highestDay && (
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-green-400/60">Peak Day</p>
                <p className="text-xl font-bold text-green-400">{highestDay.count} <span className="text-xs text-white/30 font-normal">{highestDay.fullDate}</span></p>
              </div>
            )}
            {reportType !== "daily" && reportType !== "individual" && lowestDay && (
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-red-400/60">Low Day</p>
                <p className="text-xl font-bold text-red-400">{lowestDay.count} <span className="text-xs text-white/30 font-normal">{lowestDay.fullDate}</span></p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card className="bg-white/5 border-white/10 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white/60">
            Sign-In Details ({filteredAttendance.length} records)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                 <TableRow className="border-white/10">
                  <TableHead className="text-white/60">#</TableHead>
                  <TableHead className="text-white/60">Date</TableHead>
                  <TableHead className="text-white/60">Name</TableHead>
                  <TableHead className="text-white/60">Program</TableHead>
                  <TableHead className="text-white/60">Source</TableHead>
                  <TableHead className="text-white/60">District</TableHead>
                  <TableHead className="text-white/60">Time</TableHead>
                  <TableHead className="text-white/60 w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttendance.length === 0 ? (
                  <TableRow>
                   <TableCell colSpan={8} className="text-center text-white/30 py-8">
                      {reportType === "individual" && !selectedYouthId ? "Search and select a youth above" : "No attendance records for this period"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAttendance.map((a, i) => {
                    const reg = regMap[a.registration_id];
                    return (
                      <TableRow key={a.id} className="border-white/10">
                        <TableCell className="text-white/40 text-xs">{i + 1}</TableCell>
                        <TableCell className="text-white text-sm">{format(parseISO(a.check_in_date), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-white font-medium text-sm flex items-center gap-1.5">
                          {reg?.is_bald_eagle && <Star className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />}
                          {reg ? `${reg.child_first_name} ${reg.child_last_name}` : "Unknown"}
                        </TableCell>
                        <TableCell className="text-white/60 text-xs">{reg?.child_boxing_program || ""}</TableCell>
                        <TableCell><span className={`text-xs px-1.5 py-0.5 rounded-full ${a.program_source === 'Lil Champs Corner' ? 'bg-sky-500/15 text-sky-400' : 'bg-green-500/15 text-green-400'}`}>{a.program_source || 'NLA'}</span></TableCell>
                        <TableCell className="text-white/60 text-xs">{reg?.child_school_district || ""}</TableCell>
                        <TableCell className="text-white/50 text-xs">{format(new Date(a.check_in_at), "h:mm a")}</TableCell>
                        <TableCell>
                          <button
                            onClick={() => {
                              const reg = regMap[a.registration_id];
                              setDeleteTarget({ id: a.id, name: reg ? `${reg.child_first_name} ${reg.child_last_name}` : "Unknown", date: a.check_in_date });
                            }}
                            className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                            title="Remove check-in"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Single Check-In Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Remove Check-In?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/70">
            This will delete <span className="font-medium text-white">{deleteTarget?.name}</span>'s check-in for <span className="font-medium text-white">{deleteTarget?.date ? format(parseISO(deleteTarget.date), "MMMM d, yyyy") : ""}</span>.
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

export default AdminAttendanceReports;
