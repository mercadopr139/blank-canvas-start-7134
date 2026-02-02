import { useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ProgramsSection from "@/components/sections/ProgramsSection";
import ProgramsExtrasSection from "@/components/sections/ProgramsExtrasSection";
import DailyRhythmSection from "@/components/sections/DailyRhythmSection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Programs = () => {
  const [open, setOpen] = useState(false);
  const [programFilter, setProgramFilter] = useState<"junior" | "senior" | "all">("all");

  const handleMoreInfo = (program: "junior" | "senior") => {
    setProgramFilter(program);
    setOpen(true);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setProgramFilter("all");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        <ProgramsSection onMoreInfo={handleMoreInfo} />
        <ProgramsExtrasSection />
      </main>

      {/* Daily Rhythm Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Daily Rhythm</DialogTitle>
          </DialogHeader>
          <DailyRhythmSection programFilter={programFilter} />
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Programs;
