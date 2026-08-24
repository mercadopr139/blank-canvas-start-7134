import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Pencil } from "lucide-react";

// Read-only review of the Smile Lab weekly journals (what coaches wrote on the
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
  const { data: sessions = [], isLoading } = useQuery({
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

  if (isLoading) return <p className="text-center py-8 text-white/40">Loading journal…</p>;
  if (withContent.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/40">
        No journal entries yet. Coaches write these on the Smile Lab Board after each session.
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
                <div className="text-xs font-semibold text-teal-300 mb-1">🦷 Caring for Your Smile</div>
                <p className="text-sm text-white/80 whitespace-pre-wrap">{s.caring_note}</p>
              </div>
            )}
            {s.sharing_note?.trim() && (
              <div className="rounded-lg bg-white/5 p-3">
                <div className="text-xs font-semibold text-yellow-300 mb-1">😊 Sharing Your Smile</div>
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
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 rounded-lg overflow-hidden border border-white/10">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SmileLabJournalReview;
