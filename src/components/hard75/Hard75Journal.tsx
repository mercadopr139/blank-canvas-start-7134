// The journal — 75 days of what it actually felt like.
//
// Read back to back this is the part that shows the change the photos can't:
// day 8 is "this is brutal", day 40 is "woke up before the alarm". Each entry
// carries whether the day itself was clean, because "felt rough" landing on the
// same day as a missed gallon of water is the useful pattern.
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { BookOpen, Search, ArrowDownUp } from "lucide-react";
import { Hard75Day, dayComplete, doneCount } from "@/lib/hard75";

const Hard75Journal = ({
  days,
  onOpenDay,
}: {
  days: Hard75Day[];
  onOpenDay: (d: Hard75Day) => void;
}) => {
  const [search, setSearch] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);

  const entries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return days
      .filter((d) => d.notes?.trim())
      .filter((d) => !q || d.notes!.toLowerCase().includes(q))
      .sort((a, b) => (newestFirst ? b.day_number - a.day_number : a.day_number - b.day_number));
  }, [days, search, newestFirst]);

  const written = days.filter((d) => d.notes?.trim()).length;

  if (written === 0) {
    return (
      <div className="text-center py-16 text-white/35">
        <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>Nothing written yet.</p>
        <p className="text-sm mt-1 text-white/25">
          Open a day and write a line at the end of it — rough, strong, whatever it was.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the journal…"
            className="pl-9 bg-neutral-900 border-neutral-800 text-white"
          />
        </div>
        <button
          onClick={() => setNewestFirst((n) => !n)}
          className="h-10 px-3 rounded-lg border border-white/10 text-sm font-semibold text-white/50 hover:text-white inline-flex items-center gap-1.5"
        >
          <ArrowDownUp className="w-4 h-4" />
          {newestFirst ? "Newest first" : "Day 1 first"}
        </button>
        <span className="text-sm text-white/30">{written} of 75 written</span>
      </div>

      {entries.length === 0 ? (
        <p className="text-white/35 py-10 text-center">Nothing matches that.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((d) => {
            const clean = dayComplete(d);
            return (
              <button
                key={d.id}
                onClick={() => onOpenDay(d)}
                className="w-full text-left rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-colors p-4"
              >
                <div className="flex items-baseline gap-3 mb-1.5 flex-wrap">
                  <span className="font-black text-white">Day {d.day_number}</span>
                  <span className="text-xs text-white/35">
                    {format(new Date(`${d.date}T12:00:00`), "EEEE d MMMM")}
                  </span>
                  <span
                    className={`ml-auto text-[10px] uppercase tracking-wider font-bold ${
                      clean ? "text-emerald-400/80" : "text-amber-400/80"
                    }`}
                  >
                    {clean ? "All six" : `${doneCount(d)} of 6`}
                  </span>
                </div>
                <p className="text-[15px] leading-relaxed text-white/75 whitespace-pre-line">
                  {d.notes}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Hard75Journal;
