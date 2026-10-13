// The demo video an Extra Work exercise will show, with a way to swap it.
//
// Sits under each Extra Work row in Edit tonight on the Battle Team board.
// Shows the current pick (thumbnail and title) so the coach can see what
// the kids will get; "New video" throws it out and the finder brings one
// not offered before (Josh, 2026-10-13: "standing dumbbell press" was
// showing a seated press). Tap again for another. The board's thumbnail
// picks the new one up as soon as editing ends.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ExerciseVideoPicker = ({ name, accent = "#fb7185" }: { name: string; accent?: string }) => {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();

  useEffect(() => {
    let alive = true;
    if (!trimmed) { setVideoId(null); setTitle(null); setLoading(false); return; }
    setLoading(true);
    supabase.functions
      .invoke("find-exercise-video", { body: { name: trimmed } })
      .then(({ data }) => {
        if (!alive) return;
        const d = data as { youtube_id?: string | null; title?: string | null };
        setVideoId(d?.youtube_id ?? null);
        setTitle(d?.title ?? null);
        setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [trimmed]);

  const refresh = async () => {
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("find-exercise-video", { body: { name: trimmed, refresh: true } });
      if (error) throw error;
      const d = data as { youtube_id?: string | null; title?: string | null; error?: string };
      if (d?.error && !d.youtube_id) throw new Error(d.error);
      setVideoId(d?.youtube_id ?? null);
      setTitle(d?.title ?? null);
      toast.success(d?.title ? `New video: ${d.title}` : "New video picked.");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn't find another video.");
    } finally {
      setBusy(false);
    }
  };

  if (!trimmed) return null;

  return (
    <div className="flex items-center gap-2 pl-1 -mt-0.5">
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-white/40 shrink-0" />
      ) : videoId ? (
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noreferrer"
          title="Open on YouTube"
          className="shrink-0 rounded overflow-hidden border border-white/15"
        >
          <img src={`https://i.ytimg.com/vi/${videoId}/default.jpg`} alt="" className="w-12 h-9 object-cover" />
        </a>
      ) : (
        <span className="w-12 h-9 rounded bg-white/5 border border-white/10 shrink-0" />
      )}
      <p className="flex-1 min-w-0 text-[11px] leading-tight text-white/50 truncate">
        {loading ? "Finding the demo video…" : title ? title : videoId ? "Demo video" : "No demo video found yet"}
      </p>
      {videoId && (
        <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" className="text-white/35 hover:text-white shrink-0" title="Open on YouTube" aria-label="Open on YouTube">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
      <button
        type="button"
        onClick={refresh}
        disabled={busy || loading}
        className="shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition-colors hover:bg-white/10 disabled:opacity-50"
        style={{ borderColor: `${accent}77`, color: accent }}
        title="Throw this video out and find another"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        New video
      </button>
    </div>
  );
};

export default ExerciseVideoPicker;
