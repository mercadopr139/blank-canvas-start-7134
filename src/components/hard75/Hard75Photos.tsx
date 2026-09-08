// The photo timeline — the reason for taking one every single day.
//
// Day-to-day the changes are invisible; across seventy-five they are the whole
// story. So the grid is secondary and the scrubber is the point: one big image,
// arrow keys or a drag of the slider, and the change plays like a flipbook.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Images, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Hard75Run, Hard75Day, STRENGTH_COLOR } from "@/lib/hard75";
import { Hard75Api } from "@/lib/hard75Api";

const Hard75Photos = ({ run, days, api }: { run: Hard75Run; days: Hard75Day[]; api: Hard75Api }) => {
  const withPhotos = useMemo(
    () => days.filter((d) => d.photo_path).sort((a, b) => a.day_number - b.day_number),
    [days]
  );
  const [index, setIndex] = useState(0);

  // Signed URLs, because the bucket is private — these are body photos and they
  // never sit on a public path.
  const { data: urls = {}, isLoading } = useQuery({
    queryKey: ["hard75-photo-urls", run.id, withPhotos.map((d) => d.photo_path).join(",")],
    enabled: withPhotos.length > 0,
    // An hour is plenty for a session and short enough that a copied link dies.
    staleTime: 45 * 60 * 1000,
    queryFn: () => api.signedUrls(withPhotos.map((d) => d.photo_path!) as string[]),
  });

  const clamped = Math.min(index, Math.max(0, withPhotos.length - 1));
  const currentDay = withPhotos[clamped];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(withPhotos.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [withPhotos.length]);

  if (withPhotos.length === 0) {
    return (
      <div className="text-center py-16 text-white/35">
        <Images className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>No photos yet. One a day, and by November this is the part worth having.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
          <div>
            <p className="font-bold">Day {currentDay?.day_number}</p>
            <p className="text-xs text-white/35">
              {currentDay && format(new Date(`${currentDay.date}T12:00:00`), "EEEE d MMMM")}
            </p>
          </div>
          <p className="text-xs text-white/35">
            {clamped + 1} of {withPhotos.length}
          </p>
        </div>

        <div className="relative bg-black grid place-items-center min-h-[320px] max-h-[62vh]">
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-white/30" />
          ) : (
            currentDay?.photo_path && urls[currentDay.photo_path] && (
              <img
                src={urls[currentDay.photo_path]}
                alt={`Day ${currentDay.day_number}`}
                className="max-h-[62vh] w-auto object-contain"
              />
            )
          )}

          <Button
            variant="ghost" size="icon"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={clamped === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-black/80 disabled:opacity-20"
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            onClick={() => setIndex((i) => Math.min(withPhotos.length - 1, i + 1))}
            disabled={clamped >= withPhotos.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-black/80 disabled:opacity-20"
            aria-label="Next photo"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Drag this and the seventy-five days play as one motion. */}
        <div className="px-4 py-3">
          <input
            type="range"
            min={0}
            max={Math.max(0, withPhotos.length - 1)}
            value={clamped}
            onChange={(e) => setIndex(Number(e.target.value))}
            className="w-full accent-[#bf0f3e]"
            aria-label="Scrub through the photos"
          />
          <div className="flex justify-between text-[10px] text-white/25 mt-1">
            <span>Day {withPhotos[0]?.day_number}</span>
            <span>Day {withPhotos[withPhotos.length - 1]?.day_number}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
        {withPhotos.map((d, i) => (
          <button
            key={d.id}
            onClick={() => setIndex(i)}
            className={`aspect-square rounded-lg overflow-hidden border transition-colors ${
              i === clamped ? "border-white/60" : "border-white/10 hover:border-white/30"
            }`}
            title={`Day ${d.day_number}`}
          >
            {d.photo_path && urls[d.photo_path] ? (
              <img src={urls[d.photo_path]} alt={`Day ${d.day_number}`} className="w-full h-full object-cover" />
            ) : (
              <span
                className="w-full h-full grid place-items-center text-[10px] font-bold"
                style={{ color: STRENGTH_COLOR }}
              >
                {d.day_number}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Hard75Photos;
