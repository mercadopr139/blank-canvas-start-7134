import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Download, Calendar, UserPlus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

interface LilChampsRecord {
  id: string;
  check_in_date: string;
  check_in_at: string;
  child_first_name: string;
  child_last_name: string;
  child_date_of_birth: string;
  is_manual: boolean;
}

interface SearchResult {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_headshot_url: string | null;
  child_date_of_birth: string;
}

const calculateAge = (dob: string): number => {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const AdminLilChampsAttendance = () => {
  const [records, setRecords] = useState<LilChampsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Manual add state
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [allLilChampsYouth, setAllLilChampsYouth] = useState<SearchResult[]>([]);

  // Load all Lil Champs youth when modal opens
  useEffect(() => {
    if (!addOpen) return;
    const fetchAll = async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, child_headshot_url, child_date_of_birth")
        .or("child_boxing_program.eq.Junior Boxing (Ages 7-10),extended_program.eq.Lil Champs Corner")
        .eq("approved_for_attendance", true)
        .order("child_last_name")
        .limit(200);
      if (error) console.error("Lil Champs youth fetch error:", error);
      setAllLilChampsYouth(data || []);
    };
    fetchAll();
  }, [addOpen]);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("attendance_records")
      .select("id, check_in_date, check_in_at, registration_id, is_manual, youth_registrations!inner(child_first_name, child_last_name, child_date_of_birth)")
      .eq("program_source", "Lil Champs Corner")
      .order("check_in_at", { ascending: false })
      .limit(500);

    if (!error && data) {
      setRecords(
        data.map((r: any) => ({
          id: r.id,
          check_in_date: r.check_in_date,
          check_in_at: r.check_in_at,
          child_first_name: r.youth_registrations.child_first_name,
          child_last_name: r.youth_registrations.child_last_name,
          child_date_of_birth: r.youth_registrations.child_date_of_birth,
          is_manual: r.is_manual,
        }))
      );
    }
    setLoading(false);
  };

  const filtered = records.filter((r) => {
    const name = `${r.child_first_name} ${r.child_last_name}`.toLowerCase();
    const matchesSearch = !search || name.includes(search.toLowerCase());
    const matchesDate = !dateFilter || r.check_in_date === dateFilter;
    return matchesSearch && matchesDate;
  });

  const exportCsv = () => {
    const header = "Name,Age,Date,Time,Program Source";
    const rows = filtered.map((r) => {
      const name = `${r.child_last_name}, ${r.child_first_name}`;
      const age = calculateAge(r.child_date_of_birth);
      const date = r.check_in_date;
      const time = format(new Date(r.check_in_at), "h:mm a");
      return `"${name}",${age},${date},${time},Lil Champs Corner`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lil-champs-attendance-${dateFilter || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Search for youth to manually add — filters the pre-loaded list client-side
  const handleAddSearch = (query: string) => {
    setAddSearch(query);
  };

  // Compute displayed youth: if searching, filter; otherwise show all
  const displayedAddYouth = (() => {
    const q = addSearch.trim().toLowerCase();
    if (!q) return allLilChampsYouth;
    return allLilChampsYouth.filter((y) => {
      const full = `${y.child_first_name} ${y.child_last_name}`.toLowerCase();
      return full.includes(q);
    });
  })();

  const handleManualAdd = async (youth: SearchResult) => {
    const targetDate = dateFilter || format(new Date(), "yyyy-MM-dd");

    // Check for duplicate
    const existing = records.find(
      (r) =>
        r.check_in_date === targetDate &&
        r.child_first_name === youth.child_first_name &&
        r.child_last_name === youth.child_last_name
    );
    if (existing) {
      toast({ title: "This youth already has a check-in for this date", variant: "destructive" });
      return;
    }

    setAdding(true);
    const checkInAt = new Date(targetDate + "T17:15:00").toISOString();
    const { error } = await supabase.from("attendance_records").insert({
      registration_id: youth.id,
      check_in_date: targetDate,
      check_in_at: checkInAt,
      program_source: "Lil Champs Corner",
      is_manual: true,
    });

    if (error) {
      toast({ title: "Failed to add check-in", variant: "destructive" });
    } else {
      toast({ title: `${youth.child_first_name} ${youth.child_last_name} checked in` });
      setAddOpen(false);
      setAddSearch("");
      await fetchRecords();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("attendance_records").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", variant: "destructive" });
    } else {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Check-in removed" });
    }
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl md:text-2xl font-bold text-white">Lil Champ's Corner Attendance</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!confirm("Delete ALL Lil Champs Corner attendance records? This cannot be undone.")) return;
              const { error } = await supabase
                .from("attendance_records")
                .delete()
                .eq("program_source", "Lil Champs Corner");
              if (error) { alert("Failed to clear: " + error.message); return; }
              setRecords([]);
            }}
            className="gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10"
          >
            Clear All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
            className="gap-2 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
          >
            <UserPlus className="w-4 h-4" /> Add Youth
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2 text-foreground">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="pl-9 w-full sm:w-[180px] text-foreground"
          />
        </div>
      </div>

      <Card className="bg-white/[0.03] border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-white/60">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-center py-8 text-white/40">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-white/40">No records found</p>
          ) : isMobile ? (
            <div className="divide-y divide-white/10 px-4 pb-4">
              {filtered.map((r) => (
                <div key={r.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{r.child_last_name}, {r.child_first_name}</span>
                      {r.is_manual && (
                        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">Manual</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>Lil Champs</span>
                      {r.is_manual && (
                        <button onClick={() => setDeleteConfirmId(r.id)} className="text-white/30 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-white/60">
                    <span>Age {calculateAge(r.child_date_of_birth)}</span>
                    <span>{r.check_in_date}</span>
                    <span className={r.is_manual ? "text-amber-400" : ""}>{format(new Date(r.check_in_at), "h:mm a")}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="max-h-[65vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-black">
                  <TableRow>
                    <TableHead className="text-white/70">Name</TableHead>
                    <TableHead className="text-white/70">Age</TableHead>
                    <TableHead className="text-white/70">Date</TableHead>
                    <TableHead className="text-white/70">Time</TableHead>
                    <TableHead className="text-white/70">Source</TableHead>
                    <TableHead className="text-white/70 w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-white">
                        <div className="flex items-center gap-2">
                          {r.child_last_name}, {r.child_first_name}
                          {r.is_manual && (
                            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0">Manual</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-white/70">{calculateAge(r.child_date_of_birth)}</TableCell>
                      <TableCell className="text-white/70">{r.check_in_date}</TableCell>
                      <TableCell className={r.is_manual ? "text-amber-400" : "text-white/70"}>{format(new Date(r.check_in_at), "h:mm a")}</TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>Lil Champs Corner</span>
                      </TableCell>
                      <TableCell>
                        {r.is_manual && (
                          <button onClick={() => setDeleteConfirmId(r.id)} className="text-white/30 hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Add Youth Modal */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setAddSearch(""); } }}>
        <DialogContent className="bg-[#111827] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Add Youth Check-In</DialogTitle>
          </DialogHeader>
          <p className="text-white/50 text-sm">
            {addSearch.trim() ? "Select a youth to add a manual check-in" : "Browse all Lil Champs youth or search by name"}
            {dateFilter ? ` for ${dateFilter}` : " for today"}.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              value={addSearch}
              onChange={(e) => handleAddSearch(e.target.value)}
              placeholder="Search by name or browse below..."
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              autoFocus
            />
          </div>

          {displayedAddYouth.length > 0 ? (
            <ul className="space-y-1 max-h-60 overflow-y-auto">
              {displayedAddYouth.map((y) => (
                <li
                  key={y.id}
                  onClick={() => !adding && handleManualAdd(y)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                    {y.child_headshot_url ? (
                      <img src={y.child_headshot_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white/30 text-xs font-bold">
                        {y.child_first_name[0]}{y.child_last_name[0]}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {y.child_first_name} {y.child_last_name}
                      {y.child_date_of_birth && (
                        <span className="text-white/40 ml-1">· Age {calculateAge(y.child_date_of_birth)}</span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-white/40 text-sm text-center py-2">No matching youth found.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <DialogContent className="bg-[#111827] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Manual Check-In</DialogTitle>
          </DialogHeader>
          <p className="text-white/60 text-sm">Are you sure you want to remove this manual check-in? This cannot be undone.</p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)} className="border-white/20 text-white/70">Cancel</Button>
            <Button size="sm" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-red-600 hover:bg-red-700 text-white">Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLilChampsAttendance;
