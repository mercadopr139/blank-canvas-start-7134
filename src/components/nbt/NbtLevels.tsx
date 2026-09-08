// Which track each athlete is on.
//
// A default, not a label. It pre-fills the board so nobody re-picks nightly, and
// the coach changes it in one tap when a youth is ready. What a youth actually
// trained at is recorded on the log, so moving someone up never rewrites their
// history.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentAttendanceYear } from "@/lib/programYear";
import { TRACKS, TRACK_META, Track } from "@/lib/nbt";

interface Youth {
  id: string;
  child_first_name: string;
  child_last_name: string;
}

const NbtLevels = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: youth = [], isLoading } = useQuery({
    queryKey: ["nbt-youth"],
    queryFn: async () => {
      const { data } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name")
        .eq("program_year", getCurrentAttendanceYear())
        .is("archived_at", null)
        .order("child_last_name");
      return (data as Youth[]) || [];
    },
  });

  const { data: levels = {} } = useQuery({
    queryKey: ["nbt-levels"],
    queryFn: async () => {
      const { data } = await supabase
        .from("nbt_athlete_levels" as never)
        .select("registration_id, level");
      const m: Record<string, Track> = {};
      ((data as unknown as { registration_id: string; level: Track }[]) || []).forEach((r) => {
        m[r.registration_id] = r.level;
      });
      return m;
    },
  });

  const setLevel = async (id: string, level: Track) => {
    const { error } = await supabase.from("nbt_athlete_levels" as never).upsert(
      { registration_id: id, level, updated_by: user?.email ?? null } as never,
      { onConflict: "registration_id" } as never
    );
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["nbt-levels"] });
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return youth;
    return youth.filter((y) =>
      `${y.child_first_name} ${y.child_last_name}`.toLowerCase().includes(q)
    );
  }, [youth, search]);

  const counts = useMemo(() => {
    const c: Record<Track, number> = { charlie: 0, bravo: 0, alpha: 0 };
    youth.forEach((y) => { c[levels[y.id] ?? "charlie"] += 1; });
    return c;
  }, [youth, levels]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-sm text-neutral-400">
          Charlie is the <span className="text-white">learn</span> track, not the beginner&apos;s consolation
          prize. A youth can sit on different tracks for different movements, and moving up is a coaching call,
          not a calendar one.
        </p>
        <div className="flex gap-2 mt-3 flex-wrap">
          {TRACKS.map((t) => (
            <span
              key={t}
              className="rounded-lg px-3 py-1.5 text-sm font-bold"
              style={{ backgroundColor: `${TRACK_META[t].color}1a`, color: TRACK_META[t].color }}
            >
              {TRACK_META[t].label} — {counts[t]}
            </span>
          ))}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a youth…"
          className="pl-9 bg-neutral-800 border-neutral-700 text-white"
        />
      </div>

      {isLoading ? (
        <p className="text-neutral-500 py-8 text-center">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-neutral-600">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No youth match that.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 overflow-hidden">
          {visible.map((y) => {
            const current = levels[y.id] ?? "charlie";
            return (
              <div
                key={y.id}
                className="border-t border-neutral-800 first:border-t-0 px-4 py-2.5 flex items-center gap-3 flex-wrap"
              >
                <span className="text-white flex-1 min-w-[140px]">
                  {y.child_first_name} {y.child_last_name}
                </span>
                <div className="flex gap-1.5">
                  {TRACKS.map((t) => {
                    const m = TRACK_META[t];
                    const on = t === current;
                    return (
                      <button
                        key={t}
                        onClick={() => setLevel(y.id, t)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors"
                        style={{
                          borderColor: on ? m.color : "rgba(255,255,255,0.1)",
                          backgroundColor: on ? `${m.color}22` : "transparent",
                          color: on ? m.color : "rgba(255,255,255,0.4)",
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NbtLevels;
