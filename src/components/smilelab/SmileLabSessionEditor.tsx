import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeImageForUpload } from "@/lib/imageUpload";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Users, ImagePlus, Trash2, Loader2 } from "lucide-react";

// The Smile Lab session journal editor — shared by the public Board (coaches on
// the gym screen) and the admin Journal tab. Date-controlled by the parent so an
// "edit" action elsewhere can jump the editor to a given session. Autosaves.

const TEAL = "#2dd4bf";

export const todayNY = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const shiftDate = (isoStr: string, days: number): string => {
  const d = new Date(isoStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const prettyDate = (isoStr: string): string =>
  new Date(isoStr + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

const arrayToText = (arr: string[]): string => (arr.length ? arr.map((s) => "• " + s).join("\n") : "");
const textToArray = (t: string): string[] =>
  t.split("\n").map((l) => l.replace(/^\s*•\s?/, "").trim()).filter((l) => l.length > 0);

async function uploadPhoto(file: File): Promise<string> {
  const normalized = await normalizeImageForUpload(file);
  const ext = (normalized.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("smile-lab-photos").upload(path, normalized, { upsert: true, contentType: normalized.type || undefined });
  if (error) throw error;
  return supabase.storage.from("smile-lab-photos").getPublicUrl(path).data.publicUrl;
}

interface Attendee { child_first_name: string; child_last_name: string }

interface Props {
  date: string;
  onDateChange: (d: string) => void;
  showDateNav?: boolean;
  onSaved?: () => void;
}

const SmileLabSessionEditor = ({ date, onDateChange, showDateNav = true, onSaved }: Props) => {
  const isToday = date === todayNY();
  const [caring, setCaring] = useState("");
  const [sharing, setSharing] = useState("");
  const [standout, setStandout] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [uploading, setUploading] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastSaved = useRef<string>("");
  const loadedFor = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase.from("smile_lab_sessions" as never) as any)
        .select("*").eq("session_date", date).maybeSingle();
      if (cancelled) return;
      const c = data?.caring_note ?? "", s = data?.sharing_note ?? "";
      const h = Array.isArray(data?.highlights) ? (data.highlights as string[]) : [];
      const p = Array.isArray(data?.photos) ? (data.photos as string[]) : [];
      setCaring(c); setSharing(s); setStandout(arrayToText(h)); setPhotos(p);
      lastSaved.current = JSON.stringify({ c, s, h, p });
      loadedFor.current = date;
      setStatus("idle");
      const { data: att } = await (supabase.rpc as any)("get_smile_lab_attendance", { _date: date });
      if (!cancelled) setAttendees((att as Attendee[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [date]);

  const save = async () => {
    const payload = { c: caring, s: sharing, h: textToArray(standout), p: photos };
    const snapshot = JSON.stringify(payload);
    if (snapshot === lastSaved.current) return;
    setStatus("saving");
    const { error } = await (supabase.from("smile_lab_sessions" as never) as any).upsert(
      { session_date: date, caring_note: caring || null, sharing_note: sharing || null, highlights: payload.h, photos },
      { onConflict: "session_date" }
    );
    if (error) { toast.error("Couldn't save — try again."); setStatus("idle"); return; }
    lastSaved.current = snapshot;
    setStatus("saved");
    onSaved?.();
  };

  useEffect(() => {
    if (loadedFor.current !== date) return;
    const t = setTimeout(() => { void save(); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caring, sharing, standout, photos, date]);

  const onPickPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadPhoto(f));
      setPhotos((prev) => [...prev, ...urls]);
    } catch (e: any) {
      toast.error(e?.message || "Photo upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const dirty = (v: string) => { setStatus("idle"); return v; };

  return (
    <div>
      {/* Date nav + save status */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        {showDateNav ? (
          <div className="flex items-center gap-2">
            <button onClick={() => onDateChange(shiftDate(date, -7))} title="Previous week"
              className="h-9 w-9 grid place-items-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center min-w-[12rem]">
              <div className="font-semibold">{prettyDate(date)}</div>
              <div className="text-[11px] text-white/40">{isToday ? "Today" : "Session date"}</div>
            </div>
            <button onClick={() => onDateChange(shiftDate(date, 7))} title="Next week"
              className="h-9 w-9 grid place-items-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : <div className="font-semibold">{prettyDate(date)}</div>}
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={(e) => e.target.value && onDateChange(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/15 px-2 py-1.5 text-sm text-white" />
          <span className="text-xs w-14 text-right">
            {status === "saving" ? <span className="text-white/40">Saving…</span>
              : status === "saved" ? <span className="text-emerald-300/80">Saved ✓</span> : null}
          </span>
        </div>
      </div>

      {/* Attendance */}
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-5 w-5" style={{ color: TEAL }} />
          <h2 className="font-bold">Checked in</h2>
          <span className="ml-auto text-2xl font-extrabold" style={{ color: TEAL }}>{attendees.length}</span>
        </div>
        {attendees.length === 0 ? (
          <p className="text-sm text-white/40">No check-ins for this date. Kids sign in on the Smile Lab kiosk.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {attendees.map((a, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-md bg-white/5 border border-white/10">{a.child_first_name} {a.child_last_name[0]}.</span>
            ))}
          </div>
        )}
      </div>

      {/* Station notes */}
      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <label className="flex items-center gap-2 font-bold mb-2">🦷 Caring for Your Smile <span className="text-xs text-white/40 font-normal">— Coach Jaime</span></label>
          <textarea value={caring} onChange={(e) => setCaring(dirty(e.target.value))} rows={6}
            placeholder="What did we cover today? Brushing, flossing, nutrition, hygiene, habits… how did it go?"
            className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-y min-h-[130px]" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <label className="flex items-center gap-2 font-bold mb-2">😊 Sharing Your Smile <span className="text-xs text-white/40 font-normal">— Coach Chrissy</span></label>
          <textarea value={sharing} onChange={(e) => setSharing(dirty(e.target.value))} rows={6}
            placeholder="What did we practice today? Manners, gratitude, kindness, handling bullying, serving others…"
            className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-y min-h-[130px]" />
        </div>
      </div>

      {/* Standout moments */}
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 mb-5">
        <label className="flex items-center gap-2 font-bold mb-1">⭐ Standout Moments</label>
        <p className="text-[11px] text-white/40 mb-2">Real kid wins, breakthroughs, quotes — each line becomes a featured story in the grant report.</p>
        <textarea value={standout} onChange={(e) => setStandout(dirty(e.target.value))} rows={4}
          onFocus={() => { if (!standout) setStandout("• "); }}
          placeholder="e.g. Marcus taught his little brother how to floss all week!"
          className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-y min-h-[96px]" />
      </div>

      {/* Photos */}
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-2 font-bold">📷 Photos</label>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => onPickPhotos(e.target.files)} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-semibold text-black disabled:opacity-60" style={{ background: TEAL }}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Add photos
          </button>
        </div>
        {photos.length === 0 ? (
          <p className="text-sm text-white/40">No photos yet. Snap a couple from today's session.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((url, i) => (
              <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-white/10">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button onClick={() => { setStatus("idle"); setPhotos((prev) => prev.filter((_, idx) => idx !== i)); }}
                  className="absolute top-1 right-1 h-7 w-7 grid place-items-center rounded-md bg-black/60 hover:bg-red-600/80 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SmileLabSessionEditor;
