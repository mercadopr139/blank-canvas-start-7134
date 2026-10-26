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
  const [yearIncomplete, setYearIncomplete] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [needsSeed, setNeedsSeed] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [autoGenTried, setAutoGenTried] = useState(false);

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
      } else if (!data) {
        setMissing(true);
      } else {
        setVerse(data);
        setMissing(false);
      }

      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const totalDays = isLeap ? 366 : 365;

      const { count, error: countErr } = await supabase
        .from("calendar_verses")
        .select("id", { count: "exact", head: true })
        .eq("year", y)
        .eq("is_trashed", false);

      if (cancelled) return;
      if (!countErr && (count ?? 0) < totalDays) {
        setYearIncomplete(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [y, m, d]);

  useEffect(() => {
    if (!autoGenTried && missing && m === 1 && d === 1) {
      setAutoGenTried(true);
      generateYear();
    }
  }, [autoGenTried, missing, m, d]);

  async function generateYear() {
    setGenerating(true);
    const { data: lib, error: libErr } = await supabase
      .from("verse_library")
      .select("sort_index,reference,text,theme")
      .eq("is_trashed", false)
      .order("sort_index", { ascending: true });

    if (libErr) {
      console.error("verse_library load error:", libErr);
      setGenerating(false);
      return;
    }

    if (!lib || lib.length < 365) {
      setNeedsSeed(true);
      alert(`Verse library incomplete. Add at least 365 verses (found ${lib?.length ?? 0}).`);
      setGenerating(false);
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
      setGenerating(false);
      return;
    }

    window.location.reload();
  }

  async function seedVerseLibrary() {
    setSeeding(true);

    // ESV text, verbatim from Crossway's ESV API (Josh, 2026-10-26: "they should always be ESV").
    // Poetry line breaks joined into one line. Never retype these from another translation.
    const starter = [
      { reference: "Colossians 3:23", text: "Whatever you do, work heartily, as for the Lord and not for men,", theme: "Hard Work & Faith" },
      { reference: "Galatians 6:9", text: "And let us not grow weary of doing good, for in due season we will reap, if we do not give up.", theme: "Perseverance" },
      { reference: "Proverbs 16:3", text: "Commit your work to the LORD, and your plans will be established.", theme: "Discipline" },
      { reference: "1 Corinthians 15:58", text: "Therefore, my beloved brothers, be steadfast, immovable, always abounding in the work of the Lord, knowing that in the Lord your labor is not in vain.", theme: "Purpose" },
      { reference: "James 1:12", text: "Blessed is the man who remains steadfast under trial, for when he has stood the test he will receive the crown of life, which God has promised to those who love him.", theme: "Endurance" },
      { reference: "Proverbs 21:5", text: "The plans of the diligent lead surely to abundance, but everyone who is hasty comes only to poverty.", theme: "Diligence" },
      { reference: "Ecclesiastes 9:10", text: "Whatever your hand finds to do, do it with your might, for there is no work or thought or knowledge or wisdom in Sheol, to which you are going.", theme: "Work Ethic" },
      { reference: "Joshua 1:9", text: "Have I not commanded you? Be strong and courageous. Do not be frightened, and do not be dismayed, for the LORD your God is with you wherever you go.", theme: "Courage" },
      { reference: "Isaiah 40:31", text: "but they who wait for the LORD shall renew their strength; they shall mount up with wings like eagles; they shall run and not be weary; they shall walk and not faint.", theme: "Strength" },
      { reference: "2 Timothy 4:7", text: "I have fought the good fight, I have finished the race, I have kept the faith.", theme: "Faith" },
      { reference: "Romans 12:11", text: "Do not be slothful in zeal, be fervent in spirit, serve the Lord.", theme: "Intensity" },
      { reference: "Hebrews 12:1", text: "Therefore, since we are surrounded by so great a cloud of witnesses, let us also lay aside every weight, and sin which clings so closely, and let us run with endurance the race that is set before us,", theme: "Perseverance" },
    ];

    const rows = Array.from({ length: 365 }).map((_, i) => {
      const v = starter[i % starter.length];
      return {
        sort_index: i + 1,
        reference: v.reference,
        text: v.text,
        theme: v.theme,
        is_trashed: false,
      };
    });

    const { error } = await supabase.from("verse_library").insert(rows);

    if (error) {
      console.error("seedVerseLibrary error:", error);
      alert("Seed failed. Check console for details.");
      setSeeding(false);
      return;
    }

    setSeeding(false);
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
        — {displayRef}{verse ? " (ESV)" : ""}
        {verse?.theme ? ` • ${verse.theme}` : ""}
      </p>

      {yearIncomplete && (
        <div className="mt-3">
          <button
            onClick={generateYear}
            disabled={generating}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/20 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {generating ? "Generating…" : `Generate ${y} Verse Calendar`}
          </button>
        </div>
      )}

      {needsSeed && (
        <div className="mt-2.5">
          <button
            onClick={seedVerseLibrary}
            disabled={seeding}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/20 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {seeding ? "Seeding library…" : "Seed Verse Library (365)"}
          </button>
        </div>
      )}
    </div>
  );
}
