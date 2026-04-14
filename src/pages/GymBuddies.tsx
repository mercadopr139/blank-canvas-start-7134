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
import middleTownshipPd from "@/assets/gym-buddies/middle-township-pd.jpg";
import lowerTownshipPd from "@/assets/gym-buddies/lower-township-pd.jpg";
import shopWithCop from "@/assets/gym-buddies/shop-with-cop-2025.jpg";
import wildwoodFireDept from "@/assets/gym-buddies/wildwood-fire-dept.jpg";
import captainMiller from "@/assets/gym-buddies/captain-miller.jpg";
import avalonPd from "@/assets/gym-buddies/avalon-pd.png";
import avalonPd5 from "@/assets/gym-buddies/avalon-pd-5.jpg";
import acPoliceDept from "@/assets/gym-buddies/ac-police-dept.png";
import wildwoodPdProsecutors from "@/assets/gym-buddies/wildwood-pd-prosecutors.png";
import usCoastGuardBase from "@/assets/gym-buddies/us-coast-guard-base.png";
import knockoutCookoutMtpd from "@/assets/gym-buddies/knockout-cookout-mtpd.png";
import wildwoodFireDept2 from "@/assets/gym-buddies/wildwood-fire-dept-2.png";
import chiefsOfCmc from "@/assets/gym-buddies/chiefs-of-cmc.png";
import chiefJeffChristopher from "@/assets/gym-buddies/chief-jeff-christopher.png";
import chiefKevinLewis from "@/assets/gym-buddies/chief-kevin-lewis.png";
import mtpdAlyssaJones from "@/assets/gym-buddies/mtpd-alyssa-jones.png";
import ltpdSimba from "@/assets/gym-buddies/ltpd-simba.png";
import captainMiller2 from "@/assets/gym-buddies/captain-miller-2.png";
import millvillePdBryanH from "@/assets/gym-buddies/millville-pd-bryan-h.png";
import sleighDayAlyssaJones from "@/assets/gym-buddies/sleigh-day-alyssa-jones.png";
import nlaBlueKnights from "@/assets/gym-buddies/nla-blue-knights.png";
import nlaChiefsAssociationCmc from "@/assets/gym-buddies/nla-chiefs-association-cmc.png";
import nlaOceanCityPd from "@/assets/gym-buddies/nla-ocean-city-pd.png";
import nlaWildwoodCrestPd from "@/assets/gym-buddies/nla-wildwood-crest-pd.png";
import nlaWildwoodPd from "@/assets/gym-buddies/nla-wildwood-pd.png";
import nlaWildwoodPd2 from "@/assets/gym-buddies/nla-wildwood-pd-2.png";
import nlaMtpd2 from "@/assets/gym-buddies/nla-mtpd-2.png";
import nlaNorthWildwoodPdFire from "@/assets/gym-buddies/nla-north-wildwood-pd-fire.png";
import copsAndHoopers2 from "@/assets/gym-buddies/cops-and-hoopers-2.png";
import copsAndHoopers3 from "@/assets/gym-buddies/cops-and-hoopers-3.png";
import copsHoopersPlanning from "@/assets/gym-buddies/cops-hoopers-planning.png";
import mtpdRonMillerJulioRuiz from "@/assets/gym-buddies/mtpd-ron-miller-julio-ruiz.png";
import nlaWildwoodCrestPd2 from "@/assets/gym-buddies/nla-wildwood-crest-pd-2.png";
import nlaPoliceChiefsAssociation from "@/assets/gym-buddies/nla-police-chiefs-association.png";
import cmcFinest from "@/assets/gym-buddies/cmc-finest.png";
import chiefDekonCapeMay from "@/assets/gym-buddies/chief-dekon-cape-may.jpg";
import chiefDekonWeldonPowell from "@/assets/gym-buddies/chief-dekon-weldon-powell.jpg";
import mtpdYouthCampCommittee from "@/assets/gym-buddies/mtpd-youth-camp-committee.jpg";
const GymBuddies = () => {
  const location = useLocation();
  const fromPrograms = location.state?.fromPrograms === true;
  const [isChatOpen, setIsChatOpen] = useState(false);
  const gymBuddiesImages = [{
    src: mtpdYouthCampCommittee,
    alt: "Middle Township PD- Youth Camp Committee",
    caption: "Middle Township PD- Youth Camp Committee"
  }, {
    src: chiefDekonCapeMay,
    alt: "Congrats Chief Dekon, Chief of Chiefs in CMC with Mayor Leusner and NLA Family",
    caption: "Congrats Chief Dekon, Chief of Chiefs in CMC! w/ Mayor Leusner & NLA Family!"
  }, {
    src: chiefDekonWeldonPowell,
    alt: "Chief Dekon Fashaw, Cape May with Chief Weldon Powell, Chief of Detectives, NJ",
    caption: "Chief Dekon Fashaw, Cape May w/ Chief Weldon Powell, Chief of Detectives, NJ"
  }, {
    src: middleTownshipPd,
    alt: "NLA to Middle Township PD",
    caption: "NLA to Middle Township PD!"
  }, {
    src: lowerTownshipPd,
    alt: "NLA to Lower Township PD",
    caption: "NLA to Lower Township PD!"
  }, {
    src: shopWithCop,
    alt: "Shop with a Cop 2025",
    caption: "Shop with a Cop 2025"
  }, {
    src: wildwoodFireDept,
    alt: "NLA to Wildwood Fire Department",
    caption: "NLA to Wildwood Fire Department!"
  }, {
    src: avalonPd,
    alt: "Avalon Police Department",
    caption: "Avalon Police Department"
  }, {
    src: avalonPd5,
    alt: "Congrats Chief Leusner NOW Mayor",
    caption: "Congrats Chief Leusner NOW Mayor!"
  }, {
    src: acPoliceDept,
    alt: "NLA to AC Police Department",
    caption: "NLA to AC Police Department"
  }, {
    src: wildwoodPdProsecutors,
    alt: "Wildwood PD and Prosecutors Office",
    caption: "Wildwood PD and Prosecutors Office"
  }, {
    src: usCoastGuardBase,
    alt: "US Coast Guard Base, Cape May",
    caption: "US Coast Guard Base, Cape May"
  }, {
    src: knockoutCookoutMtpd,
    alt: "Knockout Cookout with MTPD",
    caption: "Knockout Cookout with MTPD"
  }, {
    src: wildwoodFireDept2,
    alt: "Wildwood Fire Department",
    caption: "Wildwood Fire Department"
  }, {
    src: chiefsOfCmc,
    alt: "Some of the CHIEFS of CMC",
    caption: "Some of the CHIEFS of CMC!"
  }, {
    src: chiefJeffChristopher,
    alt: "Chief of Avalon Jeff Christopher",
    caption: "Chief of Avalon, Jeff Christopher"
  }, {
    src: chiefKevinLewis,
    alt: "Chief Kevin Lewis of Lower Township PD",
    caption: "Chief Kevin Lewis of Lower Township PD"
  }, {
    src: mtpdAlyssaJones,
    alt: "MTPD's Alyssa Jones",
    caption: "MTPD's Alyssa Jones"
  }, {
    src: ltpdSimba,
    alt: "Lower Township PD Simba",
    caption: "Lower Township PD, Simba"
  }, {
    src: captainMiller2,
    alt: "Congrats Captain Miller",
    caption: "Congrats Captain Miller!"
  }, {
    src: millvillePdBryanH,
    alt: "NLA to Millville PD Congrats Bryan H",
    caption: "NLA to Millville PD! Congrats Bryan H."
  }, {
    src: sleighDayAlyssaJones,
    alt: "Sleigh the Day with MTPD's Alyssa Jones",
    caption: "Sleigh the Day with MTPD's Alyssa Jones"
  }, {
    src: nlaBlueKnights,
    alt: "NLA with the Blue Knights",
    caption: "NLA w/ the Blue Knights"
  }, {
    src: nlaChiefsAssociationCmc,
    alt: "NLA with the Chiefs Association of CMC",
    caption: "NLA w/ the Chiefs Association of CMC"
  }, {
    src: nlaOceanCityPd,
    alt: "NLA and Ocean City PD",
    caption: "NLA & Ocean City PD"
  }, {
    src: nlaWildwoodCrestPd,
    alt: "NLA with Wildwood Crest PD",
    caption: "NLA w/ Wildwood Crest PD"
  }, {
    src: nlaWildwoodPd,
    alt: "NLA with Wildwood PD",
    caption: "NLA w/ Wildwood PD"
  }, {
    src: nlaWildwoodPd2,
    alt: "NLA with Wildwood PD",
    caption: "NLA w/ Wildwood PD"
  }, {
    src: nlaMtpd2,
    alt: "NLA with MTPD",
    caption: "NLA w/ MTPD"
  }, {
    src: nlaNorthWildwoodPdFire,
    alt: "NLA with North Wildwood Police and Fire",
    caption: "NLA w/ North Wildwood Police & Fire"
  }, {
    src: copsAndHoopers2,
    alt: "Cops and Hoopers",
    caption: "Cops & Hoopers"
  }, {
    src: copsAndHoopers3,
    alt: "Cops and Hoopers",
    caption: "Cops & Hoopers"
  }, {
    src: copsHoopersPlanning,
    alt: "Cops and Hoopers Planning Committee",
    caption: "Cops & Hoopers Planning Committee"
  }, {
    src: mtpdRonMillerJulioRuiz,
    alt: "MTPD's Ron Miller and Julio Ruiz",
    caption: "MTPD's Ron Miller & Julio Ruiz"
  }, {
    src: nlaWildwoodCrestPd2,
    alt: "NLA with Wildwood Crest PD",
    caption: "NLA w/ Wildwood Crest PD"
  }, {
    src: nlaPoliceChiefsAssociation,
    alt: "NLA with Police Chiefs Association",
    caption: "NLA w/ Police Chiefs Association"
  }, {
    src: cmcFinest,
    alt: "CMC's Finest",
    caption: "CMC's Finest!"
  }];
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