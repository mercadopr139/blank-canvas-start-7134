import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Eye, AlertTriangle, ExternalLink, Loader2, Pencil, Trash2, CheckCircle2, XCircle, ShieldCheck, Download, Star, ImagePlus } from "lucide-react";
import MondayPhotoSyncModal from "@/components/admin/MondayPhotoSyncModal";
import { Switch } from "@/components/ui/switch";
import { format, parseISO, differenceInYears, differenceInMonths } from "date-fns";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { getProgramYearForRegistration, shortProgramYear, getPriorProgramYear, isArchiveWindowOpen } from "@/lib/programYear";
import { Archive } from "lucide-react";

const HeadshotThumbnail = ({ headshotPath, size = "sm" }: { headshotPath: string; size?: "sm" | "lg" }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  
  useEffect(() => {
    if (headshotPath.startsWith("http")) {
      setUrl(headshotPath);
    } else {
      const cleanPath = headshotPath.replace(/^youth-photos\//, "");
      setUrl(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/youth-photos/${cleanPath}`);
    }
  }, [headshotPath]);
  const sizeClass = size === "lg" ? "w-28 h-28" : "w-10 h-10";
  if (!url) return <div className={`${sizeClass} rounded-full bg-muted animate-pulse shrink-0`} />;
  return (
    <>
      <img
        src={url}
        alt="Youth"
        className={`${sizeClass} rounded-full object-cover border-2 border-border shrink-0 cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={() => setFullscreen(true)}
      />
      {fullscreen && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center" onClick={() => setFullscreen(false)}>
          <button
            onClick={(e) => { e.stopPropagation(); setFullscreen(false); }}
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
          >
            <XCircle className="w-8 h-8" />
          </button>
          <img src={url} alt="Youth fullscreen" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </>
  );
};

const EXTENDED_PROGRAMS = ["Rams Program", "Hawk Squad", "Islanders", "Lil Champs Corner"] as const;

const getFunctionErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null) {
    const functionError = error as { message?: string; context?: { error?: string } };
    if (typeof functionError.context?.error === "string") return functionError.context.error;
    if (typeof functionError.message === "string") return functionError.message;
  }

  return "Failed to update approval status";
};

const APPROVAL_TIMEOUT_MS = 10_000;

const updateRegistrationApproval = async ({
  registrationId,
  approved,
}: {
  registrationId: string;
  approved: boolean;
}) => {
  const rpcCall = supabase.rpc("admin_set_registration_approval", {
    _registration_id: registrationId,
    _approved: approved,
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Network is too slow. Please try again.")), APPROVAL_TIMEOUT_MS);
  });

  const { data, error } = await Promise.race([rpcCall, timeoutPromise]);

  if (error) {
    throw new Error(getFunctionErrorMessage(error));
  }

  return data;
};

const AdminRegistrations = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [baldEagleFilter, setBaldEagleFilter] = useState<string>("all");
  const [extendedProgramFilter, setExtendedProgramFilter] = useState<string>("all");
  // Defaults to the current program year so admins see today's cohort
  // without having to pick. Flips automatically on Aug 1.
  const [programYearFilter, setProgramYearFilter] = useState<string>(() => getProgramYearForRegistration());
  // Archive-ceremony state — confirmation dialog for closing out the
  // prior program year (visible Aug 1 → Sept 30 each year).
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<any | null>(null);
  const [detailMode, setDetailMode] = useState<"view" | "edit">("view");
  const [csvFallbackUrl, setCsvFallbackUrl] = useState<string | null>(null);
  const [csvExportCount, setCsvExportCount] = useState(0);
  const [bulkPhotoOpen, setBulkPhotoOpen] = useState(false);

  const { data: registrations, isLoading } = useQuery({
    queryKey: ["youth-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("*")
        .order("submission_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription for photo updates
  useEffect(() => {
    const channel = supabase
      .channel("admin_youth_photos")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "youth_registrations",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["youth-registrations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredRegistrations = registrations
    ?.filter((reg) => {
      const matchesSearch =
        searchQuery === "" ||
        `${reg.child_first_name} ${reg.child_last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${reg.parent_first_name} ${reg.parent_last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reg.parent_email?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesProgram = programFilter === "all" || reg.child_boxing_program === programFilter;
      const matchesDistrict = districtFilter === "all" || reg.child_school_district === districtFilter;
      const matchesBaldEagle = baldEagleFilter === "all" || (baldEagleFilter === "yes" ? reg.is_bald_eagle : !reg.is_bald_eagle);
      const matchesExtended = extendedProgramFilter === "all"
        || (extendedProgramFilter === "unassigned" ? !(reg as any).extended_program : (reg as any).extended_program === extendedProgramFilter);
      // Defensive: if no rows in the dataset have program_year set yet
      // (Phase B migration not applied), the filter is a no-op so the
      // list doesn't go blank.
      const matchesProgramYear = programYearFilter === "__all__"
        || programYears.length === 0
        || (reg as any).program_year === programYearFilter;

      return matchesSearch && matchesProgram && matchesDistrict && matchesBaldEagle && matchesExtended && matchesProgramYear;
    })
    .sort((a, b) => {
      const lastNameCompare = a.child_last_name.localeCompare(b.child_last_name);
      if (lastNameCompare !== 0) return lastNameCompare;
      return a.child_first_name.localeCompare(b.child_first_name);
    });

  const calculateAge = (dob: string) => {
    if (!dob) return { display: "—", tooltip: "" };
    const birthDate = parseISO(dob);
    const now = new Date();
    const years = differenceInYears(now, birthDate);
    const totalMonths = differenceInMonths(now, birthDate);
    const months = totalMonths - years * 12;
    if (years < 0 || months < 0) return { display: "—", tooltip: "" };
    return {
      display: `${years}`,
      tooltip: `${years} years, ${months} months\nDOB: ${format(birthDate, "MMMM d, yyyy")}`,
    };
  };

  const hasMedicalAlerts = (reg: any) => {
    return (reg.allergies && reg.allergies.trim()) || (reg.asthma_inhaler_info && reg.asthma_inhaler_info.trim());
  };


  const buildCsvString = () => {
    const rows = filteredRegistrations || [];
    if (rows.length === 0) return null;
    const headers = ["Child Name", "Date of Birth", "Age", "Program", "Extended Program", "District", "Parent Name", "Parent Email", "Parent Phone", "Bald Eagle", "Medical Alert", "Registration Date", "Attendance Status"];
    const csvRows = rows.map((r: any) => {
      const age = calculateAge(r.child_date_of_birth);
      const ageStr = typeof age === "string" ? age : age.tooltip.split("\n")[0];
      const medical = hasMedicalAlerts(r) ? "Yes" : "No";
      return [
        `${r.child_first_name || ""} ${r.child_last_name || ""}`.trim(),
        r.child_date_of_birth ? format(parseISO(r.child_date_of_birth), "MM/dd/yyyy") : "",
        ageStr,
        r.child_boxing_program || "",
        r.extended_program || "Unassigned",
        r.child_school_district || "",
        `${r.parent_first_name || ""} ${r.parent_last_name || ""}`.trim(),
        r.parent_email || "",
        r.parent_phone || "",
        r.is_bald_eagle ? "Yes" : "No",
        medical,
        r.submission_date ? format(parseISO(r.submission_date), "MM/dd/yyyy") : "",
        r.approved_for_attendance ? "Approved" : "Pending",
      ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
    });
    return "\uFEFF" + [headers.join(","), ...csvRows].join("\r\n");
  };

  const exportFilteredCsv = () => {
    try {
      const rows = filteredRegistrations || [];
      if (rows.length === 0) {
        toast.error("No records to export");
        return;
      }
      const csv = buildCsvString();
      if (!csv) return;

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const filename = `Youth_Registrations_Export_${format(new Date(), "yyyy-MM-dd")}.csv`;

      // Try direct download first
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      // Also store the blob URL as fallback for iframe/preview environments
      setCsvFallbackUrl(url);
      setCsvExportCount(rows.length);

      setTimeout(() => {
        document.body.removeChild(a);
      }, 200);

      toast.success(`Export created — ${rows.length} records. If the file didn't download, use the fallback dialog.`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Export failed. Please try again.");
    }
  };


  const programs = [...new Set(registrations?.map((r) => r.child_boxing_program) || [])];
  const districts = [...new Set(registrations?.map((r) => r.child_school_district) || [])];
  // Distinct program years from the data, newest first. Drives the filter dropdown.
  const programYears = [...new Set(registrations?.map((r) => (r as any).program_year).filter(Boolean) || [])].sort().reverse();

  /* ── Archive ceremony for the prior program year ──
     Hidden until Aug 1 → Sept 30 each year. Counts how many rows in
     the prior program year are still un-archived so the button label
     can show the work clearly ("Archive 2025-26 (137 youth)") and so
     it disappears entirely once everything's been closed out. */
  const priorYear = getPriorProgramYear();
  const priorYearUnarchivedCount = registrations?.filter(
    (r) => (r as any).program_year === priorYear && !(r as any).archived_at,
  ).length ?? 0;
  const showArchiveCeremony = isArchiveWindowOpen() && priorYearUnarchivedCount > 0;

  const handleArchivePriorYear = async () => {
    setArchiving(true);
    const { data, error } = await supabase.rpc("admin_archive_program_year" as any, {
      _program_year: priorYear,
    } as any);
    setArchiving(false);
    setArchiveConfirmOpen(false);
    if (error) {
      toast.error(error.message || "Failed to archive program year.");
      return;
    }
    toast.success(`Archived ${data ?? 0} registration${data === 1 ? "" : "s"} from ${shortProgramYear(priorYear)}.`);
    queryClient.invalidateQueries({ queryKey: ["youth-registrations"] });
  };

  const toggleBaldEagle = async (reg: any) => {
    const newValue = !reg.is_bald_eagle;
    const { error } = await supabase
      .from("youth_registrations")
      .update({ is_bald_eagle: newValue })
      .eq("id", reg.id);
    if (error) {
      toast.error("Failed to update Bald Eagle status");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["youth-registrations"] });
    toast.success(newValue ? "Marked as Bald Eagle" : "Removed Bald Eagle status");
  };
  const newSubmissions = filteredRegistrations?.filter((r) => !r.approved_for_attendance) || [];
  const approvedRegistrations = filteredRegistrations?.filter((r) => r.approved_for_attendance) || [];

  const updateExtendedProgram = async (regId: string, value: string | null) => {
    const { error } = await supabase
      .from("youth_registrations")
      .update({ extended_program: value } as any)
      .eq("id", regId);
    if (error) {
      toast.error("Failed to update Extended Program");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["youth-registrations"] });
    toast.success("Extended Program updated");
  };

  const renderTable = (rows: any[], emptyMessage: string) => (
    <div className="overflow-auto max-h-[70vh]">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-black shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/70 w-12 bg-black">Photo</TableHead>
            <TableHead className="text-white/70 bg-black">Date</TableHead>
            <TableHead className="text-white/70 bg-black">Child</TableHead>
            <TableHead className="text-white/70 bg-black">Age</TableHead>
            <TableHead className="text-white/70 bg-black">Program</TableHead>
            <TableHead className="text-white/70 bg-black">Extended</TableHead>
            <TableHead className="text-white/70 bg-black">District</TableHead>
            <TableHead className="text-white/70 bg-black">Parent</TableHead>
            <TableHead className="text-white/70 w-10 text-center bg-black">🦅</TableHead>
            <TableHead className="text-white/70 bg-black">Attendance</TableHead>
            <TableHead className="text-white/70 bg-black">Alerts</TableHead>
            <TableHead className="text-right text-white/70 bg-black">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableCell colSpan={12} className="text-center py-8 text-white/40">{emptyMessage}</TableCell>
            </TableRow>
          ) : rows.map((reg) => (
            <TableRow key={reg.id} className="border-white/10 hover:bg-white/5">
              <TableCell>
                {reg.child_headshot_url ? (
                  <HeadshotThumbnail headshotPath={reg.child_headshot_url} size="sm" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs">N/A</div>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-white">
                {format(parseISO(reg.submission_date), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="font-medium text-white">
                {reg.child_last_name}, {reg.child_first_name}
              </TableCell>
              <TableCell className="text-white">
                {(() => {
                  const age = calculateAge(reg.child_date_of_birth);
                  if (typeof age === "string") return age;
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="underline decoration-dotted underline-offset-4 decoration-white/30 cursor-pointer hover:text-white/80">{age.display}</button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3 text-sm whitespace-pre-line">{age.tooltip}</PopoverContent>
                    </Popover>
                  );
                })()}
              </TableCell>
              <TableCell>
                {reg.child_boxing_program?.includes("Senior") ? (
                  <Badge variant="secondary" className="text-xs whitespace-nowrap bg-[#bf0f3e]/10 border-[#bf0f3e]/30" style={{ color: '#bf0f3e' }}>
                    Senior Boxer
                  </Badge>
                ) : reg.child_boxing_program?.includes("Grit") ? (
                  <Badge variant="secondary" className="text-xs whitespace-nowrap bg-purple-500/10 text-purple-400 border-purple-500/30">
                    Grit & Grace
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs whitespace-nowrap bg-blue-500/10 text-blue-500 border-blue-500/30">
                    Junior Boxer
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {reg.child_boxing_program === "Junior Boxing (Ages 7-10)" ? (
                  <span className="text-xs text-sky-400 font-medium">Lil Champs Corner</span>
                ) : (
                  <Select
                    value={reg.extended_program || "unassigned"}
                    onValueChange={(v) => updateExtendedProgram(reg.id, v === "unassigned" ? null : v)}
                  >
                    <SelectTrigger className="h-7 w-[140px] text-xs bg-white/5 border-white/10 text-white/70">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned"><span className="text-white/30">—</span></SelectItem>
                      {EXTENDED_PROGRAMS.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </TableCell>
              <TableCell className="text-sm text-white/70">{reg.child_school_district}</TableCell>
              <TableCell className="text-white">
                {reg.parent_first_name} {reg.parent_last_name}
              </TableCell>
              <TableCell className="text-center">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleBaldEagle(reg); }}
                  className="hover:scale-110 transition-transform"
                  title={reg.is_bald_eagle ? "Remove Bald Eagle" : "Mark as Bald Eagle"}
                >
                  <Star
                    className={`w-5 h-5 ${reg.is_bald_eagle ? "fill-amber-400 text-amber-400" : "text-white/20 hover:text-white/40"}`}
                  />
                </button>
              </TableCell>
              <TableCell>
                {reg.approved_for_attendance ? (
                  <Badge className="bg-green-500/15 text-green-500 border-green-500/30 text-xs">APPROVED</Badge>
                ) : (
                  <Badge className="bg-red-500/15 text-red-500 border-red-500/30 text-xs">REVIEW</Badge>
                )}
              </TableCell>
              <TableCell>
                {hasMedicalAlerts(reg) && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-3 h-3" /> Medical
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setDetailMode("view"); setSelectedRegistration(reg); }}
                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8 w-8 p-0"
                    title="View / Edit"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="bg-black text-white">
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Youth Registrations</h2>
          <p className="text-xs text-white/50">{filteredRegistrations?.length || 0} registrations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setBulkPhotoOpen(true)} className="bg-white/10 hover:bg-white/15 text-white border border-white/20 gap-1.5">
            <ImagePlus className="w-3.5 h-3.5" /> Sync Photos
          </Button>
          <Button size="sm" onClick={exportFilteredCsv} className="bg-white/10 hover:bg-white/15 text-white border border-white/20 gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export Filtered List
          </Button>
        </div>
        <MondayPhotoSyncModal
          open={bulkPhotoOpen}
          onOpenChange={setBulkPhotoOpen}
        />
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
              {/* Program-year filter — defaults to the current cohort so
                  the list shows today's active kids by default. Switch to
                  "All years" to see history including archived rows. */}
              {programYears.length > 0 && (
                <Select value={programYearFilter} onValueChange={setProgramYearFilter}>
                  <SelectTrigger className="w-full md:w-[180px] bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Program Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {programYears.map((y) => (
                      <SelectItem key={y} value={y as string}>
                        {shortProgramYear(y as string)}{y === getProgramYearForRegistration() ? " (current)" : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value="__all__">All years</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {/* Archive ceremony — appears Aug 1 → Sept 30 when there are
                  un-archived rows in the prior program year. One-click
                  close-out that stamps archived_at on every row. */}
              {showArchiveCeremony && (
                <Button
                  variant="outline"
                  onClick={() => setArchiveConfirmOpen(true)}
                  className="border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100 gap-1.5"
                  title={`Close out the ${shortProgramYear(priorYear)} program year`}
                >
                  <Archive className="w-4 h-4" />
                  Archive {shortProgramYear(priorYear)} ({priorYearUnarchivedCount})
                </Button>
              )}
              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger className="w-full md:w-[220px] bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Filter by program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={districtFilter} onValueChange={setDistrictFilter}>
                <SelectTrigger className="w-full md:w-[200px] bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Filter by district" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {districts.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={baldEagleFilter} onValueChange={setBaldEagleFilter}>
                <SelectTrigger className="w-full md:w-[180px] bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Bald Eagles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Youth</SelectItem>
                  <SelectItem value="yes">Bald Eagles Only</SelectItem>
                  <SelectItem value="no">Non Bald Eagles</SelectItem>
                </SelectContent>
              </Select>
              <Select value={extendedProgramFilter} onValueChange={setExtendedProgramFilter}>
                <SelectTrigger className="w-full md:w-[200px] bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Extended Program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Extended Programs</SelectItem>
                  {EXTENDED_PROGRAMS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* New Submissions */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-semibold text-white">New Submissions</h3>
            {newSubmissions.length > 0 && (
              <Badge className="bg-red-500/15 text-red-500 border-red-500/30 text-xs">{newSubmissions.length}</Badge>
            )}
          </div>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-white/50">Loading...</div>
              ) : (
                renderTable(newSubmissions, "No new submissions awaiting review.")
              )}
            </CardContent>
          </Card>
        </div>

        {/* Approved Youth Registrations */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-semibold text-white">Approved Youth Registrations</h3>
            {approvedRegistrations.length > 0 && (
              <>
                <Badge className="bg-green-500/15 text-green-500 border-green-500/30 text-xs">{approvedRegistrations.length}</Badge>
                <Badge className="bg-[#bf0f3e]/10 border-[#bf0f3e]/30 text-xs" style={{ color: '#bf0f3e' }}>
                  {approvedRegistrations.filter(r => r.child_boxing_program?.includes("Senior")).length} Senior
                </Badge>
                <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-xs">
                  {approvedRegistrations.filter(r => r.child_boxing_program?.includes("Junior")).length} Junior
                </Badge>
              </>
            )}
          </div>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-white/50">Loading...</div>
              ) : (
                renderTable(approvedRegistrations, "No approved registrations yet.")
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Combined View / Edit Dialog */}
      <Dialog
        open={!!selectedRegistration}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRegistration(null);
            setDetailMode("view");
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex flex-row items-center gap-4">
            {selectedRegistration?.child_headshot_url && (
              <HeadshotThumbnail headshotPath={selectedRegistration.child_headshot_url} size="lg" />
            )}
            <DialogTitle className="flex-1">
              {selectedRegistration?.child_first_name} {selectedRegistration?.child_last_name}
              {detailMode === "edit" && <span className="ml-2 text-sm font-normal text-amber-400">(editing)</span>}
            </DialogTitle>
            {detailMode === "view" && selectedRegistration && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDetailMode("edit")}
                className="gap-1.5 mr-6"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain pr-4">
            {selectedRegistration && detailMode === "view" && (
              <RegistrationDetail
                registration={selectedRegistration}
                onApprovalChange={async (approved: boolean) => {
                  if (!session) {
                    throw new Error("Your session expired. Please sign in again.");
                  }

                  const previousApproval = selectedRegistration.approved_for_attendance;
                  const registrationId = selectedRegistration.id;

                  setSelectedRegistration((current: any) => current ? {
                    ...current,
                    approved_for_attendance: approved,
                  } : current);
                  queryClient.setQueryData(["youth-registrations"], (current: any[] | undefined) =>
                    current?.map((registration) =>
                      registration.id === registrationId
                        ? { ...registration, approved_for_attendance: approved }
                        : registration
                    )
                  );

                  try {
                    await updateRegistrationApproval({ registrationId, approved });
                    toast.success(approved ? "Approved for attendance" : "Attendance approval removed");
                  } catch (error) {
                    setSelectedRegistration((current: any) => current && current.id === registrationId ? {
                      ...current,
                      approved_for_attendance: previousApproval,
                    } : current);
                    queryClient.setQueryData(["youth-registrations"], (current: any[] | undefined) =>
                      current?.map((registration) =>
                        registration.id === registrationId
                          ? { ...registration, approved_for_attendance: previousApproval }
                          : registration
                      )
                    );
                    throw error;
                  }
                }}
              />
            )}
            {selectedRegistration && detailMode === "edit" && (
              <EditRegistrationForm
                registration={selectedRegistration}
                onSave={async (updated) => {
                  const { id, created_at: _ca, updated_at: _ua, submission_date: _sd, ...rest } = updated;
                  const { error } = await supabase
                    .from("youth_registrations")
                    .update(rest)
                    .eq("id", id);
                  if (error) {
                    toast.error("Failed to save changes");
                  } else {
                    toast.success("Registration updated");
                    setSelectedRegistration({ ...selectedRegistration, ...rest });
                    setDetailMode("view");
                    queryClient.invalidateQueries({ queryKey: ["youth-registrations"] });
                  }
                }}
                onCancel={() => setDetailMode("view")}
                onDelete={async (id: string) => {
                  const { error } = await supabase
                    .from("youth_registrations")
                    .delete()
                    .eq("id", id);
                  if (error) {
                    toast.error("Failed to delete registration");
                  } else {
                    toast.success("Registration permanently deleted");
                    queryClient.invalidateQueries({ queryKey: ["youth-registrations"] });
                    setSelectedRegistration(null);
                    setDetailMode("view");
                  }
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV Fallback Download Dialog */}
      <Dialog open={!!csvFallbackUrl} onOpenChange={(open) => { if (!open) { if (csvFallbackUrl) URL.revokeObjectURL(csvFallbackUrl); setCsvFallbackUrl(null); setCsvExportCount(0); } }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">Export Ready</DialogTitle>
          </DialogHeader>
          <p className="text-base font-medium text-white">{csvExportCount} records prepared for download</p>
          <p className="text-sm text-white/60">Preview mode may block automatic downloads. Use one of the options below.</p>
          <div className="flex flex-col gap-2 pt-2">
            <Button asChild className="gap-2">
              <a href={csvFallbackUrl || "#"} download={`Youth_Registrations_Export_${format(new Date(), "yyyy-MM-dd")}.csv`}>
                <Download className="w-4 h-4" /> Download CSV
              </a>
            </Button>
            <Button variant="outline" className="gap-2 border-white/20 text-white hover:bg-white/10" onClick={() => { if (csvFallbackUrl) window.open(csvFallbackUrl, "_blank"); }}>
              <ExternalLink className="w-4 h-4" /> Open CSV in New Tab
            </Button>
            <Button variant="ghost" className="text-white/50 hover:text-white" onClick={() => { if (csvFallbackUrl) URL.revokeObjectURL(csvFallbackUrl); setCsvFallbackUrl(null); setCsvExportCount(0); }}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

/* ── Edit Form ── */
const EditRegistrationForm = ({
  registration,
  onSave,
  onCancel,
  onDelete,
}: {
  registration: any;
  onSave: (updated: any) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}) => {
  const [form, setForm] = useState(registration);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const set = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  const childFullName = `${form.child_first_name} ${form.child_last_name}`;

  return (
    <div className="space-y-5">
      <Section title="Child Information">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" value={form.child_first_name} onChange={(v) => set("child_first_name", v)} />
          <Field label="Last Name" value={form.child_last_name} onChange={(v) => set("child_last_name", v)} />
        </div>
        <Field label="Date of Birth" value={form.child_date_of_birth} onChange={(v) => set("child_date_of_birth", v)} type="date" />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Sex" value={form.child_sex} onChange={(v) => set("child_sex", v)} options={["Male", "Female"]} />
          <SelectField
            label="Program"
            value={form.child_boxing_program}
            onChange={(v) => set("child_boxing_program", v)}
            options={["Junior Boxing (Ages 7-10)", "Senior Boxing (Ages 11-19)", "Grit & Grace (Ages 11-19)"]}
          />
        </div>
        <Field label="Phone" value={form.child_phone || ""} onChange={(v) => set("child_phone", v)} />
        <Field label="Primary Address" value={form.child_primary_address} onChange={(v) => set("child_primary_address", v)} />
      </Section>

      <Section title="Parent/Guardian">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" value={form.parent_first_name} onChange={(v) => set("parent_first_name", v)} />
          <Field label="Last Name" value={form.parent_last_name} onChange={(v) => set("parent_last_name", v)} />
        </div>
        <Field label="Phone" value={form.parent_phone} onChange={(v) => set("parent_phone", v)} />
        <Field label="Email" value={form.parent_email} onChange={(v) => set("parent_email", v)} />
      </Section>

      <Section title="School & Demographics">
        <SelectField
          label="School District"
          value={form.child_school_district}
          onChange={(v) => set("child_school_district", v)}
          options={["Cape May City", "Cape May/West Cape May", "Lower Cape May Regional", "Lower Township", "Middle Township", "Ocean City", "Upper Township", "Wildwood", "Wildwood Crest", "North Wildwood", "Wildwood/Wildwood Crest/North Wildwood", "West Cape May", "Dennis Township", "Woodbine", "Cape May Tech", "Avalon/Stone Harbor", "Wildwood Catholic Academy", "Homeschool, Hybrid, or Alternative Form of Schooling", "Other"]}
        />
        <Field label="Grade Level" value={form.child_grade_level?.toString() || ""} onChange={(v) => set("child_grade_level", v ? parseInt(v) : null)} type="number" />
        <SelectField
          label="Race/Ethnicity"
          value={form.child_race_ethnicity}
          onChange={(v) => set("child_race_ethnicity", v)}
          options={["American Indian or Alaska Native", "Asian", "Black or African American", "Hispanic or Latino", "Native Hawaiian or Other Pacific Islander", "White", "Two or More Races"]}
        />
      </Section>

      <Section title="Household">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Adults in Household" value={form.adults_in_household?.toString() || ""} onChange={(v) => set("adults_in_household", v ? parseInt(v) : 0)} type="number" />
          <Field label="Siblings in Household" value={form.siblings_in_household?.toString() || ""} onChange={(v) => set("siblings_in_household", v ? parseInt(v) : 0)} type="number" />
        </div>
        {/* Family Structure — the text-label answer (powers the funder-facing
            Family Structure card on Attendance Intelligence). Distinct from
            the numeric Adults in Household count above. The "Not set"
            sentinel option maps to NULL in the DB; shadcn Select doesn't
            accept empty-string SelectItem values, hence the sentinel. */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Family Structure</Label>
          <Select
            value={form.family_structure || "__not_set__"}
            onValueChange={(v) => set("family_structure", v === "__not_set__" ? null : v)}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__not_set__">— Not set —</SelectItem>
              <SelectItem value="Dad and Mom">Dad and Mom</SelectItem>
              <SelectItem value="Mom Only">Mom Only</SelectItem>
              <SelectItem value="Dad Only">Dad Only</SelectItem>
              <SelectItem value="Mom + Partner">Mom + Partner</SelectItem>
              <SelectItem value="Dad + Partner">Dad + Partner</SelectItem>
              <SelectItem value="Grandparent(s)">Grandparent(s)</SelectItem>
              <SelectItem value="Single Parent Household">Single Parent Household (unspecified)</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <SelectField
          label="Household Income"
          value={form.household_income_range}
          onChange={(v) => set("household_income_range", v)}
          options={["Under $25,000", "$25,000 - $49,999", "$50,000 - $74,999", "$75,000 - $99,999", "$100,000 - $149,999", "$150,000 or more", "Less than $25,000", "Less than $35,000", "Less than $45,000", "Less than $65,000", "Less than $80,000", "Greater than $80,001"]}
        />
        <SelectField
          label="Free/Reduced Lunch"
          value={form.free_or_reduced_lunch || "Not Applicable"}
          onChange={(v) => set("free_or_reduced_lunch", v)}
          options={["Yes", "No", "Not Applicable"]}
        />
      </Section>

      <Section title="Medical">
        <Field label="Allergies" value={form.allergies || ""} onChange={(v) => set("allergies", v)} textarea />
        <Field label="Asthma/Inhaler Info" value={form.asthma_inhaler_info || ""} onChange={(v) => set("asthma_inhaler_info", v)} textarea />
        <Field label="Important Notes" value={form.important_child_notes || ""} onChange={(v) => set("important_child_notes", v)} textarea />
      </Section>

      <Section title="Status & Flags">
        {form.child_boxing_program === "Junior Boxing (Ages 7-10)" ? (
          <div className="space-y-1">
            <Label className="text-sm text-white/60">Extended Program</Label>
            <p className="text-sm text-sky-400 font-medium py-1">Lil Champs Corner (auto-assigned)</p>
          </div>
        ) : (
          <SelectField
            label="Extended Program"
            value={form.extended_program || "Unassigned"}
            onChange={(v) => set("extended_program", v === "Unassigned" ? null : v)}
            options={["Unassigned", ...EXTENDED_PROGRAMS]}
          />
        )}
        <div className="flex items-center justify-between py-2">
          <Label className="text-sm">Bald Eagle</Label>
          <Switch checked={!!form.is_bald_eagle} onCheckedChange={(v) => set("is_bald_eagle", v)} />
        </div>
        <div className="flex items-center justify-between py-2">
          <Label className="text-sm">Approved for Attendance</Label>
          <Switch checked={!!form.approved_for_attendance} onCheckedChange={(v) => set("approved_for_attendance", v)} />
        </div>
      </Section>

      <Section title="Submission Info (Read-Only)">
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex justify-between py-1 border-b border-border/50">
            <span>Submitted</span>
            <span className="text-foreground">{form.submission_date}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/50">
            <span>Registration ID</span>
            <span className="text-foreground font-mono text-xs">{form.id}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/50">
            <span>Final Signature</span>
            <span className="text-foreground">{form.final_signature_name || "—"}</span>
          </div>
        </div>
      </Section>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)}>Save Changes</Button>
      </div>

      {/* Danger Zone */}
      {onDelete && (
        <div className="mt-12 pt-6 border-t-2 border-destructive/30">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Delete this youth registration permanently. This action cannot be undone.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setDeleteConfirmOpen(true); setDeleteInput(""); }}
              className="gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Registration
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Permanently Delete Registration
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to permanently delete this youth registration?
                  This action <strong>cannot be undone</strong>.
                </p>
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm">
                  You are deleting: <strong className="text-destructive">{childFullName}</strong>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type <strong>DELETE</strong> to confirm:</Label>
                  <Input
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="DELETE"
                    className="font-mono"
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteInput("")}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteInput !== "DELETE"}
              onClick={() => {
                onDelete(form.id);
                setDeleteConfirmOpen(false);
              }}
            >
              Permanently Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Program Year Confirmation */}
      <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-400" /> Archive {shortProgramYear(priorYear)} Program Year?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  This closes out the <span className="font-bold">{shortProgramYear(priorYear)}</span> program year by stamping every still-active row with an archive date.
                </p>
                <div className="rounded-lg bg-amber-500/[0.08] border border-amber-400/30 px-3 py-2.5 text-xs space-y-1">
                  <p className="font-bold text-amber-200 mb-1">What happens:</p>
                  <ul className="space-y-0.5 pl-1">
                    <li>• <span className="font-bold">{priorYearUnarchivedCount}</span> registration{priorYearUnarchivedCount === 1 ? "" : "s"} archived</li>
                    <li>• All attendance history stays intact</li>
                    <li>• Archived rows still show via the "All years" filter</li>
                    <li>• Reversible via SQL if needed (no automatic undo button)</li>
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">
                  Run this once you've confirmed everyone who's returning for the new program year has re-registered.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <Button
              onClick={handleArchivePriorYear}
              disabled={archiving}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              <Archive className="w-4 h-4" />
              {archiving ? "Archiving…" : `Archive ${priorYearUnarchivedCount} row${priorYearUnarchivedCount === 1 ? "" : "s"}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/* ── Reusable form fields ── */
const Field = ({
  label, value, onChange, type = "text", textarea = false,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; textarea?: boolean;
}) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {textarea ? (
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="text-sm" rows={2} />
    ) : (
      <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="text-sm" />
    )}
  </div>
);

const SelectField = ({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

/* ── View Detail ── */
const RegistrationDetail = ({ registration: reg, onApprovalChange }: { registration: any; onApprovalChange: (approved: boolean) => void }) => {
  const ageYears = differenceInYears(new Date(), parseISO(reg.child_date_of_birth));
  const ageMonths = differenceInMonths(new Date(), parseISO(reg.child_date_of_birth)) - ageYears * 12;
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(true);
  const [isSavingApproval, setIsSavingApproval] = useState(false);

  useEffect(() => {
    const generateSignedUrls = async () => {
      const urlFields = [
        { key: 'medical_consent_signature_url', value: reg.medical_consent_signature_url },
        { key: 'liability_waiver_signature_url', value: reg.liability_waiver_signature_url },
        { key: 'transportation_excursions_signature_url', value: reg.transportation_excursions_signature_url },
        { key: 'media_consent_signature_url', value: reg.media_consent_signature_url },
        { key: 'spiritual_development_policy_signature_url', value: reg.spiritual_development_policy_signature_url },
        { key: 'counseling_services_signature_url', value: reg.counseling_services_signature_url },
      ].filter(f => f.value);

      const urls: Record<string, string> = {};
      
      for (const field of urlFields) {
        const filePath = field.value.includes('registration-signatures/') 
          ? field.value.split('registration-signatures/').pop() 
          : field.value;
        
        const { data } = await supabase.storage
          .from('registration-signatures')
          .createSignedUrl(filePath, 3600);
        
        if (data?.signedUrl) {
          urls[field.key] = data.signedUrl;
        }
      }
      
      setSignedUrls(urls);
      setLoadingUrls(false);
    };

    generateSignedUrls();
  }, [reg]);

  const handleApprovalSelection = async (approved: boolean) => {
    if (isSavingApproval || approved === !!reg.approved_for_attendance) return;

    setIsSavingApproval(true);
    try {
      await onApprovalChange(approved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update approval status");
    } finally {
      setIsSavingApproval(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Attendance Approval Toggle */}
      <Card className={`border ${reg.approved_for_attendance ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
        <CardContent className="py-4 px-4">
          <div className="space-y-4 select-none">
            <div className="flex min-w-0 items-start gap-3">
              <ShieldCheck className={`mt-0.5 w-5 h-5 shrink-0 ${reg.approved_for_attendance ? 'text-green-500' : 'text-amber-500'}`} />
              <div>
                <p className="font-medium text-sm">Attendance Approval</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {reg.approved_for_attendance ? "✅ This youth will appear in the kiosk check-in." : "⚠️ This youth will NOT appear in the kiosk until approved."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={reg.approved_for_attendance ? "default" : "outline"}
                disabled={isSavingApproval}
                onClick={() => handleApprovalSelection(true)}
                className="min-h-12 justify-start text-left whitespace-normal"
              >
                {isSavingApproval && reg.approved_for_attendance ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Approve for check-in
              </Button>
              <Button
                type="button"
                variant={!reg.approved_for_attendance ? "secondary" : "outline"}
                disabled={isSavingApproval}
                onClick={() => handleApprovalSelection(false)}
                className="min-h-12 justify-start text-left whitespace-normal"
              >
                {isSavingApproval && !reg.approved_for_attendance ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Keep unapproved
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {(reg.allergies || reg.asthma_inhaler_info) && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive flex items-center gap-2 text-base">
              <AlertTriangle className="w-5 h-5" /> Medical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {reg.allergies && <div><strong>Allergies:</strong> {reg.allergies}</div>}
            {reg.asthma_inhaler_info && <div><strong>Asthma/Inhaler:</strong> {reg.asthma_inhaler_info}</div>}
          </CardContent>
        </Card>
      )}

      <Section title="Child Information">
        <InfoRow label="Name" value={`${reg.child_first_name} ${reg.child_last_name}`} />
        <InfoRow label="Age" value={`${ageYears} years ${ageMonths} months`} />
        <InfoRow label="Date of Birth" value={format(parseISO(reg.child_date_of_birth), "MMMM d, yyyy")} />
        <InfoRow label="Sex" value={reg.child_sex} />
        <InfoRow label="Race/Ethnicity" value={reg.child_race_ethnicity} />
        <InfoRow label="Child's Phone" value={reg.child_phone || "—"} />
      </Section>

      <Section title="Parent/Guardian">
        <InfoRow label="Name" value={`${reg.parent_first_name} ${reg.parent_last_name}`} />
        <InfoRow label="Phone" value={reg.parent_phone} />
        <InfoRow label="Email" value={reg.parent_email} />
      </Section>

      <Section title="Address & School">
        <InfoRow label="Address" value={reg.child_primary_address} />
        <InfoRow label="School District" value={reg.child_school_district} />
        <InfoRow label="Grade Level" value={reg.child_grade_level ?? "—"} />
      </Section>

      <Section title="Program & Household">
        <InfoRow label="Boxing Program" value={reg.child_boxing_program} />
        <InfoRow label="Extended Program" value={(reg as any).extended_program || "Unassigned"} />
        <InfoRow label="Adults in Household" value={reg.adults_in_household} />
        <InfoRow label="Family Structure" value={(reg as any).family_structure || "— Not set —"} />
        <InfoRow label="Siblings in Household" value={reg.siblings_in_household} />
      </Section>

      <Section title="Funding Information">
        <InfoRow label="Household Income" value={reg.household_income_range} />
        <InfoRow label="Free/Reduced Lunch" value={reg.free_or_reduced_lunch || "Not Applicable"} />
      </Section>

      <Section title="Medical & Notes">
        <InfoRow label="Allergies" value={reg.allergies || "None reported"} />
        <InfoRow label="Asthma / Inhaler" value={reg.asthma_inhaler_info || "None reported"} />
        <InfoRow label="Important Notes" value={reg.important_child_notes || "None"} />
      </Section>

      <Section title="Status & Flags">
        <InfoRow label="Approved for Attendance" value={reg.approved_for_attendance ? "Yes" : "No"} />
        <InfoRow label="Bald Eagle" value={reg.is_bald_eagle ? "Yes" : "No"} />
      </Section>

      <Section title="Waivers & Signatures">
        {loadingUrls ? (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading signatures...
          </div>
        ) : (
          <>
            <SignatureRow label="Medical Consent" name={reg.medical_consent_name} url={signedUrls.medical_consent_signature_url} completed={!!reg.medical_consent_name} />
            <SignatureRow label="Liability Waiver" name={reg.liability_waiver_name} url={signedUrls.liability_waiver_signature_url} completed={!!reg.liability_waiver_name} />
            <SignatureRow label="Transportation/Excursions" name={reg.transportation_excursions_waiver_name} url={signedUrls.transportation_excursions_signature_url} completed={!!reg.transportation_excursions_waiver_name} />
            <SignatureRow label="Media Consent" name={reg.media_consent_name} url={signedUrls.media_consent_signature_url} completed={!!reg.media_consent_name} />
            <SignatureRow label="Spiritual Development" name={reg.spiritual_development_policy_name} url={signedUrls.spiritual_development_policy_signature_url} completed={!!reg.spiritual_development_policy_name} />
            <SignatureRow label="Counseling Services" name={reg.counseling_services_name || ""} url={signedUrls.counseling_services_signature_url} completed={!!reg.counseling_services_name} />
          </>
        )}
      </Section>

      <Section title="Final Verification">
        <InfoRow label="Final Signature" value={reg.final_signature_name || "Not provided"} />
        <div className="flex items-center justify-between text-sm py-2 border-b border-border/50">
          <span className="text-muted-foreground">Headshot Uploaded</span>
          {reg.child_headshot_url ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-destructive" />
          )}
        </div>
      </Section>

      {reg.child_headshot_url && (
        <Section title="Child Photo">
          <HeadshotThumbnail headshotPath={reg.child_headshot_url} size="lg" />
        </Section>
      )}

      <Section title="Submission">
        <InfoRow label="Submitted On" value={format(parseISO(reg.submission_date), "MMMM d, yyyy")} />
        <InfoRow label="Program Year" value={(reg as any).program_year || "—"} />
        {(reg as any).archived_at && (
          <InfoRow label="Archived On" value={format(parseISO((reg as any).archived_at), "MMMM d, yyyy")} />
        )}
        <InfoRow label="Registration ID" value={reg.id} />
        {reg.final_signature_name && <InfoRow label="Final Signature Name" value={reg.final_signature_name} />}
      </Section>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">{title}</h3>
    <div className="space-y-1">{children}</div>
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between text-sm py-1 border-b border-border/50">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{value}</span>
  </div>
);

const SignatureRow = ({ label, name, url, completed }: { label: string; name: string; url?: string; completed?: boolean }) => (
  <div className="flex items-center justify-between text-sm py-2 border-b border-border/50">
    <div className="flex items-center gap-2">
      {completed ? (
        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-destructive shrink-0" />
      )}
      <span className="text-muted-foreground">{label}</span>
      {name && <span className="font-medium">({name})</span>}
    </div>
    {url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline flex items-center gap-1"
      >
        View <ExternalLink className="w-3 h-3" />
      </a>
    ) : (
      <span className="text-muted-foreground text-xs">{completed ? "Signed" : "Not completed"}</span>
    )}
  </div>
);

export default AdminRegistrations;
