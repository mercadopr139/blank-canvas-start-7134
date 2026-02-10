import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ProgramsSection from "@/components/sections/ProgramsSection";
import ProgramsExtrasSection from "@/components/sections/ProgramsExtrasSection";
import MoreThanBoxingSection from "@/components/sections/MoreThanBoxingSection";
import DailyRhythmSection from "@/components/sections/DailyRhythmSection";
import { ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Programs = () => {
  const location = useLocation();
  const fromMealTrain = location.state?.openMealTrain === true;
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
        {/* Sticky Back to Meal Train Link */}
        {fromMealTrain && (
          <div className="sticky top-0 z-40 bg-foreground/95 backdrop-blur-sm border-b border-background/10">
            <div className="container py-3">
              <Link 
                to="/meal-train" 
                className="inline-flex items-center gap-1.5 text-background/80 hover:text-background transition-colors text-sm font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Meal Train
              </Link>
            </div>
          </div>
        )}
        <ProgramsSection onMoreInfo={handleMoreInfo} />
        <ProgramsExtrasSection />
        <MoreThanBoxingSection />
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
