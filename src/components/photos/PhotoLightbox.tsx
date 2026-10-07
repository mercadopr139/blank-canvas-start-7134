// A photo viewer for a set of pictures: tap one, see it big, step through
// the rest with the arrows, the keyboard, or a swipe. Close with the button,
// a tap outside the picture, or Escape. The whole photo always fits.
//
// Shared by the aftercare journal, and anywhere else a row of thumbnails
// needs to open into a gallery rather than one tab per picture.
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LightboxPhoto {
  url: string;
  /** A small copy for the filmstrip; the full picture is used when absent. */
  thumb?: string;
  /** Shown above the picture when set. */
  title?: string;
}

interface Props {
  photos: LightboxPhoto[];
  /** Which photo is open; null keeps the viewer closed. */
  index: number | null;
  onChange: (index: number | null) => void;
}

const PhotoLightbox = ({ photos, index, onChange }: Props) => {
  const open = index != null && photos.length > 0;
  const i = Math.max(0, Math.min(index ?? 0, photos.length - 1));
  const prev = useCallback(() => { if (photos.length > 1) onChange((i - 1 + photos.length) % photos.length); }, [i, photos.length, onChange]);
  const next = useCallback(() => { if (photos.length > 1) onChange((i + 1) % photos.length); }, [i, photos.length, onChange]);
  const close = useCallback(() => onChange(null), [onChange]);

  // Keyboard: arrows step, Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, prev, next, close]);

  // Swipe on a tablet or phone.
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0]?.clientX ?? null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchX.current; touchX.current = null;
    const end = e.changedTouches[0]?.clientX;
    if (start == null || end == null) return;
    if (end - start > 50) prev(); else if (start - end > 50) next();
  };

  // Preload the neighbours so stepping feels instant.
  const [, setLoaded] = useState(0);
  useEffect(() => {
    if (!open) return;
    [i - 1, i + 1].forEach((n) => {
      const p = photos[(n + photos.length) % photos.length];
      if (p) { const img = new Image(); img.onload = () => setLoaded((x) => x + 1); img.src = p.url; }
    });
  }, [open, i, photos]);

  if (!open) return null;
  const photo = photos[i];
  const many = photos.length > 1;

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 md:p-8 animate-in fade-in duration-150 select-none"
      onClick={close} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} role="dialog" aria-label="Photo viewer">
      <div className="relative w-auto max-w-[94vw] h-[94vh] rounded-2xl bg-neutral-950 border border-white/15 shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* The title bar is its own row above the picture; the picture can never draw over it. */}
        <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/10 shrink-0 bg-neutral-950">
          <p className="font-bold text-sm md:text-base truncate text-white">
            {photo.title ?? "Photo"}
            {many && <span className="ml-2 text-white/45 font-normal tabular-nums">{i + 1} of {photos.length}</span>}
          </p>
          <Button onClick={close} className="h-9 px-3 font-bold text-white shrink-0" style={{ backgroundColor: "#bf0f3e" }}>
            <X className="w-4 h-4 mr-1" /> Close
          </Button>
        </div>
        <div className="relative flex-1 min-h-0 flex items-center justify-center bg-black">
          <img key={photo.url} src={photo.url} alt={photo.title ?? ""} className="block max-w-full max-h-full object-contain animate-in fade-in duration-150" />
          {many && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous photo"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center active:scale-95">
                <ChevronLeft className="w-7 h-7" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center active:scale-95">
                <ChevronRight className="w-7 h-7" />
              </button>
            </>
          )}
        </div>
        {many && (
          <div className="flex items-center justify-center gap-1.5 px-4 py-2 border-t border-white/10 shrink-0 overflow-x-auto">
            {photos.map((p, n) => (
              <button key={p.url + n} onClick={() => onChange(n)} aria-label={`Photo ${n + 1}`}
                className={`h-11 w-11 shrink-0 rounded-md overflow-hidden ring-2 transition-all ${n === i ? "ring-white" : "ring-transparent opacity-60 hover:opacity-100"}`}>
                <img src={p.thumb ?? p.url} alt="" loading="lazy" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoLightbox;
