// Verse of the Day as a strip for a wall board that has no team meeting.
//
// Tuesday has no team meeting, so the Non-Battle Team's Workout Plan is the
// first thing the kids read that night — the verse goes at the top of it.
// Same verse, same engine, same pop-up as the Gym Board: a PUBLISHED themed
// verse for this weekday wins and opens the discussion (context, who's who,
// the one question, the script read out loud); otherwise the classic daily
// verse stands in; and a signed-in admin with no theme sees the nudge.
// (Josh, 2026-10-03.)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import VerseDiscussion, { type DiscussionDay, type DiscussionFigure } from "@/components/verse/VerseDiscussion";

const TEAL_LIGHT = "#2dd4bf";

export const VerseOfTheDayStrip = ({ weekStart, weekday }: { weekStart: string; weekday: number }) => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState<DiscussionDay | null>(null);

  // The themed verse for this weekday of this week — published only, so a
  // draft never reaches the wall.
  const { data: themed } = useQuery({
    queryKey: ["board-verse-week", weekStart, weekday],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: wk } = await supabase
        .from("board_verse_weeks" as never)
        .select("theme, is_published")
        .eq("week_start", weekStart)
        .maybeSingle();
      const week = (wk as unknown as { theme: string; is_published: boolean } | null) ?? null;
      if (!week?.is_published) return { published: false, day: null as DiscussionDay | null };
      const { data: dayRow } = await supabase
        .from("board_verse_days" as never)
        .select("reference, text, context, figures, questions, answers")
        .eq("week_start", weekStart)
        .eq("weekday", weekday)
        .maybeSingle();
      const d = dayRow as unknown as
        | { reference: string; text: string; context: string | null; figures: DiscussionFigure[]; questions: string[]; answers: string[] }
        | null;
      return {
        published: true,
        day: d
          ? ({ reference: d.reference, text: d.text, context: d.context, figures: d.figures ?? [], questions: d.questions ?? [], answers: d.answers ?? [] } as DiscussionDay)
          : null,
      };
    },
  });

  // Today's classic verse — the same row the office's Daily Verse shows.
  const now = new Date();
  const { data: daily } = useQuery({
    queryKey: ["board-verse", `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`],
    queryFn: async () => {
      const { data } = await supabase
        .from("calendar_verses")
        .select("reference, text")
        .eq("year", now.getFullYear())
        .eq("month", now.getMonth() + 1)
        .eq("day", now.getDate())
        .eq("is_trashed", false)
        .maybeSingle();
      return (data as { reference: string; text: string } | null) ?? null;
    },
  });

  const themedDay = themed?.published ? themed.day : null;

  // One quiet line: a small teal label, the verse, the reference. The board
  // was just made calm; this must not make it busy again. The pop-up carries
  // the full text, so the strip only has to be readable and tappable.
  const frame = "shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left w-full flex items-baseline gap-3 min-w-0";
  const label = (
    <span className="text-[10px] font-bold uppercase tracking-[0.2em] shrink-0" style={{ color: TEAL_LIGHT }}>
      Verse of the day
    </span>
  );

  let body: React.ReactNode = null;
  if (themedDay) {
    body = (
      <button onClick={() => setOpen(themedDay)} className={`${frame} group`}>
        {label}
        <span className="flex-1 min-w-0 truncate text-sm text-white/70 group-hover:text-white/90 transition-colors">
          &ldquo;{themedDay.text}&rdquo; <span className="text-white/45">&mdash; {themedDay.reference}</span>
        </span>
        <span className="text-[9px] rounded-full px-1.5 py-0.5 font-semibold shrink-0" style={{ color: TEAL_LIGHT, background: `${TEAL_LIGHT}1a` }}>
          Tap to discuss
        </span>
      </button>
    );
  } else if (isAdmin && !themed?.published) {
    body = (
      <button onClick={() => navigate("/admin/operations/practice-plan")} className={frame}>
        {label}
        <span className="flex-1 min-w-0 truncate text-xs text-amber-300/80">No theme set this week — tap to generate this week&apos;s Bible topic.</span>
      </button>
    );
  } else if (daily) {
    body = (
      <div className={frame}>
        {label}
        <span className="flex-1 min-w-0 truncate text-sm text-white/60">
          &ldquo;{daily.text}&rdquo; <span className="text-white/40">&mdash; {daily.reference}</span>
        </span>
      </div>
    );
  }

  return (
    <>
      {body}
      <VerseDiscussion day={open} onClose={() => setOpen(null)} />
    </>
  );
};
