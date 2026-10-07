import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PhotoLightbox from "@/components/photos/PhotoLightbox";
import { thumbOf, isShrunk } from "@/lib/imageResize";
import { uploadAftercarePhoto } from "@/lib/aftercarePhotos";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Pencil } from "lucide-react";

// Read-only review of the Juniors Aftercare weekly journals (what coaches wrote on the
// board). Newest first; skips fully-empty sessions. Phase 2 turns this into the
// AI grant report.

interface SessionRow {
  id: string;
  session_date: string;
  caring_note: string | null;
  sharing_note: string | null;
  highlights: string[];
  photos: string[];
}

const hasContent = (s: SessionRow) =>
  !!(s.caring_note?.trim() || s.sharing_note?.trim() || (s.highlights?.length) || (s.photos?.length));

const SmileLabJournalReview = ({ onEdit }: { onEdit?: (date: string) => void }) => {
  // The photos of one entry, open in the viewer, stepped through with the arrows.
  const [gallery, setGallery] = useState<{ title: string; photos: string[]; index: number } | null>(null);

  // Photos stored before shrinking existed: fetch, shrink, store both sizes,
  // and point the session at the new full picture.
  const [shrinking, setShrinking] = useState(false);
  const shrinkAll = async (sessions: Array<{ id: string; session_date: string; photos: string[] }>) => {
    setShrinking(true);
    let done = 0;
    try {
      for (const s of sessions) {
        const photos = s.photos ?? [];
        if (!photos.some((u) => !isShrunk(u))) continue;
        const next: string[] = [];
        for (const url of photos) {
          if (isShrunk(url)) { next.push(url); continue; }
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Couldn't fetch a photo (${res.status}).`);
          next.push(await uploadAftercarePhoto(await res.blob(), url.includes("/life/") ? "life" : "smile"));
          done++;
        }
        const { error } = await (supabase.from("smile_lab_sessions" as never) as never as {
          update: (v: unknown) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> };
        }).update({ photos: next }).eq("id", s.id);
        if (error) throw new Error(error.message);
      }
      toast.success(`Shrunk ${done} photo${done === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.error(`${(e as Error).message} (${done} done)`);
    } finally {
      setShrinking(false);
      refetch();
    }
  };
  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ["smile-lab-journal"],
    queryFn: async (): Promise<SessionRow[]> => {
      const { data, error } = await (supabase.from("smile_lab_sessions" as never) as any)
        .select("id, session_date, caring_note, sharing_note, highlights, photos")
        .order("session_date", { ascending: false });
      if (error) throw error;
      return (data as SessionRow[]) ?? [];
    },
  });

  const withContent = sessions.filter(hasContent);
  const unshrunk = withContent.filter((x) => (x.photos ?? []).some((u) => !isShrunk(u)));
  const unshrunkCount = unshrunk.reduce((n, x) => n + (x.photos ?? []).filter((u) => !isShrunk(u)).length, 0);

  if (isLoading) return <p className="text-center py-8 text-white/40">Loading journal…</p>;
  if (withContent.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/40">
        No journal entries yet. Coaches write these on the Juniors Aftercare Board after each session.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {unshrunkCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm">
          <span className="text-amber-200">{unshrunkCount} photo{unshrunkCount === 1 ? " is" : "s are"} still full phone size and slow to open.</span>
          <Button size="sm" onClick={() => shrinkAll(unshrunk as never)} disabled={shrinking} className="ml-auto h-8 bg-amber-500 hover:bg-amber-400 text-black font-bold">
            {shrinking ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}{shrinking ? "Shrinking…" : "Shrink photos"}
          </Button>
        </div>
      )}
      {withContent.map((s) => (
        <div key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-bold text-white">{format(new Date(s.session_date + "T00:00:00"), "EEEE, MMMM d, yyyy")}</h3>
            {onEdit && (
              <button onClick={() => onEdit(s.session_date)}
                className="ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/15 text-white/70">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {s.caring_note?.trim() && (
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-xs font-semibold text-teal-300 mb-1">🦷 Smile Lab (Coach Jaime)</div>
                <p className="text-sm text-white/80 whitespace-pre-wrap">{s.caring_note}</p>
              </div>
            )}
            {s.sharing_note?.trim() && (
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-xs font-semibold text-rose-300 mb-1">😊 Life Lab (Coach Chrissy)</div>
                <p className="text-sm text-white/80 whitespace-pre-wrap">{s.sharing_note}</p>
              </div>
            )}
          </div>

          {s.highlights?.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-white/50 mb-1">⭐ Standout Moments</div>
              <ul className="list-disc list-inside text-sm text-white/80 space-y-0.5">
                {s.highlights.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}

          {s.photos?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {s.photos.map((url, i) => (
                <button key={i} type="button"
                  onClick={() => setGallery({ title: format(new Date(s.session_date + "T00:00:00"), "EEEE, MMMM d, yyyy"), photos: s.photos, index: i })}
                  className="block h-20 w-20 rounded-lg overflow-hidden border border-white/10 hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/50"
                  aria-label={`Open photo ${i + 1} of ${s.photos.length}`}>
                  <img src={thumbOf(url)} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {gallery && (
        <PhotoLightbox
          photos={gallery.photos.map((url) => ({ url, thumb: thumbOf(url), title: gallery.title }))}
          index={gallery.index}
          onChange={(i) => setGallery(i == null ? null : { ...gallery, index: i })}
        />
      )}
    </div>
  );
};

export default SmileLabJournalReview;
