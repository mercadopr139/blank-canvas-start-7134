import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  Lock,
  MapPin,
  Pencil,
  Plane,
  Home,
  StickyNote,
  History,
} from "lucide-react";

interface Excursion {
  id: string;
  date: string;
  name: string;
  youth_count: number;
  notes: string | null;
  created_at: string;
  roster_locked_at: string | null;
  arrived_at: string | null;
  returned_at: string | null;
  arrival_note: string | null;
  return_note: string | null;
}

const fmtTime = (iso: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
};

const fmtDate = (iso: string) => {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const ExcursionRow = ({
  excursion: e,
  onEdit,
  actualCheckinCount,
}: {
  excursion: Excursion;
  onEdit: (e: Excursion) => void;
  actualCheckinCount: number;
}) => {
  const isClosed = !!e.returned_at;
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">
            {fmtDate(e.date)}
          </p>
          <p className="text-lg md:text-xl font-bold flex items-center gap-2 mt-0.5">
            <MapPin className="w-4 h-4 text-purple-300 shrink-0" /> {e.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">{actualCheckinCount} youth</span>
          {isClosed && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 bg-emerald-500/15 border border-emerald-400/40 rounded-full px-2 py-0.5">
              Closed
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-white/40 hover:text-white hover:bg-white/10 h-7 px-2"
            onClick={() => onEdit(e)}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Timeline strip */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {e.roster_locked_at ? (
          <span className="flex items-center gap-1.5 text-purple-200">
            <Lock className="w-3.5 h-3.5" />
            <span className="text-white/50">Locked</span>
            <span className="font-semibold tabular-nums">{fmtTime(e.roster_locked_at)}</span>
          </span>
        ) : (
          <span className="text-white/30 italic">Roster not locked</span>
        )}
        {e.arrived_at && (
          <span className="flex items-center gap-1.5 text-emerald-200">
            <Plane className="w-3.5 h-3.5" />
            <span className="text-white/50">Arrived</span>
            <span className="font-semibold tabular-nums">{fmtTime(e.arrived_at)}</span>
          </span>
        )}
        {e.returned_at && (
          <span className="flex items-center gap-1.5 text-emerald-200">
            <Home className="w-3.5 h-3.5" />
            <span className="text-white/50">Returned</span>
            <span className="font-semibold tabular-nums">{fmtTime(e.returned_at)}</span>
          </span>
        )}
      </div>

      {/* In-trip notes (arrival/return) */}
      {(e.arrival_note || e.return_note) && (
        <div className="mt-3 space-y-1.5">
          {e.arrival_note && (
            <p className="text-xs text-yellow-200/80 bg-yellow-500/10 border border-yellow-400/30 rounded-md px-2.5 py-1.5">
              <span className="text-yellow-200/60">Arrival note: </span>
              {e.arrival_note}
            </p>
          )}
          {e.return_note && (
            <p className="text-xs text-yellow-200/80 bg-yellow-500/10 border border-yellow-400/30 rounded-md px-2.5 py-1.5">
              <span className="text-yellow-200/60">Return note: </span>
              {e.return_note}
            </p>
          )}
        </div>
      )}

      {/* Lessons-for-next-year notes */}
      {e.notes && e.notes.trim().length > 0 && (
        <div className="mt-3 rounded-md bg-purple-500/10 border border-purple-400/30 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-200/70 mb-0.5 flex items-center gap-1.5">
            <StickyNote className="w-3 h-3" /> Notes / Lessons for next year
          </p>
          <p className="text-sm text-purple-100/90 whitespace-pre-wrap">{e.notes}</p>
        </div>
      )}
    </div>
  );
};

interface Props {
  monthExcursions: Excursion[];
  viewedMonthShort: string;
  onEdit: (e: Excursion) => void;
}

export const ExcursionHistorySection = ({
  monthExcursions,
  viewedMonthShort,
  onEdit,
}: Props) => {
  const [showHistory, setShowHistory] = useState(false);

  // All-time history (loaded only when section is opened to keep AdminAttendance fast)
  const { data: allExcursions = [], isLoading } = useQuery({
    queryKey: ["excursions-history-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursions")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as Excursion[];
    },
    enabled: showHistory,
  });

  // Real check-in counts per excursion_id — counts attendance_records,
  // not the manually-entered youth_count field on the excursion row.
  const { data: checkinCountByExcursion = {} } = useQuery({
    queryKey: ["excursion-checkin-counts-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("excursion_id")
        .eq("program_source", "Excursion")
        .not("excursion_id", "is", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: { excursion_id: string | null }) => {
        if (r.excursion_id) counts[r.excursion_id] = (counts[r.excursion_id] || 0) + 1;
      });
      return counts;
    },
  });
  const countsMap = checkinCountByExcursion as Record<string, number>;

  const sortedMonth = useMemo(
    () => [...monthExcursions].sort((a, b) => b.date.localeCompare(a.date)),
    [monthExcursions]
  );

  return (
    <div className="space-y-6 mb-6">
      {/* This month's Excursions */}
      <Card className="bg-white/5 border-white/10 text-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-300" /> Excursions — {viewedMonthShort}
            <span className="text-sm text-white/40 font-normal ml-1">
              ({sortedMonth.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedMonth.length === 0 ? (
            <p className="text-white/40 text-sm">No Excursions this month.</p>
          ) : (
            <div className="space-y-3">
              {sortedMonth.map((e) => (
                <ExcursionRow key={e.id} excursion={e} onEdit={onEdit} actualCheckinCount={countsMap[e.id] || 0} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full history — collapsible */}
      <Card className="bg-white/5 border-white/10 text-white">
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => setShowHistory((v) => !v)}
        >
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5 text-white/60" /> Full Excursion History
            <ChevronDown
              className={`w-5 h-5 ml-auto text-white/40 transition-transform ${
                showHistory ? "rotate-180" : ""
              }`}
            />
          </CardTitle>
        </CardHeader>
        {showHistory && (
          <CardContent>
            {isLoading ? (
              <p className="text-white/40 text-sm">Loading…</p>
            ) : allExcursions.length === 0 ? (
              <p className="text-white/40 text-sm">No Excursions on record yet.</p>
            ) : (
              <div className="space-y-3">
                {allExcursions.map((e) => (
                  <ExcursionRow key={e.id} excursion={e} onEdit={onEdit} actualCheckinCount={countsMap[e.id] || 0} />
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};
