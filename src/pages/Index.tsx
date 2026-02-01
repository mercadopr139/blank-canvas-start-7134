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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        <HeroSection />
        <AboutSection />
        <ProgramsSection onMoreInfo={() => setOpen(true)} />
        <ImpactSection />
      </main>

      {/* Daily Rhythm Dialog Trigger - Fixed Button */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            className="fixed bottom-6 right-6 z-40 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
            size="lg"
          >
            <Clock className="mr-2 h-5 w-5" />
            Click for Daily Schedule
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Daily Rhythm</DialogTitle>
          </DialogHeader>
          <DailyRhythmSection />
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Index;
