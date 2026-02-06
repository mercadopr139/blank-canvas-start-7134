import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import FreeAccessMarquee from "@/components/sections/FreeAccessMarquee";
import ImpactStrip from "@/components/sections/ImpactStrip";
import AboutSection from "@/components/sections/AboutSection";
import ProgramsSection from "@/components/sections/ProgramsSection";
import DailyRhythmSection from "@/components/sections/DailyRhythmSection";
import ImpactSection from "@/components/sections/ImpactSection";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageCircle, Users } from "lucide-react";
import ContactModal from "@/components/contact/ContactModal";
const Index = () => {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [programFilter, setProgramFilter] = useState<"junior" | "senior" | "all">("all");
  const handleMoreInfo = (program: "junior" | "senior") => {
    setProgramFilter(program);
    setScheduleOpen(true);
  };
  const handleScheduleOpenChange = (isOpen: boolean) => {
    setScheduleOpen(isOpen);
    if (!isOpen) {
      setProgramFilter("all");
    }
  };
  return <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        <HeroSection />
        <FreeAccessMarquee />
        <ImpactStrip />
        <AboutSection />
        <ProgramsSection onMoreInfo={handleMoreInfo} />
        <ImpactSection />

        {/* Rookie Orientation Section */}
        <section className="w-full border-t py-10 md:py-14 border-card-foreground bg-nla">
          <div className="container flex flex-col items-center text-center px-4">
            <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-3">Are you new to the Program?</h2>
            <p className="mb-6 max-w-md text-primary-foreground">
              Access orientation materials and get started with everything you need to know.
            </p>
            <Button asChild size="lg" className="text-white font-semibold" style={{
            backgroundColor: "#bf0f3e"
          }}>
              <Link to="/rookie-orientation">
                <Users className="mr-2 h-5 w-5" />
                Rookie Orientation
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Daily Rhythm Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={handleScheduleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Daily Rhythm</DialogTitle>
          </DialogHeader>
          <DailyRhythmSection programFilter={programFilter} />
        </DialogContent>
      </Dialog>

      {/* Contact Button - Fixed */}
      <Button className="fixed bottom-6 right-6 z-40 text-white font-semibold shadow-lg" style={{
      backgroundColor: '#bf0f3e'
    }} size="lg" onClick={() => setContactOpen(true)} aria-label="Open contact options">
        <MessageCircle className="mr-2 h-5 w-5" />
        Click to Contact Us
      </Button>

      {/* Contact Modal */}
      <ContactModal open={contactOpen} onOpenChange={setContactOpen} />

      <Footer />
    </div>;
};
export default Index;