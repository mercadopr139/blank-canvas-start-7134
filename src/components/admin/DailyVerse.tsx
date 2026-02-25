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

function generateVerseLibrary(year: number) {
  const baseVerses = [
    { ref: "Colossians 3:23", text: "Whatever you do, work at it with all your heart, as working for the Lord." },
    { ref: "Galatians 6:9", text: "Let us not become weary in doing good." },
    { ref: "Proverbs 16:3", text: "Commit to the Lord whatever you do." },
    { ref: "2 Timothy 4:7", text: "I have fought the good fight, I have kept the faith." },
    { ref: "Isaiah 40:31", text: "Those who hope in the Lord will renew their strength." },
    { ref: "Joshua 1:9", text: "Be strong and courageous." },
    { ref: "Romans 12:11", text: "Never be lacking in zeal, but keep your spiritual fervor." },
    { ref: "Psalm 37:5", text: "Commit your way to the Lord; trust in him." },
  ];

  const results: { year: number; month: number; day: number; reference: string; text: string; theme: string; is_trashed: boolean }[] = [];
  let verseIndex = 0;

  for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const verse = baseVerses[verseIndex % baseVerses.length];
      results.push({
        year,
        month,
        day,
        reference: verse.ref,
        text: verse.text,
        theme: "Work & Faith",
        is_trashed: false,
      });
      verseIndex++;
    }
  }

  return results;
}

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
    const verses = generateVerseLibrary(y);

    const { error } = await supabase
      .from("calendar_verses")
      .insert(verses, { ignoreDuplicates: true } as any);

    if (error) {
      console.error("Generation error:", error);
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
