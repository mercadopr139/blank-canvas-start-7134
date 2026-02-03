import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClickToEnlargeGallery } from "@/components/ui/click-to-enlarge-gallery";

// Gym Buddies images (all 35)
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

// Excursions images
import excursionYouthGroup from "@/assets/excursions/excursion-youth-group.png";
import excursionPaddleboard from "@/assets/excursions/excursion-paddleboard.png";
import excursionShoreFishing from "@/assets/excursions/excursion-shore-fishing.png";

const gymBuddiesImages = [
  { src: chiefDekonCapeMay, alt: "Congrats Chief Dekon of Cape May" },
  { src: middleTownshipPd, alt: "NLA to Middle Township PD" },
  { src: lowerTownshipPd, alt: "NLA to Lower Township PD" },
  { src: shopWithCop, alt: "Shop with a Cop 2025" },
  { src: wildwoodFireDept, alt: "NLA to Wildwood Fire Department" },
  { src: captainMiller, alt: "Congrats Captain Miller" },
  { src: avalonPd, alt: "Avalon Police Department" },
  { src: avalonPd5, alt: "Congrats Chief Leusner NOW Mayor" },
  { src: acPoliceDept, alt: "NLA to AC Police Department" },
  { src: wildwoodPdProsecutors, alt: "Wildwood PD and Prosecutors Office" },
  { src: usCoastGuardBase, alt: "US Coast Guard Base, Cape May" },
  { src: knockoutCookoutMtpd, alt: "Knockout Cookout with MTPD" },
  { src: wildwoodFireDept2, alt: "Wildwood Fire Department" },
  { src: chiefsOfCmc, alt: "Some of the CHIEFS of CMC" },
  { src: chiefJeffChristopher, alt: "Chief of Avalon Jeff Christopher" },
  { src: chiefKevinLewis, alt: "Chief Kevin Lewis of Lower Township PD" },
  { src: mtpdAlyssaJones, alt: "MTPD's Alyssa Jones" },
  { src: ltpdSimba, alt: "Lower Township PD Simba" },
  { src: captainMiller2, alt: "Congrats Captain Miller" },
  { src: millvillePdBryanH, alt: "NLA to Millville PD Congrats Bryan H" },
  { src: sleighDayAlyssaJones, alt: "Sleigh the Day with MTPD's Alyssa Jones" },
  { src: nlaBlueKnights, alt: "NLA with the Blue Knights" },
  { src: nlaChiefsAssociationCmc, alt: "NLA with the Chiefs Association of CMC" },
  { src: nlaOceanCityPd, alt: "NLA and Ocean City PD" },
  { src: nlaWildwoodCrestPd, alt: "NLA with Wildwood Crest PD" },
  { src: nlaWildwoodPd, alt: "NLA with Wildwood PD" },
  { src: nlaWildwoodPd2, alt: "NLA with Wildwood PD" },
  { src: nlaMtpd2, alt: "NLA with MTPD" },
  { src: nlaNorthWildwoodPdFire, alt: "NLA with North Wildwood Police and Fire" },
  { src: copsAndHoopers2, alt: "Cops and Hoopers" },
  { src: copsAndHoopers3, alt: "Cops and Hoopers" },
  { src: copsHoopersPlanning, alt: "Cops and Hoopers Planning Committee" },
  { src: mtpdRonMillerJulioRuiz, alt: "MTPD's Ron Miller and Julio Ruiz" },
  { src: nlaWildwoodCrestPd2, alt: "NLA with Wildwood Crest PD" },
  { src: nlaPoliceChiefsAssociation, alt: "NLA with Police Chiefs Association" },
  { src: cmcFinest, alt: "CMC's Finest" },
];

type ProgramItem = {
  id: string;
  title: string;
  subtitle: string;
  blurb: string;
  images: { src: string; alt: string }[];
  buttonLabel: string;
};

const ProgramsExtrasSection = () => {
  const items: ProgramItem[] = useMemo(
    () => [
      {
        id: "gym-buddies",
        title: "Gym Buddies",
        subtitle: "Senior Boxers Only",
        blurb:
          "Gym Buddies brings youth together with law enforcement officers, firefighters, and service members for shared workouts that build mutual trust, respect, and understanding—strengthening relationships both inside and beyond the gym.",
        images: gymBuddiesImages,
        buttonLabel: "Back to Programs",
      },
      {
        id: "excursions",
        title: "Excursions",
        subtitle: "Senior Boxers Only",
        blurb:
          "Our excursions take youth beyond the facility walls—exposing them to new experiences, education, and opportunities that expand perspective and reinforce life skills learned in the gym.",
        images: [
          { src: excursionYouthGroup, alt: "Hiking at Higbees", caption: "Hiking at Higbees" },
          { src: excursionPaddleboard, alt: "Paddle Board & Kayaking", caption: "Paddle Board & Kayaking" },
          { src: excursionShoreFishing, alt: "Shore Fishing in Cape May", caption: "Shore Fishing in Cape May" },
        ],
        buttonLabel: "Back to Programs",
      },
      {
        id: "launch-pad",
        title: "The Launch Pad",
        subtitle: "Senior Boxers Only",
        blurb:
          "The Launch Pad prepares youth for early work experiences and a clear path forward—building habits, responsibility, and readiness so they approach graduation with a plan and the discipline to follow through.",
        images: [
          { src: "/placeholder.svg", alt: "Launch Pad photo 1" },
          { src: "/placeholder.svg", alt: "Launch Pad photo 2" },
          { src: "/placeholder.svg", alt: "Launch Pad photo 3" },
          { src: "/placeholder.svg", alt: "Launch Pad photo 4" },
          { src: "/placeholder.svg", alt: "Launch Pad photo 5" },
          { src: "/placeholder.svg", alt: "Launch Pad photo 6" },
        ],
        buttonLabel: "Back to Programs",
      },
      {
        id: "smile-lab",
        title: "Dental Dental's Smile Lab Program",
        subtitle: "Junior Boxers Only",
        blurb:
          "Smile Lab supports youth with education and life skills connected to hygiene, confidence, and being good stewards of community—reinforcing habits that carry far beyond the gym.",
        images: [
          { src: "/placeholder.svg", alt: "Smile Lab photo 1" },
          { src: "/placeholder.svg", alt: "Smile Lab photo 2" },
          { src: "/placeholder.svg", alt: "Smile Lab photo 3" },
          { src: "/placeholder.svg", alt: "Smile Lab photo 4" },
          { src: "/placeholder.svg", alt: "Smile Lab photo 5" },
          { src: "/placeholder.svg", alt: "Smile Lab photo 6" },
        ],
        buttonLabel: "Back to Programs",
      },
      {
        id: "lil-champs",
        title: "NJ4S Lil' Champs Program",
        subtitle: "Junior Boxers Only",
        blurb:
          "Lil' Champs provides age-appropriate education programming that strengthens life skills—supporting youth with routines, hygiene, and habits that translate into confidence, responsibility, and community pride.",
        images: [
          { src: "/placeholder.svg", alt: "Lil' Champs photo 1" },
          { src: "/placeholder.svg", alt: "Lil' Champs photo 2" },
          { src: "/placeholder.svg", alt: "Lil' Champs photo 3" },
          { src: "/placeholder.svg", alt: "Lil' Champs photo 4" },
          { src: "/placeholder.svg", alt: "Lil' Champs photo 5" },
          { src: "/placeholder.svg", alt: "Lil' Champs photo 6" },
        ],
        buttonLabel: "Back to Programs",
      },
    ],
    []
  );

  const [openId, setOpenId] = useState<string | null>(null);
  const openItem = items.find((x) => x.id === openId) || null;

  return (
    <section className="py-16 md:py-20 bg-background">
      <div className="container">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          More Programs at NLA
        </h2>
        <p className="mt-3 text-base md:text-lg text-muted-foreground max-w-3xl">
          These programs strengthen the core experience and show how NLA extends impact beyond the gym.
        </p>

        {/* Bullet-style list */}
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <span className="mt-2.5 h-2 w-2 rounded-full bg-foreground flex-shrink-0" />
              <button
                type="button"
                onClick={() => setOpenId(item.id)}
                className="text-left text-lg font-medium text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors"
                aria-haspopup="dialog"
              >
                {item.title}
              </button>
            </li>
          ))}
        </ul>

        {/* Modal */}
        <Dialog open={!!openItem} onOpenChange={(open) => !open && setOpenId(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                {openItem?.title}
              </DialogTitle>
              <p className="text-sm font-medium text-muted-foreground">
                {openItem?.subtitle}
              </p>
            </DialogHeader>
            
            <p className="text-base text-muted-foreground">
              {openItem?.blurb}
            </p>

            {/* Gallery */}
            {openItem && <ClickToEnlargeGallery images={openItem.images} showCaptions />}

            {/* Bottom button */}
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => setOpenId(null)}
                className="bg-foreground text-background hover:bg-foreground/90"
              >
                {openItem?.buttonLabel}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

export default ProgramsExtrasSection;
