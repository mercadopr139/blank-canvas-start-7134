import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import EventBanner from "@/components/sections/EventBanner";
import FreeAccessMarquee from "@/components/sections/FreeAccessMarquee";
import ImpactStrip from "@/components/sections/ImpactStrip";
import CoreValuesSection from "@/components/sections/CoreValuesSection";
import AboutSection from "@/components/sections/AboutSection";
import ProgramsSection from "@/components/sections/ProgramsSection";
import DailyRhythmSection from "@/components/sections/DailyRhythmSection";
import MealTrainSection from "@/components/sections/MealTrainSection";
import ImpactSection from "@/components/sections/ImpactSection";
import AwardsSection from "@/components/sections/AwardsSection";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageCircle, Users, Bird } from "lucide-react";
import ContactModal from "@/components/contact/ContactModal";
const Index = () => {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [programFilter, setProgramFilter] = useState<"junior" | "senior" | "all">("all");
  const [footerVisible, setFooterVisible] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
        <EventBanner />
        <HeroSection />
        <FreeAccessMarquee />
        <ImpactStrip />
        <CoreValuesSection />
        <AwardsSection />
        <AboutSection />
        <ProgramsSection onMoreInfo={handleMoreInfo} />
        <MealTrainSection />
        <ImpactSection />

        {/* Rookie Orientation Section */}
        <section className="w-full bg-muted-foreground py-10 md:py-14 flex flex-col items-center text-center px-5">
            <h2 className="text-xl md:text-2xl font-semibold mb-3 text-primary-foreground">Enrolled Boxers Only</h2>
            <p className="mb-6 max-w-md text-primary-foreground">Access Rookie Orientation and more materials...

        </p>
            <Button asChild size="lg" className="bg-white hover:bg-neutral-100 text-black font-semibold">
              <Link to="/rookie-orientation">
                <Users className="mr-2 h-5 w-5" />
                NLA Bulletin Board
              </Link>
            </Button>
            <p className="mt-2 text-xs text-primary-foreground/70">Password Protected</p>

            {/* Hawk Squad: a quiet line for Cape May Tech families, kept
                under the Bulletin Board so it never competes with it. */}
            <Link
              to="/hawk-squad/register"
              className="group mt-8 w-full max-w-sm rounded-xl border border-[#f2c230]/60 bg-[#0f4c2f] px-5 py-4 text-left shadow-md transition-all hover:bg-[#12603a] hover:border-[#f2c230] hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f2c230]">
                  <Bird className="h-5 w-5 text-[#0f4c2f]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#f2c230]">Hawk Squad</p>
                  <p className="text-sm font-semibold text-white">
                    Cape May Tech student? Register for Hawk Squad here
                    <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">→</span>
                  </p>
                </div>
              </div>
            </Link>
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

      {/* Contact Button - Fixed, hidden when footer is visible */}
      <Button
      className={`fixed bottom-6 right-6 z-40 text-white font-semibold shadow-lg transition-opacity duration-300 ${footerVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ backgroundColor: '#bf0f3e' }}
      size="lg"
      onClick={() => setContactOpen(true)}
      aria-label="Open contact options">
      
        <MessageCircle className="mr-2 h-5 w-5" />
        Click to Contact Us
      </Button>

      {/* Contact Modal */}
      <ContactModal open={contactOpen} onOpenChange={setContactOpen} />

      <div ref={footerRef}>
        <Footer />
      </div>
    </div>;
};
export default Index;