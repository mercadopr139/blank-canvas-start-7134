// A kid-safe demo video for an exercise, found by the find-exercise-video edge
// function (which caches the pick). Shows a thumbnail; tapping opens an in-app
// pop-up player — the page stays underneath — with a Close button.
//
// Shared by the coach's page and the gym screen. On the screen it sits inside
// a column that is shrunk to fit the wall, so `compact` sizes the play icon
// and label in em rather than pixels and they scale with the column.
import { useEffect, useState } from "react";
import { PlayCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ExerciseVideo = ({ name, compact = false }: { name: string; compact?: boolean }) => {
  const [loading, setLoading] = useState(true);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase.functions
      .invoke("find-exercise-video", { body: { name } })
      .then(({ data }) => {
        if (alive) {
          setVideoId((data as { youtube_id?: string })?.youtube_id ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setVideoId(null);
          setLoading(false);
        }
      });
    return () => { alive = false; };
  }, [name]);

  // While the pop-up is open: lock scroll + close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " proper form technique")}`;
  const icon = compact ? "w-[2.2em] h-[2.2em]" : "w-14 h-14";
  const label = compact ? "text-[0.6em]" : "text-xs";

  return (
    <>
      <div className="rounded-lg overflow-hidden border border-white/10 bg-black/40 w-full">
        {videoId ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group relative block w-full"
            style={{ aspectRatio: "16 / 9" }}
            title="Play proper-form demo"
          >
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt={`${name} demo`}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 transition group-hover:bg-black/25">
              <PlayCircle className={`${icon} text-white drop-shadow-lg`} />
              <span className={`${label} font-semibold text-white/90 drop-shadow`}>See proper form</span>
            </span>
          </button>
        ) : (
          <a
            href={searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-2 text-sky-300 hover:text-sky-200 font-semibold ${compact ? "text-[0.7em]" : "text-sm"}`}
            style={{ aspectRatio: "16 / 9" }}
          >
            <PlayCircle className={compact ? "w-[1.2em] h-[1.2em]" : "w-5 h-5"} /> {loading ? "Finding demo…" : "Watch demo"}
          </a>
        )}
      </div>

      {/* In-app pop-up player */}
      {open && videoId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-10 right-0 flex items-center gap-1 text-sm text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" /> Close
            </button>
            <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16 / 9" }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1&origin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`}
                title={`${name} demo`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-white/50 hover:text-white/80"
            >
              Trouble playing? Open on YouTube ↗
            </a>
          </div>
        </div>
      )}
    </>
  );
};

export default ExerciseVideo;
