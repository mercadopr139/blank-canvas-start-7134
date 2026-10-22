// Start-and-finish pictures for a lift, on the gym walls (Josh, 2026-10-22).
// Most of the youth have never done tonight's lift, so one tap shows them the
// position before they pick up the bar. The same button sits next to every
// lift on the Battle Team and Non-Battle Team boards; the pictures come from
// the find-exercise-image edge function (cached per exercise name).
//
// A combined lift ("Barbell RDL + Assisted Pull-Up") shows each movement.
// Nothing found for any movement: no button at all, never a wrong picture.
import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { Image as ImageIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ExerciseVideo from "@/components/strength/ExerciseVideo";
import ExercisePicturePicker from "@/components/strength/ExercisePicturePicker";
import { useCoachSignedIn } from "@/hooks/useCoachSignedIn";

export interface ExerciseImage { images: string[]; exercise: string | null; source?: string; credit?: string | null; /** 'auto' | 'show' | 'hide' — the coach's call on the demo video. */ video?: string }

/** Whether a move's demo video shows: the coach's choice, or (auto) only when the picture can't show the motion. */
export const showsVideo = (move: string, d: ExerciseImage | undefined) => {
  const n = d?.images?.length ?? 0;
  if (d?.video === "show") return true;
  if (d?.video === "hide") return false;
  return n === 0 || (n === 1 && !isSteadyMove(move));
};

/** "Barbell RDL + Assisted Pull-Up" → the two movements, each looked up on its own. */
export const movements = (name: string) =>
  name.split(/\s+(?:\+|&)\s+|\s*\+\s*/).map((x) => x.trim()).filter(Boolean);

export const fetchExerciseImage = async (name: string): Promise<ExerciseImage> => {
  const { data, error } = await supabase.functions.invoke("find-exercise-image", { body: { name } });
  if (error) return { images: [], exercise: null };
  return data as ExerciseImage;
};

export const exerciseImageKey = (name: string) => ["exercise-image", name.trim().toLowerCase()];

/** Holds, carries and steady machines: one picture is the whole story. Anything else with one picture (or none) gets its demo video too. */
export const isSteadyMove = (move: string) => /\b(hold|plank|hollow|wall sit|isometric|hang|carry|walk|farmer|bike|cycl|rowing machine|row machine|rower|ski erg|erg|treadmill)\b/i.test(move);

/** The light blue the library's drawings sit on: a lone picture fills its card with it. */
export const PICTURE_BG = "#dff1fb";

/**
 * Under a one-picture move, what to do with it — so a single picture never
 * looks like half of something (Josh, 2026-10-22). The plan's own cue wins.
 */
/** Moves whose one picture shows only half the motion: the strip says the whole of it. */
const MOTION: [RegExp, string][] = [
  [/\bwall ?balls?\b/i, "Squat deep · drive up · throw it to the target"],
  [/\b(med(icine)? ball|ball) slam\b/i, "Ball overhead · slam it down hard"],
  [/\bthruster\b/i, "Squat · drive up · press overhead"],
  [/\bbox jump\b/i, "Swing arms · jump · land soft on the box"],
  [/\bburpee\b/i, "Drop to the floor · push up · jump up"],
];

export const onePictureCue = (move: string, cue?: string | null) => {
  // A move whose picture is half the motion says the whole motion, before any station-wide cue.
  for (const [re, line] of MOTION) if (re.test(move)) return line;
  if (cue?.trim()) return cue.trim();
  if (/\b(hold|plank|hollow|wall sit|isometric|hang)\b/i.test(move)) return "Hold this position";
  if (/\b(carry|walk|farmer)\b/i.test(move)) return "Walk tall, shoulders back";
  if (/\b(bike|cycl|row|rower|ski|erg|treadmill)\b/i.test(move)) return "Steady pace the whole time";
  return "Copy this position";
};

export default function ExercisePictures({ name, color, compact = false }: { name: string; color?: string; compact?: boolean }) {
  const parts = movements(name);
  const results = useQueries({
    queries: parts.map((p) => ({ queryKey: exerciseImageKey(p), queryFn: () => fetchExerciseImage(p), staleTime: 60 * 60_000 })),
  });
  // Every movement is shown: its library picture(s), and — when the library has none, or one picture
  // of a moving exercise (the wall ball's squat without the throw) — its demo video (Josh, 2026-10-22).
  const shown = parts.map((p, i) => ({ part: p, data: results[i]?.data ?? { images: [], exercise: null } }));
  const [open, setOpen] = useState(false);
  const coach = useCoachSignedIn();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  if (!parts.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`See how to do ${name}`}
        // Solid in the lane colour, dark text, a soft glow: it has to read as "tap me" from across the gym.
        className={`inline-flex items-center gap-[0.4em] rounded-full font-black uppercase tracking-wide leading-none text-black transition hover:brightness-110 hover:scale-[1.04] active:scale-95 ${compact ? "px-[0.75em] py-[0.45em] text-[0.85em]" : "px-4 py-2 text-base"}`}
        style={{ background: color ?? "#ffffff", boxShadow: `0 0 0 0.12em ${color ?? "#ffffff"}55, 0 0.25em 1.1em ${color ?? "#ffffff"}66` }}
      >
        <ImageIcon className={compact ? "w-[1.15em] h-[1.15em]" : "w-5 h-5"} strokeWidth={2.75} /> See it
      </button>
      {open && createPortal(
        // A panel over a light dim, not a takeover: the workout stays in view all around it,
        // so the kids can see where they are going back to (Josh, 2026-10-22).
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label={`How to do ${name}`}>
          <div
            className="w-full max-w-[min(92vw,1100px)] max-h-[78vh] flex flex-col rounded-2xl border-2 bg-[#141416] shadow-[0_1em_3em_rgba(0,0,0,0.7)] overflow-hidden"
            style={{ borderColor: `${color ?? "#ffffff"}99` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/10">
              <p className="text-xl md:text-2xl font-black" style={{ color: color ?? "#ffffff" }}>{name}</p>
              <button type="button" onClick={() => setOpen(false)} className="shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 font-black uppercase tracking-wide text-black hover:brightness-110" style={{ background: color ?? "#ffffff" }} aria-label="Back to the workout">
                <X className="w-5 h-5" strokeWidth={3} /> Back to the workout
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-5">
              {shown.map(({ part, data }) => (
                <div key={part} className="space-y-2">
                  {shown.length > 1 && <p className="text-lg md:text-xl font-bold" style={{ color: color ?? "#ffffff" }}>{part}</p>}
                  <div className={`grid gap-3 ${data!.images.length > 1 ? "grid-cols-2" : ""}`}>
                    {data!.images.map((src, k) => (
                      <figure key={src} className="rounded-xl overflow-hidden border border-white/10" style={{ background: PICTURE_BG }}>
                        <img src={src} alt={`${part}: ${data!.images.length > 1 ? (k === 0 ? "start" : "finish") : "how to"}`} className={`mx-auto block w-full h-auto object-contain ${shown.length > 1 ? "max-h-[24vh]" : "max-h-[46vh]"}`} loading="lazy" />
                        <figcaption className="bg-black/70 px-3 py-1.5 text-sm md:text-base font-black uppercase tracking-[0.18em] text-white/85">
                          {data!.images.length > 1 ? (k === 0 ? "Start" : "Finish") : onePictureCue(part)}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                  {showsVideo(part, data) && (
                    <div className="max-w-2xl" onClick={(e) => e.stopPropagation()}>
                      <p className="mb-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/55">Watch the full motion</p>
                      <ExerciseVideo name={part} inline quietWhenMissing swappable={coach} />
                    </div>
                  )}
                  {/* The coach, signed in: fix the picture or the video right here. */}
                  {coach && <ExercisePicturePicker name={part} single />}
                </div>
              ))}
              {/* The one credit line RepDB's free license asks for. */}
              <p className="text-center text-[11px] text-white/40" onClick={(e) => e.stopPropagation()}>Exercise pictures by <a href="https://repdb.co" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white/70">RepDB (repdb.co)</a></p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
