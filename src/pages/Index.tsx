import { useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import AboutSection from "@/components/sections/AboutSection";
import ProgramsSection from "@/components/sections/ProgramsSection";
import DailyRhythmSection from "@/components/sections/DailyRhythmSection";
import ImpactSection from "@/components/sections/ImpactSection";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Clock } from "lucide-react";

const Index = () => {
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
        <HeroSection />
        <AboutSection />
        <ProgramsSection onMoreInfo={handleMoreInfo} />
        <ImpactSection />
      </main>

      {/* Daily Rhythm Dialog Trigger - Fixed Button */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            className="fixed bottom-6 right-6 z-40 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
            size="lg"
            onClick={() => setProgramFilter("all")}
          >
            <Clock className="mr-2 h-5 w-5" />
            Click for Daily Schedule
          </Button>
        </DialogTrigger>
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

export default Index;
