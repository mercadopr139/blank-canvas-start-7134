// Daily Duties — its own page under Practice Plan in the sidebar.
//
// Kept separate from the weekly Practice Plan editor: the master clean-up job
// list plus the funder report. The youth assign duties on the Gym Board; this
// is where staff shape the list and pull the numbers.
import { Button } from "@/components/ui/button";
import { Monitor } from "lucide-react";
import DailyDutiesAdmin from "@/components/duties/DailyDutiesAdmin";

const AdminDailyDuties = () => {
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto text-white">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Daily Duties Intelligence</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Edit the job template and pull the reports. Youth assign the jobs on the gym board.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open("/practice-board", "_blank")}
          className="bg-transparent border-neutral-700 text-neutral-300 hover:bg-white/5 hover:text-white"
        >
          <Monitor className="w-4 h-4 mr-1.5" /> Open gym board
        </Button>
      </div>

      <DailyDutiesAdmin />
    </div>
  );
};

export default AdminDailyDuties;
