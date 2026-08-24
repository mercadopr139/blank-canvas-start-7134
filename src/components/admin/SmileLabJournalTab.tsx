import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import SmileLabSessionEditor, { todayNY } from "@/components/smilelab/SmileLabSessionEditor";
import SmileLabJournalReview from "@/components/admin/SmileLabJournalReview";
import SmileLabGrantReportSheet from "@/components/admin/SmileLabGrantReportSheet";

// The Journal workspace (admin): write/edit a session inline, see saved entries
// below with edit, and generate the grant report — one place, no page-hopping.

const SmileLabJournalTab = () => {
  const queryClient = useQueryClient();
  const [date, setDate] = useState<string>(todayNY());
  const [reportOpen, setReportOpen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const editEntry = (d: string) => {
    setDate(d);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={topRef} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-bold text-white text-lg">Session Journal</h3>
        <Button onClick={() => setReportOpen(true)} className="bg-teal-600 hover:bg-teal-500 text-black font-semibold gap-2">
          <Sparkles className="h-4 w-4" /> Generate Grant Report
        </Button>
      </div>

      {/* Editor (renders its own aligned cards) */}
      <SmileLabSessionEditor
        date={date}
        onDateChange={setDate}
        showDateNav
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["smile-lab-journal"] })}
      />

      {/* Divider with clear space above and below */}
      <div className="border-t border-white/10 mt-8 mb-8" />

      {/* Saved entries */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40 mb-3">Past entries</div>
        <SmileLabJournalReview onEdit={editEntry} />
      </div>

      <SmileLabGrantReportSheet open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
};

export default SmileLabJournalTab;
