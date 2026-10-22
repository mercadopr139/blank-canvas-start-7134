// Edit tonight: the picture the kids will see for a lift, and the coach's ways
// to fix it (Josh, 2026-10-22) — the next best match, a pick from the
// library's closest entries, NLA's own picture, or no picture at all. A fix
// holds for that exercise on every board from then on.
import { useEffect, useState } from "react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, LayoutGrid, Upload, EyeOff, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { movements, fetchExerciseImage, exerciseImageKey, type ExerciseImage } from "@/components/strength/ExercisePictures";

type Candidate = { id: string; name: string; thumb: string };

const call = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("find-exercise-image", { body });
  if (error) {
    let reason = error.message;
    try { const res = (error as { context?: Response }).context; const said = res ? await res.clone().json() : null; if (said?.error) reason = said.error; } catch { /* generic */ }
    throw new Error(reason);
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

function One({ name }: { name: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [choices, setChoices] = useState<Candidate[] | null>(null);
  const key = exerciseImageKey(name);
  const [{ data }] = useQueries({ queries: [{ queryKey: key, queryFn: () => fetchExerciseImage(name), staleTime: 60 * 60_000 }] });

  const set = (d: ExerciseImage) => qc.setQueryData(key, d);
  const act = async (label: string, body: Record<string, unknown>, done: string) => {
    setBusy(label);
    try { const d = await call({ name, ...body }); set(d as ExerciseImage); setChoices(null); toast.success(done); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };
  const browse = async () => {
    setBusy("browse");
    try { const d = await call({ name, candidates: true }); setChoices((d as { candidates: Candidate[] }).candidates ?? []); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };
  const upload = async (file: File) => {
    setBusy("upload");
    try {
      const path = `uploads/${Date.now()}_${file.name.replace(/[^\w.-]+/g, "_").slice(0, 60)}`;
      const { error } = await supabase.storage.from("exercise-images").upload(path, file, { contentType: file.type || "image/jpeg" });
      if (error) throw new Error(error.message);
      const d = await call({ name, upload: path });
      set(d as ExerciseImage);
      toast.success("Your picture is on the wall for this lift.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const addFinish = async (file: File) => {
    setBusy("finish");
    try {
      const path = `uploads/${Date.now()}_finish_${file.name.replace(/[^\w.-]+/g, "_").slice(0, 60)}`;
      const { error } = await supabase.storage.from("exercise-images").upload(path, file, { contentType: file.type || "image/jpeg" });
      if (error) throw new Error(error.message);
      const d = await call({ name, add_finish: path });
      set(d as ExerciseImage);
      toast.success("Finish picture added. The wall now shows the start and the finish.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };
  const imgs = data?.images ?? [];
  const btn = "inline-flex items-center gap-1 text-[12px] text-white/60 hover:text-white disabled:opacity-40";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {imgs.length ? imgs.map((src) => <img key={src} src={src} alt="" className="h-14 w-20 object-cover rounded-md border border-white/10" />) : (
          <span className="text-[12px] text-white/40">{data ? "No picture for this lift." : "Finding a picture…"}</span>
        )}
        <span className="text-[11px] text-white/40">{data?.exercise ? `Showing: ${data.exercise}` : name}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btn} disabled={!!busy} onClick={() => void act("next", { refresh: true }, "Picked the next best picture.")}>
          {busy === "next" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Wrong? Next best
        </button>
        <button type="button" className={btn} disabled={!!busy} onClick={() => void browse()}>
          {busy === "browse" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LayoutGrid className="w-3.5 h-3.5" />} Choose from the library
        </button>
        {imgs.length === 1 && data?.source !== "upload" && (
          <label className={`${btn} cursor-pointer font-semibold text-amber-200 hover:text-amber-100`}>
            {busy === "finish" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Add a finish picture
            <input type="file" accept="image/*" className="hidden" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void addFinish(f); e.target.value = ""; }} />
          </label>
        )}
        <label className={`${btn} cursor-pointer`}>
          {busy === "upload" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload our own
          <input type="file" accept="image/*" className="hidden" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        </label>
        {imgs.length > 0 && (
          <button type="button" className={btn} disabled={!!busy} onClick={() => void act("none", { none: true }, "No picture for this lift.")}>
            <EyeOff className="w-3.5 h-3.5" /> No picture
          </button>
        )}
      </div>
      {/* The demo video under the picture: automatic, always, or never (Josh, 2026-10-22). */}
      {data && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
          <Video className="w-3.5 h-3.5 text-white/50" />
          <span className="text-white/50">Video:</span>
          {([["auto", "Auto"], ["show", "Add video"], ["hide", "Hide video"]] as const).map(([v, label]) => {
            const on = (data.video ?? "auto") === v;
            return (
              <button key={v} type="button" disabled={!!busy || on} onClick={() => void act("video", { video: v }, v === "show" ? "The demo video shows for this move." : v === "hide" ? "No video for this move." : "The video shows only when the picture can't show the motion.")}
                className={`rounded-full px-2.5 py-0.5 font-semibold border ${on ? "border-white/60 bg-white/15 text-white" : "border-white/15 text-white/60 hover:text-white hover:bg-white/10"}`}>
                {label}
              </button>
            );
          })}
        </div>
      )}
      {choices && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
          {choices.length === 0 && <p className="col-span-full text-[12px] text-white/40">Nothing close in the library. Upload your own.</p>}
          {choices.map((c) => (
            <button key={c.id} type="button" disabled={!!busy} onClick={() => void act("choose", { choose: c.id }, `Using "${c.name}".`)} className="rounded-lg overflow-hidden border border-white/10 hover:border-white/50 text-left">
              <img src={c.thumb} alt="" className="w-full h-16 object-cover" loading="lazy" />
              <p className="px-1.5 py-1 text-[10px] leading-tight text-white/75">{c.name}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Every movement of a lift ("A + B" gets a picker for each). `single`: one move, inside a picture panel. */
export default function ExercisePicturePicker({ name, single = false }: { name: string; single?: boolean }) {
  if (single) return (
    <div className="mt-2 rounded-lg border border-dashed border-white/20 bg-black/30 p-2" onClick={(e) => e.stopPropagation()}>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Coach · fix this picture or video</p>
      <One name={name} />
    </div>
  );
  return <PickerFor name={name} />;
}

function PickerFor({ name }: { name: string }) {
  // Typing a lift name must not look up "Barb", "Barbe", "Barbel": wait until it settles.
  const [settled, setSettled] = useState(name);
  useEffect(() => { const t = window.setTimeout(() => setSettled(name), 1200); return () => window.clearTimeout(t); }, [name]);
  const parts = movements(settled);
  if (!parts.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">The picture the kids see</p>
      {parts.map((p) => <One key={p} name={p} />)}
    </div>
  );
}
