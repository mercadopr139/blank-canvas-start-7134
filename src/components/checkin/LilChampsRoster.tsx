import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Search, Filter, ArrowUpDown, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const getHeadshotUrl = (url: string | null): string | null => {
  if (!url) return null;
  const bustParam = `?v=${Date.now()}`;
  if (url.startsWith("http")) return url + bustParam;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (url.startsWith("youth-photos/")) {
    return `${supabaseUrl}/storage/v1/object/public/youth-photos/${url}${bustParam}`;
  }
  return `${supabaseUrl}/storage/v1/object/public/registration-signatures/${url}${bustParam}`;
};

interface RosterYouth {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_date_of_birth: string;
  child_headshot_url: string | null;
}

const calculateAge = (dob: string): number => {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

type SortMode = "alpha" | "age";
type FilterMode = "all" | "not-checked-in" | "checked-in";

interface LilChampsRosterProps {
  onCheckIn: (y: RosterYouth) => Promise<void>;
  onUndo: (y: RosterYouth) => Promise<void>;
  onClose: () => void;
  checkedInIds: Set<string>;
}

const DOUBLE_TAP_DELAY = 400; // ms

const LilChampsRoster = ({ onCheckIn, onUndo, onClose, checkedInIds }: LilChampsRosterProps) => {
  const [roster, setRoster] = useState<RosterYouth[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("alpha");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [processing, setProcessing] = useState<string | null>(null);
  const lastTapRef = useRef<{ id: string; time: number }>({ id: "", time: 0 });

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("youth_registrations")
      .select("id, child_first_name, child_last_name, child_date_of_birth, child_headshot_url")
      .eq("approved_for_attendance", true)
      .eq("extended_program", "Lil Champs Corner")
      .order("child_last_name", { ascending: true })
      .order("child_first_name", { ascending: true });

    if (!error && data) setRoster(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRoster(); }, [fetchRoster]);

  const handleDoubleTap = async (y: RosterYouth) => {
    if (processing) return;
    setProcessing(y.id);
    if (checkedInIds.has(y.id)) {
      await onUndo(y);
    } else {
      await onCheckIn(y);
    }
    setProcessing(null);
  };

  const handleTapOrClick = (e: React.PointerEvent, y: RosterYouth) => {
    // Prevent ghost clicks / duplicate fires
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    const last = lastTapRef.current;
    if (last.id === y.id && now - last.time < DOUBLE_TAP_DELAY) {
      // Double tap detected
      lastTapRef.current = { id: "", time: 0 };
      handleDoubleTap(y);
    } else {
      lastTapRef.current = { id: y.id, time: now };
    }
  };

  let filtered = roster.filter((y) => {
    if (filterMode === "checked-in" && !checkedInIds.has(y.id)) return false;
    if (filterMode === "not-checked-in" && checkedInIds.has(y.id)) return false;
    if (filterText.length >= 2) {
      const q = filterText.toLowerCase();
      return y.child_first_name.toLowerCase().includes(q) || y.child_last_name.toLowerCase().includes(q);
    }
    return true;
  });

  if (sortMode === "age") {
    filtered = [...filtered].sort((a, b) => calculateAge(a.child_date_of_birth) - calculateAge(b.child_date_of_birth));
  }

  const checkedCount = roster.filter((y) => checkedInIds.has(y.id)).length;

  return (
    <div className="fixed inset-0 bg-black z-30 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10 bg-black/95 backdrop-blur px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-white truncate">
              <span style={{ color: '#38bdf8' }}>Lil' Champs</span> Roster
            </h2>
            <p className="text-white/40 text-xs sm:text-sm">
              {checkedCount} of {roster.length} checked in
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white/60 hover:text-white hover:bg-white/10 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search + Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter by name..."
              className="pl-9 h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl text-sm"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-white/50 hover:text-white hover:bg-white/10 flex-shrink-0">
                <Filter className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10 text-white">
              <DropdownMenuItem onClick={() => setFilterMode("all")} className={filterMode === "all" ? "bg-white/10" : ""}>
                All Youth
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterMode("not-checked-in")} className={filterMode === "not-checked-in" ? "bg-white/10" : ""}>
                Not Checked In
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterMode("checked-in")} className={filterMode === "checked-in" ? "bg-white/10" : ""}>
                Checked In
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-white/50 hover:text-white hover:bg-white/10 flex-shrink-0">
                <ArrowUpDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10 text-white">
              <DropdownMenuItem onClick={() => setSortMode("alpha")} className={sortMode === "alpha" ? "bg-white/10" : ""}>
                A → Z
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortMode("age")} className={sortMode === "age" ? "bg-white/10" : ""}>
                By Age
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        {loading ? (
          <p className="text-center text-white/40 py-12">Loading roster...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-white/40 py-12">No youth found</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {filtered.map((y) => {
              const isChecked = checkedInIds.has(y.id);
              const isLoading = processing === y.id;
              const photo = getHeadshotUrl(y.child_headshot_url);
              const age = calculateAge(y.child_date_of_birth);

              return (
                <div
                  key={y.id}
                  role="button"
                  tabIndex={0}
                  onPointerDown={(e) => handleTapOrClick(e, y)}
                  style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', cursor: 'pointer' }}
                  className={`relative flex flex-col items-center rounded-2xl p-3 sm:p-4 transition-all duration-200 border-2 text-left select-none
                    ${isChecked
                      ? "border-green-500/40 bg-green-500/10"
                      : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-sky-400/30"
                    }
                    ${isLoading ? "animate-pulse" : ""}
                  `}
                >
                  {/* Check badge */}
                  {isChecked && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                    </div>
                  )}

                  {/* Photo */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-white/10 ring-2 ring-white/10 flex items-center justify-center mb-2 sm:mb-3 flex-shrink-0">
                    {photo ? (
                      <img src={photo} alt="" className="w-full h-full object-cover" draggable={false} />
                    ) : (
                      <span className="text-xl sm:text-2xl md:text-3xl font-bold text-white/40">
                        {y.child_first_name[0]}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <p className="text-white font-semibold text-xs sm:text-sm text-center leading-tight truncate w-full">
                    {y.child_first_name}
                  </p>
                  <p className="text-white/60 text-[11px] sm:text-xs text-center truncate w-full">
                    {y.child_last_name}
                  </p>
                  <p className="text-white/30 text-[10px] sm:text-[11px] mt-0.5">Age {age}</p>

                  {/* Status label */}
                  {isChecked ? (
                    <span className="mt-1.5 text-[10px] sm:text-xs font-semibold text-green-400">
                      ✓ Checked In
                    </span>
                  ) : (
                    <span className="mt-1.5 text-[10px] sm:text-xs font-medium text-sky-400/70">
                      Double-tap to check in
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LilChampsRoster;
