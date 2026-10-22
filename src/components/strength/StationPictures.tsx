// "See the stations" on the Cardio Stations card (Josh, 2026-10-22): opened
// once before the first whistle, it shows every station's moves in order,
// start and finish, so a coach walks the group through them in half a minute
// and then starts the clock. Nobody stops mid-rotation to tap a TV. A move
// with no good picture says "Coach demo" instead of showing a wrong one.
import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { Image as ImageIcon, X } from "lucide-react";
import { fetchExerciseImage, exerciseImageKey, onePictureCue, showsVideo, PICTURE_BG } from "@/components/strength/ExercisePictures";
import ExercisePicturePicker from "@/components/strength/ExercisePicturePicker";
import { useCoachSignedIn } from "@/hooks/useCoachSignedIn";
import ExerciseVideo from "@/components/strength/ExerciseVideo";
import type { StationPicture } from "@/lib/nbtStations";

export default function StationPictures({ stations, color }: { stations: StationPicture[]; color: string }) {
  const [open, setOpen] = useState(false);
  const coach = useCoachSignedIn();
  const dataOf = (m: string) => results[moves.indexOf(m)]?.data;
  const moves = [...new Set(stations.flatMap((s) => s.moves))];
  const results = useQueries({
    queries: moves.map((m) => ({ queryKey: exerciseImageKey(m), queryFn: () => fetchExerciseImage(m), staleTime: 60 * 60_000 })),
  });
  const imagesOf = (m: string) => results[moves.indexOf(m)]?.data?.images ?? [];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  if (!moves.length) return null;
  const withMoves = stations.filter((s) => s.moves.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="See tonight's station moves"
        className="inline-flex items-center gap-[0.4em] rounded-full font-black uppercase tracking-wide leading-none text-black px-[0.8em] py-[0.45em] text-[0.55em] transition hover:brightness-110 hover:scale-[1.04] active:scale-95"
        style={{ background: color, boxShadow: `0 0 0 0.12em ${color}55, 0 0.25em 1.1em ${color}66` }}
      >
        <ImageIcon className="w-[1.15em] h-[1.15em]" strokeWidth={2.75} /> See the stations
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Tonight's station moves">
          <div className="w-full max-w-[min(94vw,1400px)] max-h-[82vh] flex flex-col rounded-2xl border-2 bg-[#141416] shadow-[0_1em_3em_rgba(0,0,0,0.7)] overflow-hidden" style={{ borderColor: `${color}99` }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/10">
              <p className="text-xl md:text-2xl font-black text-white">Tonight's stations <span className="text-white/45 text-base font-bold">· walk through them before the whistle</span></p>
              <button type="button" onClick={() => setOpen(false)} className="shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 font-black uppercase tracking-wide text-black hover:brightness-110" style={{ background: color }} aria-label="Back to the workout">
                <X className="w-5 h-5" strokeWidth={3} /> Back to the workout
              </button>
            </div>
            <div className="overflow-y-auto p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {withMoves.map((s) => (
                <div key={`${s.n}-${s.place}`} className="rounded-xl border border-white/12 bg-black/30 p-3 space-y-2">
                  <p className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color }}>
                    <span className="text-2xl font-black tracking-normal mr-2 align-[-0.1em]">{s.n}</span>{s.place}
                  </p>
                  {s.moves.map((m) => {
                    const imgs = imagesOf(m);
                    return (
                      <div key={m} className="space-y-1">
                        <p className="text-lg font-bold text-white capitalize">{m}</p>
                        {imgs.length ? (
                          <div className={`grid gap-2 ${imgs.length > 1 ? "grid-cols-2" : ""}`}>
                            {imgs.map((src, k) => (
                              <figure key={src} className="rounded-lg overflow-hidden border border-white/10" style={{ background: PICTURE_BG }}>
                                <img src={src} alt={`${m}: ${k === 0 ? "start" : "finish"}`} className="mx-auto block w-full h-auto object-contain max-h-[18vh]" loading="lazy" />
                                <figcaption className="bg-black/70 px-2 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/80">
                                  {imgs.length > 1 ? (k === 0 ? "Start" : "Finish") : onePictureCue(m, s.cue)}
                                </figcaption>
                              </figure>
                            ))}
                          </div>
                        ) : null}
                        {/* No picture, or one picture of a moving exercise: the demo video shows the motion. */}
                        {showsVideo(m, dataOf(m)) && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/55">Watch the full motion</p>
                            <ExerciseVideo name={m} inline quietWhenMissing swappable={coach} />
                          </div>
                        )}
                        {/* The coach, signed in: fix this station's picture or video right here. */}
                        {coach && <ExercisePicturePicker name={m} single />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {/* The one credit line RepDB's free license asks for. */}
            <div className="px-4 pb-3"><p className="text-center text-[11px] text-white/40" onClick={(e) => e.stopPropagation()}>Exercise pictures by <a href="https://repdb.co" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white/70">RepDB (repdb.co)</a></p></div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
