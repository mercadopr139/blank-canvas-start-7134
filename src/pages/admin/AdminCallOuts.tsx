import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Star, Search, CheckCircle2, XCircle, Clock, Users, TrendingUp, ChevronLeft, ChevronRight, Eye,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO } from "date-fns";

interface Callout {
  id: string;
  first_name: string;
  last_name: string;
  date: string;
  reason: string;
  is_bald_eagle: boolean;
  is_acceptable: boolean | null;
  created_at: string;
}

const AdminCallOuts = () => {
  const qc = useQueryClient();
  const [viewMonth, setViewMonth] = useState(new Date());
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
  const [viewMode, setViewMode] = useState<"day" | "month">("day");
  const [historyYouth, setHistoryYouth] = useState<{ first: string; last: string } | null>(null);
  const [search, setSearch] = useState("");

  const monthStart = format(startOfMonth(viewMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(viewMonth), "yyyy-MM-dd");

  // Fetch callouts for the month
  const { data: callouts = [] } = useQuery({
    queryKey: ["callouts", monthStart, monthEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("callouts" as any)
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("created_at", { ascending: false });
      return (data || []) as unknown as Callout[];
    },
  });

  // Fetch youth history if viewing
  const { data: youthHistory = [] } = useQuery({
    queryKey: ["callout-history", historyYouth?.first, historyYouth?.last],
    enabled: !!historyYouth,
    queryFn: async () => {
      if (!historyYouth) return [];
      const { data } = await supabase
        .from("callouts" as any)
        .select("*")
        .ilike("first_name", historyYouth.first)
        .ilike("last_name", historyYouth.last)
        .order("date", { ascending: false });
      return (data || []) as unknown as Callout[];
    },
  });

  // Fetch registrations for photos
  const { data: registrations = [] } = useQuery({
    queryKey: ["callout-registrations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("youth_registrations")
        .select("child_first_name, child_last_name, child_headshot_url, is_bald_eagle, bald_eagle_active");
      return data || [];
    },
  });

  const getPhoto = (first: string, last: string) => {
    const r = registrations.find(
      (r) => r.child_first_name.toLowerCase() === first.toLowerCase() && r.child_last_name.toLowerCase() === last.toLowerCase()
    );
    return r?.child_headshot_url || null;
  };

  const filtered = useMemo(() => {
    let list = viewMode === "day"
      ? callouts.filter((c) => c.date === dateFilter)
      : callouts;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(s)
      );
    }
    return list;
  }, [callouts, dateFilter, viewMode, search]);

  const baldEagleCallouts = filtered.filter((c) => c.is_bald_eagle);
  const regularCallouts = filtered.filter((c) => !c.is_bald_eagle);

  // Monthly summary
  const totalMonth = callouts.length;
  const acceptable = callouts.filter((c) => c.is_acceptable === true).length;
  const unacceptable = callouts.filter((c) => c.is_acceptable === false).length;
  const unreviewed = callouts.filter((c) => c.is_acceptable === null).length;

  const toggleAcceptable = async (id: string, current: boolean | null) => {
    const next = current === true ? false : current === false ? null : true;
    await supabase.from("callouts" as any).update({ is_acceptable: next } as any).eq("id", id);
    qc.invalidateQueries({ queryKey: ["callouts"] });
  };

  // Youth history stats
  const youthHistoryStats = useMemo(() => {
    if (!youthHistory.length) return null;
    const thisMonth = youthHistory.filter((c) => c.date >= monthStart && c.date <= monthEnd);
    return { total: youthHistory.length, thisMonth: thisMonth.length };
  }, [youthHistory, monthStart, monthEnd]);

  const CalloutRow = ({ c }: { c: Callout }) => {
    const photo = getPhoto(c.first_name, c.last_name);
    return (
      <TableRow className="border-neutral-800">
        <TableCell>
          <div className="flex items-center gap-3">
            {photo ? (
              <img src={photo} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-white text-xs font-bold">
                {c.first_name[0]}{c.last_name[0]}
              </div>
            )}
            <button
              onClick={() => setHistoryYouth({ first: c.first_name, last: c.last_name })}
              className="text-white hover:text-[#bf0f3e] font-medium text-left transition-colors"
            >
              {c.first_name} {c.last_name}
            </button>
            {c.is_bald_eagle && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                <Star className="w-3 h-3 mr-0.5" /> Eagle
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-neutral-300 text-sm max-w-[300px] truncate">{c.reason}</TableCell>
        <TableCell className="text-neutral-400 text-xs">
          {format(parseISO(c.created_at), "h:mm a")}
        </TableCell>
        <TableCell>
          <button
            onClick={() => toggleAcceptable(c.id, c.is_acceptable)}
            className="transition-colors"
          >
            {c.is_acceptable === true && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 cursor-pointer">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Acceptable
              </Badge>
            )}
            {c.is_acceptable === false && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 cursor-pointer">
                <XCircle className="w-3 h-3 mr-1" /> Unacceptable
              </Badge>
            )}
            {c.is_acceptable === null && (
              <Badge className="bg-neutral-700/50 text-neutral-400 border-neutral-600 cursor-pointer">
                <Clock className="w-3 h-3 mr-1" /> Review
              </Badge>
            )}
          </button>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header + Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white">Call-Outs</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as "day" | "month")}>
            <SelectTrigger className="w-[120px] bg-neutral-800 border-neutral-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day View</SelectItem>
              <SelectItem value="month">Month View</SelectItem>
            </SelectContent>
          </Select>

          {viewMode === "day" && (
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[160px] bg-neutral-800 border-neutral-700 text-white"
            />
          )}

          {viewMode === "month" && (
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="text-white">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-white font-medium text-sm min-w-[120px] text-center">
                {format(viewMonth, "MMMM yyyy")}
              </span>
              <Button size="icon" variant="ghost" onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="text-white">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-neutral-500" />
            <Input
              placeholder="Search youth..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[180px] bg-neutral-800 border-neutral-700 text-white"
            />
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{viewMode === "day" ? filtered.length : totalMonth}</p>
            <p className="text-[11px] text-neutral-400">Total Call-Outs</p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{acceptable}</p>
            <p className="text-[11px] text-neutral-400">Acceptable</p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{unacceptable}</p>
            <p className="text-[11px] text-neutral-400">Unacceptable</p>
          </CardContent>
        </Card>
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-neutral-400">{unreviewed}</p>
            <p className="text-[11px] text-neutral-400">Needs Review</p>
          </CardContent>
        </Card>
      </div>

      {/* Bald Eagle Call-Outs */}
      {baldEagleCallouts.length > 0 && (
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-400 text-sm flex items-center gap-2">
              <Star className="w-4 h-4" /> Bald Eagle Call-Outs ({baldEagleCallouts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-neutral-800">
                  <TableHead className="text-neutral-400">Youth</TableHead>
                  <TableHead className="text-neutral-400">Reason</TableHead>
                  <TableHead className="text-neutral-400">Time</TableHead>
                  <TableHead className="text-neutral-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baldEagleCallouts.map((c) => <CalloutRow key={c.id} c={c} />)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Call-Outs */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            {viewMode === "day"
              ? `Call-Outs for ${format(parseISO(dateFilter), "EEEE, MMM d")}`
              : `All Call-Outs — ${format(viewMonth, "MMMM yyyy")}`}
            <span className="text-neutral-500 font-normal">({regularCallouts.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-8">No call-outs recorded</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-neutral-800">
                  <TableHead className="text-neutral-400">Youth</TableHead>
                  <TableHead className="text-neutral-400">Reason</TableHead>
                  <TableHead className="text-neutral-400">Time</TableHead>
                  <TableHead className="text-neutral-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regularCallouts.map((c) => <CalloutRow key={c.id} c={c} />)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Youth History Dialog */}
      <Dialog open={!!historyYouth} onOpenChange={(open) => !open && setHistoryYouth(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Call-Out History: {historyYouth?.first} {historyYouth?.last}
            </DialogTitle>
          </DialogHeader>
          {youthHistoryStats && (
            <div className="flex gap-4 text-sm mb-4">
              <Badge className="bg-neutral-800 text-neutral-300 border-neutral-700">
                {youthHistoryStats.total} total call-outs
              </Badge>
              <Badge className="bg-neutral-800 text-neutral-300 border-neutral-700">
                {youthHistoryStats.thisMonth} this month
              </Badge>
            </div>
          )}
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {youthHistory.map((c) => (
              <div key={c.id} className="flex items-start justify-between bg-neutral-800/50 rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium text-white">{format(parseISO(c.date), "EEE, MMM d, yyyy")}</p>
                  <p className="text-xs text-neutral-400 mt-1">{c.reason}</p>
                </div>
                <div>
                  {c.is_acceptable === true && <Badge className="bg-green-500/20 text-green-400 text-[10px]">✓</Badge>}
                  {c.is_acceptable === false && <Badge className="bg-red-500/20 text-red-400 text-[10px]">✗</Badge>}
                  {c.is_acceptable === null && <Badge className="bg-neutral-700 text-neutral-400 text-[10px]">—</Badge>}
                </div>
              </div>
            ))}
            {youthHistory.length === 0 && (
              <p className="text-neutral-500 text-sm text-center py-4">No call-out history found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCallOuts;
