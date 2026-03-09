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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Eye, AlertTriangle, ExternalLink, Loader2, Pencil, Trash2, CheckCircle2, XCircle, ShieldCheck, Download, Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format, parseISO, differenceInYears, differenceInMonths } from "date-fns";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const HeadshotThumbnail = ({ headshotPath, size = "sm" }: { headshotPath: string; size?: "sm" | "lg" }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  
  useEffect(() => {
    // Check if this is a public youth-photos URL or a signed URL from registration-signatures
    if (headshotPath.includes('youth-photos')) {
      // Public URL - use directly
      const publicUrl = headshotPath.startsWith("http")
        ? headshotPath
        : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/youth-photos/${headshotPath.replace('youth-photos/', '')}`;
      setUrl(publicUrl);
    } else {
      // Private signature URL - create signed URL
      supabase.storage.from("registration-signatures").createSignedUrl(headshotPath, 300)
        .then(({ data }) => {
          const rawSignedUrl = (data as { signedUrl?: string; signedURL?: string } | null)?.signedUrl
            ?? (data as { signedUrl?: string; signedURL?: string } | null)?.signedURL;
          if (!rawSignedUrl) return;

          const signedUrl = rawSignedUrl.startsWith("http")
            ? rawSignedUrl
            : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1${rawSignedUrl}`;
          setUrl(signedUrl);
        });
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

const AdminRegistrations = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [baldEagleFilter, setBaldEagleFilter] = useState<string>("all");
  const [selectedRegistration, setSelectedRegistration] = useState<any | null>(null);
  const [editingRegistration, setEditingRegistration] = useState<any | null>(null);
  const [csvFallbackUrl, setCsvFallbackUrl] = useState<string | null>(null);
  const [csvExportCount, setCsvExportCount] = useState(0);

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

      return matchesSearch && matchesProgram && matchesDistrict && matchesBaldEagle;
    })
    .sort((a, b) => {
      // Sort alphabetically by last name, then first name
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
    const headers = ["Child Name", "Date of Birth", "Age", "Program", "District", "Parent Name", "Parent Email", "Parent Phone", "Bald Eagle", "Medical Alert", "Registration Date", "Attendance Status"];
    const csvRows = rows.map((r: any) => {
      const age = calculateAge(r.child_date_of_birth);
      const ageStr = typeof age === "string" ? age : age.tooltip.split("\n")[0];
      const medical = hasMedicalAlerts(r) ? "Yes" : "No";
      return [
        `${r.child_first_name || ""} ${r.child_last_name || ""}`.trim(),
        r.child_date_of_birth ? format(parseISO(r.child_date_of_birth), "MM/dd/yyyy") : "",
        ageStr,
        r.child_boxing_program || "",
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

  const renderTable = (rows: any[], emptyMessage: string) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/70 w-12">Photo</TableHead>
            <TableHead className="text-white/70">Date</TableHead>
            <TableHead className="text-white/70">Child</TableHead>
            <TableHead className="text-white/70">Age</TableHead>
            <TableHead className="text-white/70">Program</TableHead>
            <TableHead className="text-white/70">District</TableHead>
            <TableHead className="text-white/70">Parent</TableHead>
            <TableHead className="text-white/70 w-10 text-center">🦅</TableHead>
            <TableHead className="text-white/70">Attendance</TableHead>
            <TableHead className="text-white/70">Alerts</TableHead>
            <TableHead className="text-right text-white/70">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableCell colSpan={11} className="text-center py-8 text-white/40">{emptyMessage}</TableCell>
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
                ) : (
                  <Badge variant="secondary" className="text-xs whitespace-nowrap bg-blue-500/10 text-blue-500 border-blue-500/30">
                    Junior Boxer
                  </Badge>
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
                  <Button size="sm" variant="ghost" onClick={() => setSelectedRegistration(reg)} className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8 w-8 p-0" title="View">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingRegistration({ ...reg })} className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-8 w-8 p-0" title="Edit">
                    <Pencil className="w-4 h-4" />
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
        <div>
          <Button size="sm" onClick={exportFilteredCsv} className="bg-white/10 hover:bg-white/15 text-white border border-white/20 gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export Filtered List
          </Button>
        </div>
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

      {/* View Detail Dialog */}
      <Dialog open={!!selectedRegistration} onOpenChange={() => setSelectedRegistration(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex flex-row items-center gap-4">
            {selectedRegistration?.child_headshot_url && (
              <HeadshotThumbnail headshotPath={selectedRegistration.child_headshot_url} size="lg" />
            )}
            <DialogTitle>
              {selectedRegistration?.child_first_name} {selectedRegistration?.child_last_name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 overflow-auto pr-4">
            {selectedRegistration && (
              <RegistrationDetail
                registration={selectedRegistration}
                onApprovalChange={async (approved: boolean) => {
                  const { error } = await supabase
                    .from("youth_registrations")
                    .update({ approved_for_attendance: approved })
                    .eq("id", selectedRegistration.id);
                  if (error) {
                    toast.error("Failed to update approval status");
                  } else {
                    toast.success(approved ? "Approved for attendance" : "Attendance approval removed");
                    setSelectedRegistration({ ...selectedRegistration, approved_for_attendance: approved });
                    queryClient.invalidateQueries({ queryKey: ["youth-registrations"] });
                  }
                }}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingRegistration} onOpenChange={() => setEditingRegistration(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Registration</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 overflow-auto pr-4">
            {editingRegistration && (
              <EditRegistrationForm
                registration={editingRegistration}
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
                    queryClient.invalidateQueries({ queryKey: ["youth-registrations"] });
                    setEditingRegistration(null);
                  }
                }}
                onCancel={() => setEditingRegistration(null)}
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
                    setEditingRegistration(null);
                  }
                }}
              />
            )}
          </ScrollArea>
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

  useEffect(() => {
    const generateSignedUrls = async () => {
      const urlFields = [
        { key: 'medical_consent_signature_url', value: reg.medical_consent_signature_url },
        { key: 'liability_waiver_signature_url', value: reg.liability_waiver_signature_url },
        { key: 'transportation_excursions_signature_url', value: reg.transportation_excursions_signature_url },
        { key: 'media_consent_signature_url', value: reg.media_consent_signature_url },
        { key: 'spiritual_development_policy_signature_url', value: reg.spiritual_development_policy_signature_url },
        { key: 'counseling_services_signature_url', value: reg.counseling_services_signature_url },
        { key: 'child_headshot_url', value: reg.child_headshot_url },
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

  return (
    <div className="space-y-6">
      {/* Attendance Approval Toggle */}
      <Card className={`border ${reg.approved_for_attendance ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
        <CardContent className="flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className={`w-5 h-5 ${reg.approved_for_attendance ? 'text-green-500' : 'text-amber-500'}`} />
            <div>
              <p className="font-medium text-sm">Approved for Attendance</p>
              <p className="text-xs text-muted-foreground">
                {reg.approved_for_attendance ? "This youth will appear in the kiosk check-in." : "This youth will NOT appear in the kiosk until approved."}
              </p>
            </div>
          </div>
          <Switch
            checked={!!reg.approved_for_attendance}
            onCheckedChange={onApprovalChange}
          />
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
      </Section>

      <Section title="Parent/Guardian">
        <InfoRow label="Name" value={`${reg.parent_first_name} ${reg.parent_last_name}`} />
        <InfoRow label="Phone" value={reg.parent_phone} />
        <InfoRow label="Email" value={reg.parent_email} />
        {reg.child_phone && <InfoRow label="Child's Phone" value={reg.child_phone} />}
      </Section>

      <Section title="Address & School">
        <InfoRow label="Address" value={reg.child_primary_address} />
        <InfoRow label="School District" value={reg.child_school_district} />
        {reg.child_grade_level && <InfoRow label="Grade Level" value={reg.child_grade_level} />}
      </Section>

      <Section title="Program & Household">
        <InfoRow label="Boxing Program" value={reg.child_boxing_program} />
        <InfoRow label="Adults in Household" value={reg.adults_in_household} />
        <InfoRow label="Siblings in Household" value={reg.siblings_in_household} />
      </Section>

      <Section title="Funding Information">
        <InfoRow label="Household Income" value={reg.household_income_range} />
        {reg.free_or_reduced_lunch && <InfoRow label="Free/Reduced Lunch" value={reg.free_or_reduced_lunch} />}
      </Section>

      {reg.important_child_notes && (
        <Section title="Coach Notes">
          <p className="text-sm">{reg.important_child_notes}</p>
        </Section>
      )}

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
          {loadingUrls ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading photo...
            </div>
          ) : signedUrls.child_headshot_url ? (
            <HeadshotThumbnail headshotPath={reg.child_headshot_url} size="lg" />
          ) : (
            <p className="text-sm text-muted-foreground">Unable to load photo</p>
          )}
        </Section>
      )}

      <Section title="Submission">
        <InfoRow label="Submitted On" value={format(parseISO(reg.submission_date), "MMMM d, yyyy")} />
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
