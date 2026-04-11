import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subDays, startOfWeek, startOfMonth, startOfYear, subMonths, parseISO, differenceInYears } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { CalendarIcon, Plus, FileText, Trash2, Eye, Download, ArrowLeft, ArrowRight, RotateCcw, CheckCircle2, BarChart3, Users, Bus, DollarSign, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer, AlignmentType, WidthType, ShadingType, BorderStyle, PageBreak, ImageRun, PageNumber } from "docx";
import { saveAs } from "file-saver";
import nlaLogo from "@/assets/nla-logo.png";


/* ───────── types ───────── */
type Report = {
  id: string;
  report_name: string;
  date_range_start: string;
  date_range_end: string;
  status: string;
  config: ReportConfig;
  report_data: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ReportConfig = {
  sections: string[];
};

const ALL_SECTIONS = [
  { key: "youth_summary", label: "Youth Transportation Summary", icon: Users },
  { key: "demographics", label: "Demographics Breakdown", icon: PieChart },
  { key: "poverty", label: "Federal Poverty Line Analysis", icon: BarChart3 },
  { key: "routes", label: "Route & Zone Breakdown", icon: Bus },
  { key: "trip_frequency", label: "Trip Frequency (Daily/Weekly/Monthly/Yearly)", icon: BarChart3 },
  { key: "driver_pay", label: "Driver Activity & Pay Summary", icon: DollarSign },
  { key: "ytd", label: "Year-to-Date Totals", icon: BarChart3 },
];

const PRESET_RANGES: { label: string; getValue: () => [Date, Date] }[] = [
  { label: "This Week", getValue: () => [startOfWeek(new Date(), { weekStartsOn: 1 }), new Date()] },
  { label: "This Month", getValue: () => [startOfMonth(new Date()), new Date()] },
  { label: "Last 30 Days", getValue: () => [subDays(new Date(), 30), new Date()] },
  { label: "Last Quarter", getValue: () => [subMonths(startOfMonth(new Date()), 3), new Date()] },
  { label: "This Year", getValue: () => [startOfYear(new Date()), new Date()] },
];

const CHART_COLORS = ["#CC0000", "#002868", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#6B7280"];

/* ───────── Main Component ───────── */
export default function AdminTransportImpactReports() {
  const qc = useQueryClient();
  const [view, setView] = useState<"list" | "builder" | "preview">("list");
  const [step, setStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [reportName, setReportName] = useState("");
  const [dateStart, setDateStart] = useState<Date | undefined>();
  const [dateEnd, setDateEnd] = useState<Date | undefined>();
  const [selectedSections, setSelectedSections] = useState<string[]>(ALL_SECTIONS.map(s => s.key));
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  /* ── Fetch saved reports ── */
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["transport-impact-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_impact_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Report[];
    },
  });

  /* ── Delete mutation ── */
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transport_impact_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport-impact-reports"] }); toast.success("Report deleted"); setDeleteId(null); },
    onError: () => toast.error("Failed to delete report"),
  });

  /* ── Save / update mutation ── */
  const saveMut = useMutation({
    mutationFn: async (payload: { id?: string; status: string }) => {
      const obj: any = {
        report_name: reportName,
        date_range_start: dateStart ? format(dateStart, "yyyy-MM-dd") : "",
        date_range_end: dateEnd ? format(dateEnd, "yyyy-MM-dd") : "",
        status: payload.status,
        config: { sections: selectedSections },
        report_data: previewData,
      };
      if (payload.id) {
        const { error } = await supabase.from("transport_impact_reports").update(obj).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transport_impact_reports").insert(obj);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["transport-impact-reports"] });
      toast.success(vars.status === "Final" ? "Report finalized!" : "Draft saved");
      resetBuilder();
    },
    onError: () => toast.error("Failed to save report"),
  });

  /* ── Build report data from existing tables ── */
  const buildReportData = useCallback(async () => {
    if (!dateStart || !dateEnd) return null;
    setLoadingPreview(true);
    const ds = format(dateStart, "yyyy-MM-dd");
    const de = format(dateEnd, "yyyy-MM-dd");

    try {
      // Fetch runs in date range
      const { data: runs } = await supabase
        .from("runs")
        .select("*, drivers(name), routes(name)")
        .gte("started_at", ds)
        .lte("started_at", de + "T23:59:59")
        .eq("status", "completed");

      // Fetch attendance for those runs
      const runIds = (runs || []).map(r => r.id);
      let attendance: any[] = [];
      if (runIds.length > 0) {
        // Batch in groups of 50
        for (let i = 0; i < runIds.length; i += 50) {
          const batch = runIds.slice(i, i + 50);
          const { data } = await supabase.from("transport_attendance").select("*, youth_profiles(*)").in("run_id", batch);
          if (data) attendance = attendance.concat(data);
        }
      }

      // Fetch youth profiles for demographic data
      const youthIds = [...new Set(attendance.map(a => a.youth_id))];
      let youthProfiles: any[] = [];
      if (youthIds.length > 0) {
        for (let i = 0; i < youthIds.length; i += 50) {
          const batch = youthIds.slice(i, i + 50);
          const { data } = await supabase.from("youth_profiles").select("*").in("id", batch);
          if (data) youthProfiles = youthProfiles.concat(data);
        }
      }

      // Try to match youth to registrations for demographics
      const youthNames = youthProfiles.map(y => ({ first: y.first_name, last: y.last_name }));
      let registrations: any[] = [];
      if (youthNames.length > 0) {
        const { data } = await supabase.from("youth_registrations").select("*");
        if (data) registrations = data;
      }

      // Match youth profiles to registrations by name
      const youthWithDemographics = youthProfiles.map(yp => {
        const reg = registrations.find(r =>
          r.child_first_name?.toLowerCase() === yp.first_name?.toLowerCase() &&
          r.child_last_name?.toLowerCase() === yp.last_name?.toLowerCase()
        );
        return { ...yp, registration: reg || null };
      });

      // Fetch driver pay periods
      const { data: payPeriods } = await supabase
        .from("driver_pay_periods")
        .select("*, drivers(name)")
        .lte("period_start", de)
        .gte("period_end", ds);

      // Fetch run approvals
      let runApprovals: any[] = [];
      if (runIds.length > 0) {
        for (let i = 0; i < runIds.length; i += 50) {
          const batch = runIds.slice(i, i + 50);
          const { data } = await supabase.from("run_approvals").select("*").in("run_id", batch);
          if (data) runApprovals = runApprovals.concat(data);
        }
      }

      /* ── Compute metrics ── */
      const totalTrips = (runs || []).length;
      const uniqueYouth = new Set(attendance.map(a => a.youth_id)).size;
      const avgYouthPerTrip = totalTrips > 0 ? (attendance.length / totalTrips).toFixed(1) : "0";

      // Pickup vs Dropoff
      const pickups = (runs || []).filter(r => r.run_type === "pickup").length;
      const dropoffs = (runs || []).filter(r => r.run_type === "dropoff").length;

      // Route breakdown
      const routeMap: Record<string, { trips: number; youth: Set<string> }> = {};
      (runs || []).forEach(r => {
        const rname = (r as any).routes?.name || "Unknown";
        if (!routeMap[rname]) routeMap[rname] = { trips: 0, youth: new Set() };
        routeMap[rname].trips++;
      });
      attendance.forEach(a => {
        const run = (runs || []).find(r => r.id === a.run_id);
        if (run) {
          const rname = (run as any).routes?.name || "Unknown";
          if (routeMap[rname]) routeMap[rname].youth.add(a.youth_id);
        }
      });
      const routeData = Object.entries(routeMap).map(([name, v]) => ({
        name, trips: v.trips, youth: v.youth.size,
      }));

      // Trip frequency by month
      const monthlyTrips: Record<string, number> = {};
      (runs || []).forEach(r => {
        const m = format(new Date(r.started_at), "yyyy-MM");
        monthlyTrips[m] = (monthlyTrips[m] || 0) + 1;
      });
      const monthlyData = Object.entries(monthlyTrips).sort().map(([month, count]) => ({ month, trips: count }));

      // Demographics
      const ageBuckets: Record<string, number> = {};
      const genderMap: Record<string, number> = {};
      const raceMap: Record<string, number> = {};
      const incomeMap: Record<string, number> = {};
      let povertyCount = 0;

      youthWithDemographics.forEach(y => {
        const reg = y.registration;
        if (reg) {
          // Age
          if (reg.child_date_of_birth) {
            const age = differenceInYears(new Date(), parseISO(reg.child_date_of_birth));
            const bucket = `${age}`;
            ageBuckets[bucket] = (ageBuckets[bucket] || 0) + 1;
          }
          // Gender
          if (reg.child_sex) {
            genderMap[reg.child_sex] = (genderMap[reg.child_sex] || 0) + 1;
          }
          // Race
          if (reg.child_race_ethnicity) {
            raceMap[reg.child_race_ethnicity] = (raceMap[reg.child_race_ethnicity] || 0) + 1;
          }
          // Income
          if (reg.household_income_range) {
            incomeMap[reg.household_income_range] = (incomeMap[reg.household_income_range] || 0) + 1;
            // Rough poverty check
            const income = reg.household_income_range.toLowerCase();
            if (income.includes("under") || income.includes("below") || income.includes("0") || income.includes("15,000") || income.includes("20,000") || income.includes("25,000") || income.includes("30,000")) {
              povertyCount++;
            }
          }
        }
      });

      const ageData = Object.entries(ageBuckets).sort((a, b) => Number(a[0]) - Number(b[0])).map(([age, count]) => ({ age: `Age ${age}`, count }));
      const genderData = Object.entries(genderMap).map(([name, value]) => ({ name, value }));
      const raceData = Object.entries(raceMap).map(([name, value]) => ({ name, value }));
      const incomeData = Object.entries(incomeMap).map(([name, value]) => ({ name, value }));
      const povertyPct = uniqueYouth > 0 ? ((povertyCount / uniqueYouth) * 100).toFixed(1) : "0";

      // Driver summary
      const driverMap: Record<string, { name: string; trips: number; approved: number; pending: number; totalPay: number }> = {};
      (runs || []).forEach(r => {
        const dname = (r as any).drivers?.name || "Unknown";
        if (!driverMap[r.driver_id]) driverMap[r.driver_id] = { name: dname, trips: 0, approved: 0, pending: 0, totalPay: 0 };
        driverMap[r.driver_id].trips++;
        const approval = runApprovals.find(a => a.run_id === r.id);
        if (approval?.status === "approved") driverMap[r.driver_id].approved++;
        else driverMap[r.driver_id].pending++;
      });
      (payPeriods || []).forEach(pp => {
        if (driverMap[pp.driver_id]) {
          driverMap[pp.driver_id].totalPay += Number(pp.total_amount || 0);
        }
      });
      const driverData = Object.values(driverMap);
      const totalProgramCost = driverData.reduce((s, d) => s + d.totalPay, 0);

      // YTD totals
      const ytdStart = format(startOfYear(new Date()), "yyyy-MM-dd");
      const { data: ytdRuns } = await supabase.from("runs").select("id").gte("started_at", ytdStart).eq("status", "completed");
      let ytdAttendance: any[] = [];
      const ytdRunIds = (ytdRuns || []).map(r => r.id);
      if (ytdRunIds.length > 0) {
        for (let i = 0; i < ytdRunIds.length; i += 50) {
          const batch = ytdRunIds.slice(i, i + 50);
          const { data } = await supabase.from("transport_attendance").select("youth_id").in("run_id", batch);
          if (data) ytdAttendance = ytdAttendance.concat(data);
        }
      }
      const { data: ytdPay } = await supabase.from("driver_pay_periods").select("total_amount").gte("period_start", ytdStart);

      const result = {
        totalTrips,
        uniqueYouth,
        avgYouthPerTrip,
        pickups,
        dropoffs,
        totalAttendanceRecords: attendance.length,
        routeData,
        monthlyData,
        ageData,
        genderData,
        raceData,
        incomeData,
        povertyCount,
        povertyPct,
        driverData,
        totalProgramCost,
        ytd: {
          trips: (ytdRuns || []).length,
          uniqueYouth: new Set(ytdAttendance.map(a => a.youth_id)).size,
          totalPay: (ytdPay || []).reduce((s, p) => s + Number(p.total_amount || 0), 0),
        },
      };

      setPreviewData(result);
      return result;
    } catch (err) {
      console.error("Error building report data:", err);
      toast.error("Failed to build report data");
      return null;
    } finally {
      setLoadingPreview(false);
    }
  }, [dateStart, dateEnd]);

  const resetBuilder = () => {
    setView("list");
    setStep(1);
    setEditingId(null);
    setReportName("");
    setDateStart(undefined);
    setDateEnd(undefined);
    setSelectedSections(ALL_SECTIONS.map(s => s.key));
    setPreviewData(null);
  };

  const startNewReport = () => {
    resetBuilder();
    setView("builder");
  };

  const editReport = (r: Report) => {
    setEditingId(r.id);
    setReportName(r.report_name);
    setDateStart(parseISO(r.date_range_start));
    setDateEnd(parseISO(r.date_range_end));
    setSelectedSections((r.config as ReportConfig)?.sections || ALL_SECTIONS.map(s => s.key));
    setPreviewData(r.report_data);
    setView("builder");
    setStep(3);
  };

  const previewReport = (r: Report) => {
    setReportName(r.report_name);
    setDateStart(parseISO(r.date_range_start));
    setDateEnd(parseISO(r.date_range_end));
    setSelectedSections((r.config as ReportConfig)?.sections || []);
    setPreviewData(r.report_data);
    setEditingId(r.id);
    setView("preview");
  };

  const handleStepForward = async () => {
    if (step === 1) {
      if (!reportName.trim()) { toast.error("Enter a report name"); return; }
      if (!dateStart || !dateEnd) { toast.error("Select a date range"); return; }
      setStep(2);
    } else if (step === 2) {
      if (selectedSections.length === 0) { toast.error("Select at least one section"); return; }
      await buildReportData();
      setStep(3);
    }
  };

  /* ── DOCX Generation ── */
  const generateDocx = useCallback(async () => {
    if (!previewData) return;
    const s = selectedSections;
    const rangeStr = dateStart && dateEnd ? `${format(dateStart, "MMMM d, yyyy")} — ${format(dateEnd, "MMMM d, yyyy")}` : "";
    const generatedDate = format(new Date(), "MMMM d, yyyy");

    // Load logo
    let logoData: ArrayBuffer | null = null;
    try {
      const resp = await fetch(nlaLogo);
      logoData = await resp.arrayBuffer();
    } catch { /* skip logo */ }

    const navy = "002868";
    const red = "CC0000";
    const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
    const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
    const headerShading = { fill: navy, type: ShadingType.CLEAR, color: "auto" };
    const altShading = { fill: "F5F5F5", type: ShadingType.CLEAR, color: "auto" };
    const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

    const makeHeaderRow = (cols: string[]) =>
      new TableRow({
        children: cols.map(c =>
          new TableCell({
            borders: cellBorders, shading: headerShading, margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, color: "FFFFFF", font: "Arial", size: 20 })] })],
          })
        ),
      });

    const makeRow = (cols: string[], alt = false) =>
      new TableRow({
        children: cols.map(c =>
          new TableCell({
            borders: cellBorders, margins: cellMargins,
            ...(alt ? { shading: altShading } : {}),
            children: [new Paragraph({ children: [new TextRun({ text: c, font: "Arial", size: 20 })] })],
          })
        ),
      });

    const sectionTitle = (text: string) => new Paragraph({
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text, bold: true, font: "Arial", size: 28, color: navy })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: red, space: 4 } },
    });

    // Build content sections
    const children: any[] = [];

    // ── Cover page ──
    children.push(new Paragraph({ spacing: { before: 2400 }, children: [] }));
    if (logoData) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: "png", data: logoData, transformation: { width: 120, height: 120 }, altText: { title: "NLA Logo", description: "No Limits Academy Logo", name: "nla-logo" } })],
      }));
    }
    children.push(new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TRANSPORTATION", bold: true, font: "Arial", size: 56, color: navy })] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "IMPACT REPORT", bold: true, font: "Arial", size: 56, color: navy })] }));
    children.push(new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", color: red, font: "Arial", size: 20 })] }));
    children.push(new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: reportName, bold: true, font: "Arial", size: 28 })] }));
    children.push(new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: rangeStr, font: "Arial", size: 22 })] }));
    children.push(new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Generated: ${generatedDate}`, font: "Arial", size: 20, color: "666666" })] }));
    children.push(new Paragraph({ spacing: { before: 100 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "No Limits Academy — Boxing & Youth Development", font: "Arial", size: 20, color: "666666" })] }));
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // ── Youth Transportation Summary ──
    if (s.includes("youth_summary")) {
      children.push(sectionTitle("Youth Transportation Summary"));
      const rows = [
        ["Total Unique Youth Transported", String(previewData.uniqueYouth)],
        ["Total Trips Completed", String(previewData.totalTrips)],
        ["Average Youth per Trip", String(previewData.avgYouthPerTrip)],
        ["Total Pickups", String(previewData.pickups)],
        ["Total Dropoffs", String(previewData.dropoffs)],
        ["Total Rides Provided", String(previewData.totalAttendanceRecords)],
      ];
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [6000, 3360],
        rows: [makeHeaderRow(["Metric", "Value"]), ...rows.map((r, i) => makeRow(r, i % 2 === 1))],
      }));
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // ── Demographics ──
    if (s.includes("demographics")) {
      children.push(sectionTitle("Demographics Breakdown"));
      if (previewData.genderData?.length) {
        children.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: "Gender Breakdown", bold: true, font: "Arial", size: 22 })] }));
        children.push(new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [4000, 2680, 2680],
          rows: [makeHeaderRow(["Gender", "Count", "Percentage"]),
            ...previewData.genderData.map((g: any, i: number) => makeRow([g.name, String(g.value), `${((g.value / previewData.uniqueYouth) * 100).toFixed(1)}%`], i % 2 === 1))],
        }));
      }
      if (previewData.raceData?.length) {
        children.push(new Paragraph({ spacing: { before: 300, after: 100 }, children: [new TextRun({ text: "Race / Ethnicity Breakdown", bold: true, font: "Arial", size: 22 })] }));
        children.push(new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [4000, 2680, 2680],
          rows: [makeHeaderRow(["Race / Ethnicity", "Count", "Percentage"]),
            ...previewData.raceData.map((r: any, i: number) => makeRow([r.name, String(r.value), `${((r.value / previewData.uniqueYouth) * 100).toFixed(1)}%`], i % 2 === 1))],
        }));
      }
      if (previewData.ageData?.length) {
        children.push(new Paragraph({ spacing: { before: 300, after: 100 }, children: [new TextRun({ text: "Age Breakdown", bold: true, font: "Arial", size: 22 })] }));
        children.push(new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [4680, 4680],
          rows: [makeHeaderRow(["Age", "Count"]),
            ...previewData.ageData.map((a: any, i: number) => makeRow([a.age, String(a.count)], i % 2 === 1))],
        }));
      }
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // ── Poverty ──
    if (s.includes("poverty")) {
      children.push(sectionTitle("Federal Poverty Line Analysis"));
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [6000, 3360],
        rows: [makeHeaderRow(["Metric", "Value"]),
          makeRow(["Youth at/below Poverty Line", String(previewData.povertyCount)]),
          makeRow(["Percentage of Total Youth Served", `${previewData.povertyPct}%`], true)],
      }));
      if (previewData.incomeData?.length) {
        children.push(new Paragraph({ spacing: { before: 300, after: 100 }, children: [new TextRun({ text: "Household Income Distribution", bold: true, font: "Arial", size: 22 })] }));
        children.push(new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [4000, 2680, 2680],
          rows: [makeHeaderRow(["Income Bracket", "Count", "Percentage"]),
            ...previewData.incomeData.map((inc: any, i: number) => makeRow([inc.name, String(inc.value), `${((inc.value / previewData.uniqueYouth) * 100).toFixed(1)}%`], i % 2 === 1))],
        }));
      }
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // ── Routes ──
    if (s.includes("routes")) {
      children.push(sectionTitle("Route & Zone Breakdown"));
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4000, 2680, 2680],
        rows: [makeHeaderRow(["Route / Zone", "Trips", "Unique Youth"]),
          ...previewData.routeData.map((r: any, i: number) => makeRow([r.name, String(r.trips), String(r.youth)], i % 2 === 1))],
      }));
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // ── Trip Frequency ──
    if (s.includes("trip_frequency")) {
      children.push(sectionTitle("Trip Frequency"));
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4680, 4680],
        rows: [makeHeaderRow(["Month", "Trips"]),
          ...previewData.monthlyData.map((m: any, i: number) => makeRow([m.month, String(m.trips)], i % 2 === 1))],
      }));
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // ── Driver Pay ──
    if (s.includes("driver_pay")) {
      children.push(sectionTitle("Driver Activity & Pay Summary"));
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2400, 1500, 1600, 1600, 2260],
        rows: [makeHeaderRow(["Driver", "Trips", "Approved", "Pending", "Total Pay"]),
          ...previewData.driverData.map((d: any, i: number) => makeRow([d.name, String(d.trips), String(d.approved), String(d.pending), `$${d.totalPay.toFixed(2)}`], i % 2 === 1))],
      }));
      children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `Total Program Transportation Cost: $${previewData.totalProgramCost.toFixed(2)}`, bold: true, font: "Arial", size: 24, color: red })] }));
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // ── YTD ──
    if (s.includes("ytd")) {
      children.push(sectionTitle("Year-to-Date Totals"));
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [6000, 3360],
        rows: [makeHeaderRow(["Metric", "YTD Value"]),
          makeRow(["Total Trips", String(previewData.ytd.trips)]),
          makeRow(["Unique Youth Served", String(previewData.ytd.uniqueYouth)], true),
          makeRow(["Total Driver Pay", `$${previewData.ytd.totalPay.toFixed(2)}`])],
      }));
    }

    // Build document
    const doc = new Document({
      styles: {
        default: { document: { run: { font: "Arial", size: 24 } } },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "No Limits Academy — Transportation Impact Report", font: "Arial", size: 16, color: "999999", italics: true })],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "No Limits Academy — Boxing & Youth Development | Confidential  •  Page ", font: "Arial", size: 16, color: "999999" }),
                new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "999999" }),
              ],
            })],
          }),
        },
        children,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${reportName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.docx`);
    toast.success("Word document downloaded");
  }, [previewData, reportName, dateStart, dateEnd, selectedSections]);

  /* ────────────── RENDER ────────────── */

  // Delete confirmation dialog
  const deleteDialog = (
    <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
      <DialogContent className="bg-zinc-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Delete Report</DialogTitle>
          <DialogDescription className="text-white/60">Are you sure you want to delete this report? This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setDeleteId(null)} className="text-white/60">Cancel</Button>
          <Button variant="destructive" onClick={() => deleteId && deleteMut.mutate(deleteId)} disabled={deleteMut.isPending}>
            {deleteMut.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  /* ── LIST VIEW ── */
  if (view === "list") {
    return (
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Transportation Impact Reports</h1>
            <p className="text-white/50 text-sm mt-1">Generate funder-ready reports from your transportation data</p>
          </div>
          <Button onClick={startNewReport} className="bg-[#CC0000] hover:bg-[#CC0000]/80 text-white">
            <Plus className="w-4 h-4 mr-2" /> Create New Report
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" /></div>
        ) : reports.length === 0 ? (
          <Card className="bg-zinc-900/60 border-white/10">
            <CardContent className="py-16 text-center">
              <FileText className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/60 text-lg">No reports yet</p>
              <p className="text-white/40 text-sm mt-1 mb-6">Click "Create New Report" to generate your first transportation impact report.</p>
              <Button onClick={startNewReport} className="bg-[#CC0000] hover:bg-[#CC0000]/80 text-white">
                <Plus className="w-4 h-4 mr-2" /> Create New Report
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map(r => (
              <Card key={r.id} className="bg-zinc-900/60 border-white/10 hover:border-white/20 transition-colors">
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-semibold truncate">{r.report_name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === "Final" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-white/40 text-xs mt-1">
                      {format(parseISO(r.date_range_start), "MMM d, yyyy")} — {format(parseISO(r.date_range_end), "MMM d, yyyy")}
                      <span className="mx-2">·</span>
                      Created {format(parseISO(r.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="ghost" className="text-white/60 hover:text-white" onClick={() => previewReport(r)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {r.status === "Draft" && (
                      <Button size="sm" variant="ghost" className="text-white/60 hover:text-white" onClick={() => editReport(r)}>
                        <FileText className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => setDeleteId(r.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {deleteDialog}
      </div>
    );
  }

  /* ── PREVIEW VIEW ── */
  if (view === "preview") {
    return (
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" className="text-white/60 hover:text-white" onClick={resetBuilder}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Reports
          </Button>
          <Button onClick={generateDocx} className="bg-[#002868] hover:bg-[#002868]/80 text-white">
            <Download className="w-4 h-4 mr-2" /> Download Word Doc
          </Button>
        </div>
        <ReportPreviewContent data={previewData} sections={selectedSections} reportName={reportName} dateStart={dateStart} dateEnd={dateEnd} />
        {deleteDialog}
      </div>
    );
  }

  /* ── BUILDER VIEW ── */
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" className="text-white/60 hover:text-white" onClick={resetBuilder}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Cancel
        </Button>
        <div className="flex items-center gap-1">
          {[1, 2, 3].map(n => (
            <div key={n} className={`w-8 h-1 rounded-full ${n <= step ? "bg-[#CC0000]" : "bg-white/10"}`} />
          ))}
        </div>
        <Button variant="ghost" size="sm" className="text-white/40 hover:text-white" onClick={() => { setStep(1); setSelectedSections(ALL_SECTIONS.map(s => s.key)); }}>
          <RotateCcw className="w-4 h-4 mr-1" /> Reset
        </Button>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <Card className="bg-zinc-900/60 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-lg">Step 1: Name & Date Range</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="text-white/70 text-sm">Report Name</Label>
              <Input value={reportName} onChange={e => setReportName(e.target.value)} placeholder="e.g. Q1 2026 Transportation Report" className="bg-white/5 border-white/10 text-white mt-1" />
            </div>

            <div>
              <Label className="text-white/70 text-sm mb-2 block">Quick Presets</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_RANGES.map(pr => (
                  <Button key={pr.label} size="sm" variant="outline" className="text-white/70 border-white/10 hover:border-white/30 hover:text-white text-xs"
                    onClick={() => { const [s, e] = pr.getValue(); setDateStart(s); setDateEnd(e); }}>
                    {pr.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-white/70 text-sm">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-white/5 border-white/10 text-white mt-1", !dateStart && "text-white/40")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateStart ? format(dateStart, "PPP") : "Pick start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateStart} onSelect={setDateStart} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-white/70 text-sm">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-white/5 border-white/10 text-white mt-1", !dateEnd && "text-white/40")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateEnd ? format(dateEnd, "PPP") : "Pick end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateEnd} onSelect={setDateEnd} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleStepForward} className="bg-[#CC0000] hover:bg-[#CC0000]/80 text-white">
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <Card className="bg-zinc-900/60 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-lg">Step 2: Select Report Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ALL_SECTIONS.map(sec => {
              const Icon = sec.icon;
              return (
                <label key={sec.key} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                  <Checkbox
                    checked={selectedSections.includes(sec.key)}
                    onCheckedChange={checked => {
                      setSelectedSections(prev => checked ? [...prev, sec.key] : prev.filter(k => k !== sec.key));
                    }}
                  />
                  <Icon className="w-4 h-4 text-white/50" />
                  <span className="text-white text-sm">{sec.label}</span>
                </label>
              );
            })}
            <div className="flex justify-between pt-4">
              <Button variant="ghost" className="text-white/60" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={handleStepForward} className="bg-[#CC0000] hover:bg-[#CC0000]/80 text-white" disabled={loadingPreview}>
                {loadingPreview ? "Building Report…" : "Preview Report"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Preview & Save */}
      {step === 3 && (
        <div className="space-y-6">
          <ReportPreviewContent data={previewData} sections={selectedSections} reportName={reportName} dateStart={dateStart} dateEnd={dateEnd} />

          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4">
            <Button variant="ghost" className="text-white/60" onClick={() => setStep(2)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Edit Sections
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="border-white/10 text-white" onClick={() => saveMut.mutate({ id: editingId || undefined, status: "Draft" })} disabled={saveMut.isPending}>
                Save as Draft
              </Button>
              <Button onClick={() => saveMut.mutate({ id: editingId || undefined, status: "Final" })} className="bg-green-600 hover:bg-green-700 text-white" disabled={saveMut.isPending}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Finalize Report
              </Button>
              <Button onClick={generateDocx} className="bg-[#002868] hover:bg-[#002868]/80 text-white">
                <Download className="w-4 h-4 mr-2" /> Word Doc
              </Button>
            </div>
          </div>
        </div>
      )}
      {deleteDialog}
    </div>
  );
}

/* ────────────── Preview Content Component ────────────── */
function ReportPreviewContent({ data, sections, reportName, dateStart, dateEnd }: {
  data: any; sections: string[]; reportName: string; dateStart?: Date; dateEnd?: Date;
}) {
  if (!data) {
    return (
      <Card className="bg-zinc-900/60 border-white/10">
        <CardContent className="py-16 text-center">
          <p className="text-white/60">No trip data found for this period</p>
        </CardContent>
      </Card>
    );
  }

  const s = sections;

  return (
    <div className="space-y-6">
      {/* Report header */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-white">{reportName}</h2>
        {dateStart && dateEnd && (
          <p className="text-white/50 text-sm">{format(dateStart, "MMMM d, yyyy")} — {format(dateEnd, "MMMM d, yyyy")}</p>
        )}
      </div>

      {/* Youth Summary */}
      {s.includes("youth_summary") && (
        <Card className="bg-zinc-900/60 border-white/10">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><Users className="w-5 h-5 text-[#CC0000]" /> Youth Transportation Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {[
                { label: "Unique Youth", value: data.uniqueYouth },
                { label: "Total Trips", value: data.totalTrips },
                { label: "Avg Youth/Trip", value: data.avgYouthPerTrip },
                { label: "Pickups", value: data.pickups },
                { label: "Dropoffs", value: data.dropoffs },
                { label: "Total Rides Provided", value: data.totalAttendanceRecords },
              ].map(m => (
                <div key={m.label} className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white">{m.value}</p>
                  <p className="text-white/50 text-xs mt-1">{m.label}</p>
                </div>
              ))}
            </div>
            {data.pickups + data.dropoffs > 0 && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{ name: "Pickups", value: data.pickups }, { name: "Dropoffs", value: data.dropoffs }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                    <Bar dataKey="value" fill="#CC0000" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Demographics */}
      {s.includes("demographics") && (
        <Card className="bg-zinc-900/60 border-white/10">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><PieChart className="w-5 h-5 text-[#002868]" /> Demographics Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {data.genderData?.length > 0 && (
              <div>
                <p className="text-white/70 text-sm font-medium mb-3">Gender</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie data={data.genderData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {data.genderData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {data.raceData?.length > 0 && (
              <div>
                <p className="text-white/70 text-sm font-medium mb-3">Race / Ethnicity</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.raceData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={140} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                      <Bar dataKey="value" fill="#002868" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {data.ageData?.length > 0 && (
              <div>
                <p className="text-white/70 text-sm font-medium mb-3">Age Distribution</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.ageData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="age" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                      <Bar dataKey="count" fill="#CC0000" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {!data.genderData?.length && !data.raceData?.length && !data.ageData?.length && (
              <p className="text-white/40 text-center py-6">No demographic data available for transported youth</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Poverty */}
      {s.includes("poverty") && (
        <Card className="bg-zinc-900/60 border-white/10">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#CC0000]" /> Federal Poverty Line Analysis</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-[#CC0000]">{data.povertyCount}</p>
                <p className="text-white/50 text-xs mt-1">Youth at/below Poverty Line</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-[#002868]">{data.povertyPct}%</p>
                <p className="text-white/50 text-xs mt-1">Of Total Youth Served</p>
              </div>
            </div>
            {data.incomeData?.length > 0 && (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.incomeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={160} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                    <Bar dataKey="value" fill="#002868" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Routes */}
      {s.includes("routes") && (
        <Card className="bg-zinc-900/60 border-white/10">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><Bus className="w-5 h-5 text-[#002868]" /> Route & Zone Breakdown</CardTitle></CardHeader>
          <CardContent>
            {data.routeData?.length > 0 ? (
              <>
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/10">
                      <th className="text-left text-white/60 py-2 px-3">Route</th>
                      <th className="text-right text-white/60 py-2 px-3">Trips</th>
                      <th className="text-right text-white/60 py-2 px-3">Youth</th>
                    </tr></thead>
                    <tbody>
                      {data.routeData.map((r: any) => (
                        <tr key={r.name} className="border-b border-white/5">
                          <td className="text-white py-2 px-3">{r.name}</td>
                          <td className="text-white/70 text-right py-2 px-3">{r.trips}</td>
                          <td className="text-white/70 text-right py-2 px-3">{r.youth}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.routeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                      <Legend />
                      <Bar dataKey="trips" fill="#CC0000" radius={[4, 4, 0, 0]} name="Trips" />
                      <Bar dataKey="youth" fill="#002868" radius={[4, 4, 0, 0]} name="Youth" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : <p className="text-white/40 text-center py-6">No route data for this period</p>}
          </CardContent>
        </Card>
      )}

      {/* Trip Frequency */}
      {s.includes("trip_frequency") && (
        <Card className="bg-zinc-900/60 border-white/10">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#CC0000]" /> Trip Frequency</CardTitle></CardHeader>
          <CardContent>
            {data.monthlyData?.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="trips" stroke="#CC0000" strokeWidth={2} dot={{ fill: "#CC0000" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-white/40 text-center py-6">No trip frequency data for this period</p>}
          </CardContent>
        </Card>
      )}

      {/* Driver Pay */}
      {s.includes("driver_pay") && (
        <Card className="bg-zinc-900/60 border-white/10">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-400" /> Driver Activity & Pay Summary</CardTitle></CardHeader>
          <CardContent>
            {data.driverData?.length > 0 ? (
              <>
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/10">
                      <th className="text-left text-white/60 py-2 px-3">Driver</th>
                      <th className="text-right text-white/60 py-2 px-3">Trips</th>
                      <th className="text-right text-white/60 py-2 px-3">Approved</th>
                      <th className="text-right text-white/60 py-2 px-3">Pending</th>
                      <th className="text-right text-white/60 py-2 px-3">Total Pay</th>
                    </tr></thead>
                    <tbody>
                      {data.driverData.map((d: any) => (
                        <tr key={d.name} className="border-b border-white/5">
                          <td className="text-white py-2 px-3">{d.name}</td>
                          <td className="text-white/70 text-right py-2 px-3">{d.trips}</td>
                          <td className="text-green-400 text-right py-2 px-3">{d.approved}</td>
                          <td className="text-yellow-400 text-right py-2 px-3">{d.pending}</td>
                          <td className="text-white text-right py-2 px-3 font-medium">${d.totalPay.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-white/5 rounded-lg p-4 text-center">
                  <p className="text-white/50 text-xs">Total Program Transportation Cost</p>
                  <p className="text-3xl font-bold text-[#CC0000]">${data.totalProgramCost.toFixed(2)}</p>
                </div>
              </>
            ) : <p className="text-white/40 text-center py-6">No driver data for this period</p>}
          </CardContent>
        </Card>
      )}

      {/* YTD */}
      {s.includes("ytd") && (
        <Card className="bg-zinc-900/60 border-white/10">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#002868]" /> Year-to-Date Totals</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-white">{data.ytd?.trips ?? 0}</p>
                <p className="text-white/50 text-xs mt-1">YTD Trips</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-white">{data.ytd?.uniqueYouth ?? 0}</p>
                <p className="text-white/50 text-xs mt-1">YTD Unique Youth</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-white">${(data.ytd?.totalPay ?? 0).toFixed(2)}</p>
                <p className="text-white/50 text-xs mt-1">YTD Driver Pay</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
