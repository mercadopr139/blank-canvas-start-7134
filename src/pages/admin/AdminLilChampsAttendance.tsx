import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

interface LilChampsRecord {
  id: string;
  check_in_date: string;
  check_in_at: string;
  child_first_name: string;
  child_last_name: string;
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

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("attendance_records")
      .select("id, check_in_date, check_in_at, registration_id, youth_registrations!inner(child_first_name, child_last_name, child_date_of_birth)")
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
            /* Mobile card layout */
            <div className="divide-y divide-white/10 px-4 pb-4">
              {filtered.map((r) => (
                <div key={r.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{r.child_last_name}, {r.child_first_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>Lil Champs</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-white/60">
                    <span>Age {calculateAge(r.child_date_of_birth)}</span>
                    <span>{r.check_in_date}</span>
                    <span>{format(new Date(r.check_in_at), "h:mm a")}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Desktop table layout */
            <div className="max-h-[65vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-black">
                  <TableRow>
                    <TableHead className="text-white/70">Name</TableHead>
                    <TableHead className="text-white/70">Age</TableHead>
                    <TableHead className="text-white/70">Date</TableHead>
                    <TableHead className="text-white/70">Time</TableHead>
                    <TableHead className="text-white/70">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-white">{r.child_last_name}, {r.child_first_name}</TableCell>
                      <TableCell className="text-white/70">{calculateAge(r.child_date_of_birth)}</TableCell>
                      <TableCell className="text-white/70">{r.check_in_date}</TableCell>
                      <TableCell className="text-white/70">{format(new Date(r.check_in_at), "h:mm a")}</TableCell>
                      <TableCell><span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>Lil Champs Corner</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLilChampsAttendance;
