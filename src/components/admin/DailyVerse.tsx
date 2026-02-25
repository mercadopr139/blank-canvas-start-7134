import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type CalendarVerseRow = {
  id: string;
  year: number;
  month: number;
  day: number;
  reference: string;
  text: string;
  theme: string | null;
  is_trashed: boolean;
};

export default function DailyVerse() {
  const today = useMemo(() => new Date(), []);
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const d = today.getDate();

  const [verse, setVerse] = useState<CalendarVerseRow | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("calendar_verses")
        .select("id,year,month,day,reference,text,theme,is_trashed")
        .eq("year", y)
        .eq("month", m)
        .eq("day", d)
        .eq("is_trashed", false)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("DailyVerse load error:", error);
        setMissing(true);
        return;
      }

      if (!data) {
        setMissing(true);
        return;
      }

      setVerse(data);
      setMissing(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [y, m, d]);

  const displayText = verse?.text ?? (missing ? "Daily verse not set for today yet." : "Loading today's verse…");
  const displayRef = verse?.reference ?? (missing ? `${m}/${d}/${y}` : "");

  return (
    <div className="text-center max-w-2xl mx-auto">
      <p className="text-xl md:text-2xl italic text-white/50 leading-relaxed">
        "{displayText}"
      </p>
      <p className="text-sm text-white/30 mt-2">
        — {displayRef}
        {verse?.theme ? ` • ${verse.theme}` : ""}
      </p>
    </div>
  );
}
