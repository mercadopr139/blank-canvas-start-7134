import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, ArrowLeft } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import GymBuddiesChatWidget from "@/components/gym-buddies/GymBuddiesChatWidget";
import { ClickToEnlargeGallery } from "@/components/ui/click-to-enlarge-gallery";
import { YouTubeEmbed } from "@/components/orientation/YouTubeEmbed";
import captainMiller from "@/assets/gym-buddies/captain-miller.jpg";
import { useSiteImages } from "@/hooks/useSiteImages";
const GymBuddies = () => {
  const location = useLocation();
  const fromPrograms = location.state?.fromPrograms === true;
  const [isChatOpen, setIsChatOpen] = useState(false);
  // Photos are managed from the admin (Website Photos → Gym Buddies). resolveGroup
  // returns the admin's edits, or the bundled defaults until it's been edited.
  const { resolveGroup } = useSiteImages();
  const gymBuddiesImages = resolveGroup("programs.gym-buddies");
  return <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Title Section */}
        <section className="py-16 md:py-20 bg-foreground">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-background text-center">
                Gym Buddies Program
              </h1>
            </div>
          </div>
        </section>

        {/* Fixed Back to Programs Link - below header + title */}
        {fromPrograms && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-muted/70 backdrop-blur-sm border-t border-border/30">
            <div className="container py-3">
              <Link 
                to="/programs#more-programs" 
                className="inline-flex items-center gap-1.5 text-foreground/60 hover:text-foreground transition-colors text-sm font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Programs
              </Link>
            </div>
          </div>
        )}

        {/* Featured Hero Image */}
        <section className="bg-background pt-8 pb-0">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <div className="rounded-lg overflow-hidden">
                <img src={captainMiller} alt="Congrats Captain Miller" className="w-full h-auto object-cover" />
                <div className="bg-foreground/80 text-background px-4 py-3 text-center">
                  <p className="font-medium">Congrats Captain Miller!</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="md:py-20 bg-background py-[20px]">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              {/* Description */}
              <div className="text-left mb-12 space-y-6">
                <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
                  No Limits Academy serves over <span className="font-bold text-foreground">500 youth each year</span> across Cape May County.
                </p>
                <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
                  <span className="font-bold text-foreground">We cannot do this work alone.</span> Our Gym Buddies program connects our youth with local first responders—law enforcement officers, firefighters, and U.S. Coast Guard members—who step into the gym not just to train, but to build lasting relationships. What begins as time spent together in the gym grows into trust, mentorship, and genuine connection.
                </p>
                <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
                  Our Gym Buddies often become advocates well beyond training sessions. They support NLA through community events, fundraising efforts, meal train participation, and by serving as ambassadors for the Academy throughout Cape May County.
                </p>
                <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
                  Gym Buddies help reinforce to our youth that positive, dependable adults exist in their community—and that support doesn't end when the workout does.
                </p>
                
                {/* Chat Button */}
                <div className="pt-4 flex flex-col items-center">
                  <Button onClick={() => setIsChatOpen(true)} className="px-4 py-2 h-auto rounded-lg bg-foreground text-background font-bold text-sm hover:bg-foreground/90 transition-colors flex flex-col items-center gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4" />
                      Interested in becoming
                    </span>
                    <span>a Gym Buddy?</span>
                  </Button>
                  <p className="text-xs italic text-muted-foreground mt-2 text-center">Click for more info!</p>

                  {/* 2025 Shop with a Cop Video */}
                  <div className="mt-8 w-full max-w-2xl">
                    <h3 className="text-lg md:text-xl font-bold text-foreground mb-3 text-center">2025 Shop with a Cop Event</h3>
                    <YouTubeEmbed videoId="wbo6KZzj_1s" title="2025 Shop with a Cop Event" />
                  </div>
                </div>
              </div>

              {/* Gym Buddies Chat Drawer */}
              <Drawer open={isChatOpen} onOpenChange={setIsChatOpen}>
                <DrawerContent className="max-h-[85vh]">
                  <DrawerHeader className="flex items-center justify-between">
                    <DrawerTitle className="text-lg font-bold">Gym Buddies Chat</DrawerTitle>
                    <DrawerClose asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                      </Button>
                    </DrawerClose>
                  </DrawerHeader>
                  <div className="px-4 pb-6">
                    <GymBuddiesChatWidget onClose={() => setIsChatOpen(false)} />
                  </div>
                </DrawerContent>
              </Drawer>

              {/* Divider */}
              <hr className="border-t border-foreground/10 my-8" />

              {/* Photo Gallery */}
              <ClickToEnlargeGallery images={gymBuddiesImages} showCaptions variant="featured" />
            </div>
          </div>
        </section>

        {/* US Coast Guard Video Section */}
        <section className="py-16 md:py-20 bg-foreground">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-black text-background text-center mb-8">
                Gym Buddies: United States Coast Guard
              </h2>
              <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube-nocookie.com/embed/hssnpxFkTAg"
                  title="Gym Buddies: United States Coast Guard"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>;
};
export default GymBuddies;