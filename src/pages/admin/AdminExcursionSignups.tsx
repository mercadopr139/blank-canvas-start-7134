// ═══════════════════════════════════════════════════════════════════
// Excursion Sign-Ups — pre-trip invite / roster planning board
// ═══════════════════════════════════════════════════════════════════
// Reached from an existing excursion (Edit Excursion modal or the calendar
// day pop-up in AdminAttendance). A coordinator picks youth from the youth
// bucket and works each one through Pending → Invited → Confirmed, with a
// quiet "Can't make it" bucket. On excursion day the Confirmed list is
// exactly who you expect at the check-in kiosk.
//
// Admin-only (uses RLS admin policies + direct table access). Sign-ups do
// NOT check anyone in — the kiosk records actual attendance separately.

import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft, Search, MoreHorizontal, X, Check,
  UserPlus, Users, CalendarDays, StickyNote,
} from "lucide-react";

type Status = "pending" | "invited" | "confirmed" | "declined";

const getHeadshotUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/youth-photos/${url}`;
};

type Youth = {
  child_first_name: string;
  child_last_name: string;
  child_headshot_url: string | null;
  child_boxing_program: string | null;
  parent_first_name: string | null;
  parent_last_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  child_phone: string | null;
};

type Signup = {
  id: string;
  status: Status;
  notes: string | null;
  parent_contacted_at: string | null;
  registration_id: string;
  youth: Youth | null;
};

type SearchHit = {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string | null;
  child_headshot_url: string | null;
};

// Column look — kept as static class strings (Tailwind can't build these
// dynamically).
const COLUMNS: { key: Exclude<Status, "declined">; label: string; sub: string; head: string; ring: string; dot: string }[] = [
  { key: "invited", label: "Chrissy's List", sub: "Invited — move to Pending or Confirmed", head: "text-purple-300", ring: "border-purple-400/25", dot: "bg-purple-400" },
  { key: "pending", label: "Pending", sub: "Chrissy notified, waiting for confirmation", head: "text-amber-300", ring: "border-amber-400/25", dot: "bg-amber-400" },
  { key: "confirmed", label: "Confirmed", sub: "Locked in for the trip", head: "text-emerald-300", ring: "border-emerald-400/25", dot: "bg-emerald-400" },
];

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  invited: "Chrissy's List",
  confirmed: "Confirmed",
  declined: "Can't make it",
};

const shortProgram = (p: string | null) =>
  (p || "").replace("Boxing ", "").replace(/\s*\(.*\)/, "").trim();

export default function AdminExcursionSignups() {
  const { excursionId } = useParams<{ excursionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [addAs, setAddAs] = useState<Exclude<Status, "declined">>("invited");
  const [busy, setBusy] = useState(false);

  /* ── Excursion meta ── */
  const { data: excursion } = useQuery({
    queryKey: ["excursion-signups-meta", excursionId],
    enabled: !!excursionId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("excursions") as any)
        .select("id, date, name, notes, target_capacity")
        .eq("id", excursionId)
        .single();
      if (error) throw error;
      return data as { id: string; date: string; name: string; notes: string | null; target_capacity: number | null };
    },
  });

  /* ── Sign-ups (with the youth + parent contact joined in) ── */
  const { data: signups = [] } = useQuery({
    queryKey: ["excursion-signups", excursionId],
    enabled: !!excursionId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("excursion_signups") as any)
        .select(
          "id, status, notes, parent_contacted_at, registration_id, youth:youth_registrations(child_first_name, child_last_name, child_headshot_url, child_boxing_program, parent_first_name, parent_last_name, parent_phone, parent_email, child_phone)"
        )
        .eq("excursion_id", excursionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Signup[];
    },
  });

  /* ── Youth search (reuses the kiosk's approved-youth RPC) ── */
  const alreadyIn = useMemo(() => new Set(signups.map((s) => s.registration_id)), [signups]);
  const { data: searchHits = [] } = useQuery({
    queryKey: ["excursion-signups-search", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_excursion_youth", { _search: search.trim() });
      if (error) throw error;
      return (data || []) as SearchHit[];
    },
  });
  const filteredHits = searchHits.filter((h) => !alreadyIn.has(h.id));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["excursion-signups", excursionId] });
  };

  /* ── Mutations (direct table writes, admin RLS) ── */
  const addYouth = async (regId: string, status: Exclude<Status, "declined">) => {
    setBusy(true);
    const { error } = await (supabase.from("excursion_signups") as any).insert({
      excursion_id: excursionId,
      registration_id: regId,
      status,
      added_by: user?.email ?? null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Already on the list" : error.message);
      return;
    }
    setSearch("");
    refresh();
  };

  const setStatus = async (id: string, status: Status) => {
    const { error } = await (supabase.from("excursion_signups") as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase.from("excursion_signups") as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const updateNote = async (id: string, note: string) => {
    const { error } = await (supabase.from("excursion_signups") as any)
      .update({ notes: note.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const saveTarget = async (raw: string) => {
    const val = raw.trim() === "" ? null : Math.max(0, parseInt(raw, 10) || 0);
    const { error } = await (supabase.from("excursions") as any)
      .update({ target_capacity: val })
      .eq("id", excursionId);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["excursion-signups-meta", excursionId] });
  };

  /* ── Derived counts ── */
  const byStatus = useMemo(() => {
    const m: Record<Status, Signup[]> = { pending: [], invited: [], confirmed: [], declined: [] };
    signups.forEach((s) => m[s.status]?.push(s));
    return m;
  }, [signups]);

  const confirmedCount = byStatus.confirmed.length;
  const target = excursion?.target_capacity ?? null;
  const over = target != null && confirmedCount > target;
  const full = target != null && confirmedCount >= target;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-5">
        {/* ── Header ── */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Excursion Sign-Ups
            </p>
            <h1 className="text-2xl font-black truncate">{excursion?.name || "Excursion"}</h1>
            {excursion?.date && (
              <p className="text-sm text-white/50 flex items-center gap-1.5 mt-0.5">
                <CalendarDays className="w-3.5 h-3.5" />
                {format(parseISO(excursion.date), "EEEE, MMMM d, yyyy")}
              </p>
            )}
          </div>

          {/* Capacity meter */}
          <div className={`rounded-xl border px-4 py-3 text-center ${over ? "bg-amber-500/10 border-amber-400/40" : full ? "bg-amber-500/[0.06] border-amber-400/25" : "bg-white/[0.03] border-white/10"}`}>
            <div className="flex items-baseline gap-1 justify-center">
              <span className={`text-3xl font-black tabular-nums ${over ? "text-amber-300" : "text-emerald-300"}`}>{confirmedCount}</span>
              <span className="text-white/40 text-lg font-bold">/</span>
              <Input
                type="number"
                min={0}
                defaultValue={target ?? ""}
                onBlur={(e) => saveTarget(e.target.value)}
                placeholder="—"
                className="w-14 h-8 bg-white/5 border-white/20 text-white text-center text-lg font-bold p-0"
                title="Loose target capacity"
              />
            </div>
            <p className={`text-[10px] uppercase tracking-wider font-semibold mt-1 ${over ? "text-amber-300" : "text-white/50"}`}>
              {over ? "Over capacity" : "Confirmed / Target"}
            </p>
          </div>
        </div>

        {/* ── Add youth ── */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs text-white/50 font-semibold">Add as:</span>
            {(["invited", "pending"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setAddAs(s)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                  addAs === s ? "bg-white text-black border-white" : "border-white/20 text-white/60 hover:bg-white/5"
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
            <span className="text-[11px] text-white/30">
              {addAs === "invited" ? "You're inviting them" : "They requested to come"}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a youth's name to add them…"
              className="pl-9 bg-white/5 border-white/20 text-white placeholder:text-white/30 h-11"
            />
          </div>
          {search.trim().length >= 2 && (
            <div className="mt-2 max-h-72 overflow-y-auto space-y-1">
              {filteredHits.length === 0 ? (
                <p className="text-sm text-white/40 px-2 py-3">
                  {searchHits.length > 0 ? "Everyone matching is already on the list." : "No approved youth match."}
                </p>
              ) : (
                filteredHits.map((h) => (
                  <button
                    key={h.id}
                    disabled={busy}
                    onClick={() => addYouth(h.id, addAs)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 text-left transition-colors disabled:opacity-50"
                  >
                    <Avatar url={h.child_headshot_url} first={h.child_first_name} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{h.child_first_name} {h.child_last_name}</p>
                      <p className="text-xs text-white/40 truncate">{shortProgram(h.child_boxing_program)}</p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1 flex-shrink-0">
                      <UserPlus className="w-3.5 h-3.5" /> Add
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Board (3 columns; stacks on mobile) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => (
            <div key={col.key} className={`rounded-xl border bg-white/[0.02] ${col.ring} overflow-hidden`}>
              <div className="px-3 py-2.5 border-b border-white/10 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className={`font-bold ${col.head}`}>{col.label}</span>
                <span className="ml-auto text-sm font-black tabular-nums text-white/60">{byStatus[col.key].length}</span>
              </div>
              <p className="px-3 pt-2 text-[10px] uppercase tracking-wider text-white/30 font-semibold">{col.sub}</p>
              <div className="p-2 space-y-2 min-h-[80px]">
                {byStatus[col.key].length === 0 ? (
                  <p className="text-sm text-white/25 px-2 py-4 text-center">No youth yet</p>
                ) : (
                  byStatus[col.key].map((s) => (
                    <SignupCard
                      key={s.id}
                      s={s}
                      onSetStatus={setStatus}
                      onRemove={remove}
                      onUpdateNote={updateNote}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Declined bucket ── */}
        {byStatus.declined.length > 0 && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-2 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" /> Can't Make It ({byStatus.declined.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {byStatus.declined.map((s) => (
                <SignupCard
                  key={s.id}
                  s={s}
                  muted
                  onSetStatus={setStatus}
                  onRemove={remove}
                  onUpdateNote={updateNote}
                />
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-white/30 mt-8 text-center">
          Sign-ups are for planning only — they don't check anyone in. On trip day, youth still check in at the kiosk.
        </p>
      </div>
    </div>
  );
}

/* ───────── Avatar ───────── */
function Avatar({ url, first }: { url: string | null; first: string }) {
  const src = getHeadshotUrl(url);
  return (
    <span className="w-9 h-9 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-sm font-bold text-white/60 flex-shrink-0">
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : first[0]}
    </span>
  );
}

/* ───────── Signup card ───────── */
function SignupCard({
  s, muted, onSetStatus, onRemove, onUpdateNote,
}: {
  s: Signup;
  muted?: boolean;
  onSetStatus: (id: string, status: Status) => void;
  onRemove: (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
}) {
  const y = s.youth;
  if (!y) return null;

  const others: Status[] = (["invited", "pending", "confirmed", "declined"] as Status[]).filter((x) => x !== s.status);

  return (
    <div className={`rounded-lg border p-2.5 ${muted ? "bg-white/[0.02] border-white/5 opacity-70" : "bg-white/[0.04] border-white/10"}`}>
      <div className="flex items-center gap-2.5">
        <Avatar url={y.child_headshot_url} first={y.child_first_name} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate leading-tight">{y.child_first_name} {y.child_last_name}</p>
          <p className="text-[11px] text-white/40 truncate">{shortProgram(y.child_boxing_program)}</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-white/10 text-white/50 flex-shrink-0" title="Move / remove">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 bg-neutral-900 border-white/15 text-white p-1" align="end">
            <p className="text-[10px] uppercase tracking-wider text-white/40 px-2 py-1 font-semibold">Move to</p>
            {others.map((st) => (
              <button
                key={st}
                onClick={() => onSetStatus(s.id, st)}
                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-white/10 flex items-center gap-2"
              >
                <Check className="w-3.5 h-3.5 opacity-0" />
                {STATUS_LABEL[st]}
              </button>
            ))}
            <div className="h-px bg-white/10 my-1" />
            <button
              onClick={() => onRemove(s.id)}
              className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-rose-500/15 text-rose-300 flex items-center gap-2"
            >
              <X className="w-3.5 h-3.5" /> Remove from list
            </button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Note — why they're pending / what's needed before confirming */}
      {muted ? (
        s.notes && <p className="text-[11px] text-white/40 mt-1.5 italic">“{s.notes}”</p>
      ) : (
        <NoteField id={s.id} initial={s.notes} onSave={onUpdateNote} />
      )}
    </div>
  );
}

/* ───────── Editable note ───────── */
function NoteField({ id, initial, onSave }: { id: string; initial: string | null; onSave: (id: string, v: string) => void }) {
  const [v, setV] = useState(initial ?? "");
  // Re-sync if the underlying note changes from elsewhere (e.g. refetch).
  useEffect(() => { setV(initial ?? ""); }, [initial]);

  return (
    <div className="mt-2 flex items-start gap-1.5">
      <StickyNote className="w-3.5 h-3.5 text-white/25 mt-1.5 flex-shrink-0" />
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if ((v.trim() || "") !== (initial || "")) onSave(id, v); }}
        rows={2}
        placeholder="Note — e.g. needs to get off work · talk to mom first"
        className="w-full text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-white/80 placeholder:text-white/25 resize-none focus:outline-none focus:border-white/30"
      />
    </div>
  );
}
