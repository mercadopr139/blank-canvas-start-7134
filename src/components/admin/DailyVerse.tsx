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
    return () => { cancelled = true; };
  }, [y, m, d]);

  async function generateYear() {
    const { data: lib, error: libErr } = await supabase
      .from("verse_library")
      .select("sort_index,reference,text,theme")
      .eq("is_trashed", false)
      .order("sort_index", { ascending: true });

    if (libErr) {
      console.error("verse_library load error:", libErr);
      return;
    }

    if (!lib || lib.length < 365) {
      console.error(`verse_library needs at least 365 verses. Found: ${lib?.length ?? 0}`);
      alert(`Verse library incomplete. Add at least 365 verses (found ${lib?.length ?? 0}).`);
      return;
    }

    const rows: any[] = [];
    let dayOfYear = 0;

    for (let month = 1; month <= 12; month++) {
      const daysInMonth = new Date(y, month, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        dayOfYear += 1;
        const idx = Math.min(dayOfYear, 365) - 1;
        const v = lib[idx];
        rows.push({
          year: y,
          month,
          day,
          reference: v.reference,
          text: v.text,
          theme: v.theme ?? "Work & Faith",
          is_trashed: false,
        });
      }
    }

    const { error: upsertErr } = await supabase
      .from("calendar_verses")
      .upsert(rows, { onConflict: "year,month,day", ignoreDuplicates: true });

    if (upsertErr) {
      console.error("calendar_verses upsert error:", upsertErr);
      return;
    }

    window.location.reload();
  }

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

      {missing && (
        <div className="mt-3">
          <button
            onClick={generateYear}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/20 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 cursor-pointer transition-colors"
          >
            Generate {y} Verse Calendar
          </button>
        </div>
      )}
    </div>
  );
}
