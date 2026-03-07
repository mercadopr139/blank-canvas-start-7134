import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Star, Search, AlertTriangle, Users, Eye } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { startOfWeek, startOfMonth, format, differenceInCalendarDays } from "date-fns";
import { toast } from "sonner";

interface Registration {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string;
  child_headshot_url: string | null;
  is_bald_eagle: boolean;
}

interface AttendanceRecord {
  id: string;
  registration_id: string;
  check_in_date: string;
  check_in_at: string;
}

const today = new Date();
const todayStr = today.toISOString().split("T")[0];
const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
const monthStart = format(startOfMonth(today), "yyyy-MM-dd");

const AdminAttendance = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "bald-eagles">("all");
  const [selectedYouth, setSelectedYouth] = useState<Registration | null>(null);

  const { data: registrations = [] } = useQuery({
    queryKey: ["registrations-attendance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, child_boxing_program, child_headshot_url, is_bald_eagle")
        .order("child_last_name");
      if (error) throw error;
      return data as Registration[];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, registration_id, check_in_date, check_in_at")
        .gte("check_in_date", monthStart)
        .order("check_in_date", { ascending: false });
      if (error) throw error;
      return data as AttendanceRecord[];
    },
  });

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
    const weekCount = records.filter((r) => r.check_in_date >= weekStart).length;
    const monthCount = records.length;
    const lastDate = records.length > 0 ? records[0].check_in_date : null;
    return { present: todayCount > 0, weekCount, monthCount, lastDate };
  };

  const baldEagles = registrations.filter((r) => r.is_bald_eagle);
  const baldEaglesPresent = baldEagles.filter((r) => getStats(r.id).present).length;
  const baldEaglesMonth = baldEagles.reduce((sum, r) => sum + getStats(r.id).monthCount, 0);

  // Alerts: Bald Eagles with no attendance for 7+ days
  const alerts = baldEagles
    .map((r) => {
      const stats = getStats(r.id);
      if (!stats.lastDate) return { ...r, daysSince: 999, lastDate: "Never" };
      const days = differenceInCalendarDays(today, new Date(stats.lastDate));
      if (days >= 7) return { ...r, daysSince: days, lastDate: stats.lastDate };
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => (b?.daysSince || 0) - (a?.daysSince || 0)) as (Registration & { daysSince: number; lastDate: string })[];

  const filtered = registrations
    .filter((r) => filter === "all" || r.is_bald_eagle)
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
    // Refetch will happen via queryKey invalidation on next render
    window.location.reload();
  };

  const totalPresent = registrations.filter((r) => getStats(r.id).present).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white/50">Present Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalPresent}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/30 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-400">🦅 Bald Eagles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-400">{baldEagles.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-400">🦅 Present Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-400">{baldEaglesPresent}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white/50">🦅 This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{baldEaglesMonth}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bald Eagles Attendance Alerts */}
      {alerts.length > 0 && (
        <Card className="bg-red-500/5 border-red-500/30 text-white">
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
                    <TableRow key={a.id} className="border-white/10">
                      <TableCell>
                        <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
                          {a.child_headshot_url ? (
                            <img src={a.child_headshot_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="flex items-center justify-center w-full h-full text-xs text-white/40">
                              {a.child_first_name[0]}
                            </span>
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

      {/* Bald Eagles Watch List */}
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
                            {r.child_headshot_url ? (
                              <img src={r.child_headshot_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="flex items-center justify-center w-full h-full text-xs text-white/40">
                                {r.child_first_name[0]}
                              </span>
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

      {/* Full Attendance Table */}
      <Card className="bg-white/5 border-white/10 text-white">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" /> Daily Attendance
            </CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="pl-9 bg-white/5 border-white/20 text-white placeholder:text-white/30 h-9"
                />
              </div>
              <Select value={filter} onValueChange={(v: "all" | "bald-eagles") => setFilter(v)}>
                <SelectTrigger className="w-40 bg-white/5 border-white/20 text-white h-9">
                  <SelectValue />
                </SelectTrigger>
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
                      <TableCell className="text-white font-medium">
                        {r.child_first_name} {r.child_last_name}
                      </TableCell>
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
                    {selectedYouth.child_headshot_url ? (
                      <img src={selectedYouth.child_headshot_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full text-lg text-white/40">
                        {selectedYouth.child_first_name[0]}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-lg text-white">
                      {selectedYouth.child_first_name} {selectedYouth.child_last_name}
                    </p>
                    <p className="text-sm text-white/50 font-normal">{selectedYouth.child_boxing_program}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Bald Eagle Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-sm font-medium">Bald Eagle Status</span>
                  <button
                    onClick={() => toggleBaldEagle(selectedYouth)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <Star className={`w-4 h-4 ${selectedYouth.is_bald_eagle ? "fill-amber-400 text-amber-400" : "text-white/20"}`} />
                    <span className="text-sm">{selectedYouth.is_bald_eagle ? "Bald Eagle" : "Not Starred"}</span>
                  </button>
                </div>

                {/* Quick Stats */}
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

                {/* Full Attendance History */}
                <div>
                  <h4 className="text-sm font-medium text-white/60 mb-2">Attendance History</h4>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {allAttendance.length === 0 ? (
                      <p className="text-sm text-white/30">No attendance records</p>
                    ) : (
                      allAttendance.map((a) => (
                        <div key={a.id} className="flex justify-between p-2 rounded bg-white/5 text-sm">
                          <span>{format(new Date(a.check_in_date), "EEEE, MMM d, yyyy")}</span>
                          <span className="text-white/40">{format(new Date(a.check_in_at), "h:mm a")}</span>
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
    </div>
  );
};

export default AdminAttendance;
