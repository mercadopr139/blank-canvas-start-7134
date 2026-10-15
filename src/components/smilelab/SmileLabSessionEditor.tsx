import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { thumbOf } from "@/lib/imageResize";
import { uploadAftercarePhoto } from "@/lib/aftercarePhotos";
import { todayNY, shiftDate, sessionDateFor, filedOn } from "@/lib/aftercareDates";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Users, ImagePlus, Trash2, Loader2 } from "lucide-react";

// The Juniors Aftercare session journal editor — shared by the public Board (coaches on
// the gym screen) and the admin Journal tab. Date-controlled by the parent so an
// "edit" action elsewhere can jump the editor to a given session. Autosaves.

const TEAL = "#2dd4bf";
// Each lab owns a colour so the two columns read apart at a glance: Smile Lab
// keeps teal (the tooth, Delta Dental, the colour the kids know); Life Lab is
// rose, which nothing else in the app uses. (Josh, 2026-10-03.)
const LAB_COLOR = { smile: TEAL, life: "#fb7185" } as const;

// The date rules (today in Eastern time, and the Tuesday a report belongs
// to) live in src/lib/aftercareDates.ts, shared with the Board and the tab.
const prettyDate = (isoStr: string): string =>
  new Date(isoStr + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

const arrayToText = (arr: string[]): string => (arr.length ? arr.map((s) => "• " + s).join("\n") : "");
const LAB_PREFIX = { smile: "Smile Lab — ", life: "Life Lab — " } as const;
/** Split the stored stories into the two labs' boxes. */
const splitHighlights = (h: string[]) => {
  const smile: string[] = [], life: string[] = [];
  h.forEach((line) => {
    if (line.startsWith(LAB_PREFIX.life)) life.push(line.slice(LAB_PREFIX.life.length));
    else if (line.startsWith(LAB_PREFIX.smile)) smile.push(line.slice(LAB_PREFIX.smile.length));
    else smile.push(line);
  });
  return { smile, life };
};
const joinHighlights = (smile: string[], life: string[]) => [
  ...smile.map((l) => LAB_PREFIX.smile + l),
  ...life.map((l) => LAB_PREFIX.life + l),
];
const textToArray = (t: string): string[] =>
  t.split("\n").map((l) => l.replace(/^\s*•\s?/, "").trim()).filter((l) => l.length > 0);

type Lab = "smile" | "life";
const isLifePhoto = (url: string) => url.includes("/smile-lab-photos/life/");

// Photos are shrunk and stored by uploadAftercarePhoto (src/lib/aftercarePhotos.ts).
const uploadPhoto = (file: File, lab: Lab) => uploadAftercarePhoto(file, lab);

interface Attendee { child_first_name: string; child_last_name: string }

interface Props {
  date: string;
  onDateChange: (d: string) => void;
  showDateNav?: boolean;
  onSaved?: () => void;
  /** From the reminder email: hand this lab's half in on arrival, if it is written. */
  autoSubmit?: Lab | null;
}

const SmileLabSessionEditor = ({ date, onDateChange, showDateNav = true, onSaved, autoSubmit = null }: Props) => {
  const isToday = date === todayNY();
  // Whatever the parent hands over, the editor sits on that week's Tuesday.
  useEffect(() => {
    const tuesday = sessionDateFor(date);
    if (tuesday !== date) onDateChange(tuesday);
  }, [date, onDateChange]);
  const [caring, setCaring] = useState("");
  const [sharing, setSharing] = useState("");
  const [smileMoments, setSmileMoments] = useState("");
  const [lifeMoments, setLifeMoments] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [uploading, setUploading] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  // When each lab's half was handed in with its Submit button (null = not yet).
  const [filed, setFiled] = useState<Record<Lab, string | null>>({ smile: null, life: null });
  const [submitting, setSubmitting] = useState<Lab | null>(null);
  const autoSubmitted = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const lifeFileRef = useRef<HTMLInputElement>(null);
  const smilePhotos = photos.filter((u) => !isLifePhoto(u));
  const lifePhotos = photos.filter(isLifePhoto);
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
      const split = splitHighlights(h);
      setCaring(c); setSharing(s); setSmileMoments(arrayToText(split.smile)); setLifeMoments(arrayToText(split.life)); setPhotos(p);
      setFiled({ smile: data?.caring_filed_at ?? null, life: data?.sharing_filed_at ?? null });
      lastSaved.current = JSON.stringify({ c, s, h, p });
      loadedFor.current = date;
      setStatus("idle");
      const { data: att } = await (supabase.rpc as any)("get_smile_lab_attendance", { _date: date });
      if (!cancelled) setAttendees((att as Attendee[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [date]);

  const currentSnapshot = () =>
    JSON.stringify({ c: caring, s: sharing, h: joinHighlights(textToArray(smileMoments), textToArray(lifeMoments)), p: photos });

  /** Autosave. Returns false when the save failed, so Submit can refuse to hand in unsaved text. */
  const save = async (): Promise<boolean> => {
    const payload = { c: caring, s: sharing, h: joinHighlights(textToArray(smileMoments), textToArray(lifeMoments)), p: photos };
    const snapshot = JSON.stringify(payload);
    if (snapshot === lastSaved.current) return true;
    setStatus("saving");
    const { error } = await (supabase.from("smile_lab_sessions" as never) as any).upsert(
      { session_date: date, caring_note: caring || null, sharing_note: sharing || null, highlights: payload.h, photos },
      { onConflict: "session_date" }
    );
    if (error) { toast.error("Couldn't save — try again."); setStatus("idle"); return false; }
    lastSaved.current = snapshot;
    setStatus("saved");
    onSaved?.();
    return true;
  };

  // Leaving with unsaved typing (or mid-save) gets the browser's "are you
  // sure" — the reminder Josh asked for, at the one moment it matters.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (loadedFor.current !== date) return;
      if (status === "saving" || currentSnapshot() !== lastSaved.current) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caring, sharing, smileMoments, lifeMoments, photos, status, date]);

  const LAB_NAME: Record<Lab, string> = { smile: "Smile Lab", life: "Life Lab" };
  const stampFor = (lab: Lab, value: string | null) => (lab === "smile" ? { caring_filed_at: value } : { sharing_filed_at: value });
  /** What this lab's half still needs before it can be handed in. */
  const stillNeeds = (lab: Lab): string[] => {
    const note = lab === "smile" ? caring : sharing;
    const moments = textToArray(lab === "smile" ? smileMoments : lifeMoments);
    return [...(note.trim() ? [] : ["what we covered"]), ...(moments.length ? [] : ["a standout moment"])];
  };

  /** Hand one lab's half in: flush the autosave, then stamp it. */
  const submit = async (lab: Lab) => {
    if (stillNeeds(lab).length) { toast.error(`${LAB_NAME[lab]} still needs ${stillNeeds(lab).join(" and ")}.`); return; }
    setSubmitting(lab);
    try {
      if (!(await save())) return;
      const at = new Date().toISOString();
      const { error } = await (supabase.from("smile_lab_sessions" as never) as any).upsert(
        { session_date: date, ...stampFor(lab, at) },
        { onConflict: "session_date" }
      );
      if (error) throw error;
      setFiled((f) => ({ ...f, [lab]: at }));
      toast.success(`${LAB_NAME[lab]} report submitted for ${prettyDate(date)}.`);
      onSaved?.();
    } catch (e) {
      toast.error((e as Error)?.message || "Couldn't submit — try again.");
    } finally {
      setSubmitting(null);
    }
  };
  /** Open a submitted half back up for a fix. Never locked. */
  const reopen = async (lab: Lab) => {
    const { error } = await (supabase.from("smile_lab_sessions" as never) as any).upsert(
      { session_date: date, ...stampFor(lab, null) },
      { onConflict: "session_date" }
    );
    if (error) { toast.error("Couldn't reopen — try again."); return; }
    setFiled((f) => ({ ...f, [lab]: null }));
    toast(`${LAB_NAME[lab]} reopened — press Submit again when you're done.`);
    onSaved?.();
  };

  // From the reminder email ("tap Submit"): the half is written, hand it in.
  useEffect(() => {
    if (!autoSubmit || autoSubmitted.current || loadedFor.current !== date) return;
    if (filed[autoSubmit] || stillNeeds(autoSubmit).length) return;
    autoSubmitted.current = true;
    void submit(autoSubmit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmit, filed, caring, sharing, smileMoments, lifeMoments, date]);

  useEffect(() => {
    if (loadedFor.current !== date) return;
    const t = setTimeout(() => { void save(); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caring, sharing, smileMoments, lifeMoments, photos, date]);

  const onPickPhotos = async (files: FileList | null, lab: Lab) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadPhoto(f, lab));
      setPhotos((prev) => [...prev, ...urls]);
    } catch (e: any) {
      toast.error(e?.message || "Photo upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (lifeFileRef.current) lifeFileRef.current.value = "";
    }
  };
  const removePhoto = (url: string) => { setStatus("idle"); setPhotos((prev) => prev.filter((u) => u !== url)); };

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
              <div className="text-[11px] text-white/40">{isToday ? "Tonight's session" : "Session date · Tuesday"}</div>
            </div>
            <button onClick={() => onDateChange(shiftDate(date, 7))} title="Next week"
              className="h-9 w-9 grid place-items-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : <div className="font-semibold">{prettyDate(date)}</div>}
        <div className="flex items-center gap-3">
          {/* Any day picked snaps to its week's Tuesday — reports belong to sessions. */}
          <input type="date" value={date} onChange={(e) => e.target.value && onDateChange(sessionDateFor(e.target.value))}
            title="Reports belong to a Tuesday session; another day snaps to that week's Tuesday"
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
          <p className="text-sm text-white/40">No check-ins for this date. Kids sign in on the Juniors Aftercare kiosk.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {attendees.map((a, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-md bg-white/5 border border-white/10">{a.child_first_name} {a.child_last_name[0]}.</span>
            ))}
          </div>
        )}
      </div>

      {filed.smile && filed.life && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 mb-4">
          ✓ Both reports are in for {prettyDate(date)}. This week now lives under Past entries.
        </div>
      )}

      {/* The two labs, each with what was covered and its own standout moments.
          The moments are the kid stories the grant report quotes, one per line.
          A half is handed in with its Submit button (Josh, 2026-10-15); until
          then autosave only protects the typing. Submitted, it collapses to a
          summary with a Reopen link — never locked, coaches fix typos later. */}
      <div className="grid md:grid-cols-2 gap-4 mb-5">
        {([
          { lab: "smile" as Lab, emoji: "🦷", coach: "Coach Jaime", note: caring, setNote: setCaring, moments: smileMoments, setMoments: setSmileMoments, photoCount: smilePhotos.length,
            notePlaceholder: "Brushing, flossing, nutrition, hygiene, habits… how did it go?", momentPlaceholder: "e.g. Marcus taught his little brother how to floss all week!" },
          { lab: "life" as Lab, emoji: "😊", coach: "Coach Chrissy", note: sharing, setNote: setSharing, moments: lifeMoments, setMoments: setLifeMoments, photoCount: lifePhotos.length,
            notePlaceholder: "Manners, gratitude, kindness, handling bullying, serving others…", momentPlaceholder: "e.g. Ava stood up for a friend who was being teased." },
        ]).map((L) => {
          const filedAt = filed[L.lab];
          const momentCount = textToArray(L.moments).length;
          const needs = stillNeeds(L.lab);
          return (
            <div key={L.lab} className="rounded-2xl border bg-neutral-900/60 p-4 space-y-4" style={{ borderColor: `${LAB_COLOR[L.lab]}55`, borderLeftWidth: 4, borderLeftColor: LAB_COLOR[L.lab] }}>
              <label className="flex items-center gap-2 font-bold" style={{ color: LAB_COLOR[L.lab] }}>
                {L.emoji} {LAB_NAME[L.lab]} <span className="text-xs text-white/40 font-normal">· {L.coach}</span>
              </label>
              {filedAt ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-emerald-300/90">✓ Submitted {filedOn(filedAt)}</p>
                  <p className="text-sm text-white/70 whitespace-pre-wrap line-clamp-4">{L.note}</p>
                  <p className="text-xs text-white/40">
                    {momentCount} standout moment{momentCount === 1 ? "" : "s"} · {L.photoCount} photo{L.photoCount === 1 ? "" : "s"}
                  </p>
                  <button type="button" onClick={() => void reopen(L.lab)} className="text-xs underline text-white/50 hover:text-white">
                    Reopen to edit
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-white/40 font-semibold mb-1">What we covered</p>
                    <textarea value={L.note} onChange={(e) => L.setNote(dirty(e.target.value))} rows={5}
                      placeholder={L.notePlaceholder}
                      className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-white/40 font-semibold mb-1">⭐ Standout moments · one per line</p>
                    <textarea value={L.moments} onChange={(e) => L.setMoments(dirty(e.target.value))} rows={3}
                      onFocus={() => { if (!L.moments) L.setMoments("• "); }}
                      placeholder={L.momentPlaceholder}
                      className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40" />
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                    <p className="text-[11px] text-white/45">
                      {needs.length ? `Still needs ${needs.join(" and ")}.` : "Written. Wait for Saved ✓, then Submit."}
                    </p>
                    <button type="button" onClick={() => void submit(L.lab)} disabled={needs.length > 0 || submitting === L.lab || status === "saving"}
                      className="inline-flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-lg font-semibold text-black disabled:opacity-40"
                      style={{ background: LAB_COLOR[L.lab] }}>
                      {submitting === L.lab ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit {LAB_NAME[L.lab]}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-white/40 -mt-3 mb-2">Standout moments are the real kid wins, breakthroughs and quotes — each line becomes a featured story in the grant report.</p>
      {/* The reminder Josh asked for: autosave protects the typing, but only
          Submit hands the report in — and the 8 PM email keeps coming until it is. */}
      {!(filed.smile && filed.life) && (
        <p className="text-[12px] text-amber-200/90 mb-5 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2">
          ⚠️ Before you exit: wait for <span className="font-semibold">Saved ✓</span>, then press <span className="font-semibold">Submit</span> on your lab. A report that is written but not submitted keeps getting the 8 PM reminder.
        </p>
      )}

      {/* Photos — one panel per lab. */}
      <div className="grid md:grid-cols-2 gap-4">
        {([
          { lab: "smile" as Lab, title: "🦷 Smile Lab photos", list: smilePhotos, ref: fileRef },
          { lab: "life" as Lab, title: "😊 Life Lab photos", list: lifePhotos, ref: lifeFileRef },
        ]).map(({ lab, title, list, ref }) => (
          <div key={lab} className="rounded-2xl border bg-neutral-900/60 p-4" style={{ borderColor: `${LAB_COLOR[lab]}55`, borderLeftWidth: 4, borderLeftColor: LAB_COLOR[lab] }}>
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 font-bold" style={{ color: LAB_COLOR[lab] }}>📷 {title.replace(/^.. /, "")}</label>
              <input ref={ref} type="file" accept="image/*" multiple onChange={(e) => onPickPhotos(e.target.files, lab)} className="hidden" />
              <button onClick={() => ref.current?.click()} disabled={uploading}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-semibold text-black disabled:opacity-60" style={{ background: LAB_COLOR[lab] }}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Add photos
              </button>
            </div>
            {list.length === 0 ? (
              <p className="text-sm text-white/40">No photos yet. Snap a couple from today's session.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {list.map((url) => (
                  <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-white/10">
                    <img src={thumbOf(url)} alt="" loading="lazy" className="w-full h-full object-cover" />
                    <button onClick={() => removePhoto(url)}
                      className="absolute top-1 right-1 h-7 w-7 grid place-items-center rounded-md bg-black/60 hover:bg-red-600/80 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SmileLabSessionEditor;
