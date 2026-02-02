import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Gym Buddies images
import gymBuddies1 from "@/assets/gym-buddies/cops-and-hoopers-2.png";
import gymBuddies2 from "@/assets/gym-buddies/nla-police-chiefs-association.png";
import gymBuddies3 from "@/assets/gym-buddies/knockout-cookout-mtpd.png";
import gymBuddies4 from "@/assets/gym-buddies/nla-wildwood-pd.png";
import gymBuddies5 from "@/assets/gym-buddies/chiefs-of-cmc.png";
import gymBuddies6 from "@/assets/gym-buddies/cmc-finest.png";

type ProgramItem = {
  id: string;
  title: string;
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
        blurb:
          "Gym Buddies brings youth together with law enforcement officers, firefighters, and service members for shared workouts that build mutual trust, respect, and understanding—strengthening relationships both inside and beyond the gym.",
        images: [
          { src: gymBuddies1, alt: "Cops and Hoopers community event" },
          { src: gymBuddies2, alt: "NLA with Police Chiefs Association" },
          { src: gymBuddies3, alt: "Knockout Cookout with Middle Township PD" },
          { src: gymBuddies4, alt: "NLA with Wildwood Police Department" },
          { src: gymBuddies5, alt: "Chiefs of Cape May County" },
          { src: gymBuddies6, alt: "Cape May County's finest officers" },
        ],
        buttonLabel: "Back to Programs",
      },
      {
        id: "excursions",
        title: "Excursions",
        blurb:
          "Our excursions take youth beyond the facility walls—exposing them to new experiences, education, and opportunities that expand perspective and reinforce life skills learned in the gym.",
        images: [
          { src: "/placeholder.svg", alt: "Excursions photo 1" },
          { src: "/placeholder.svg", alt: "Excursions photo 2" },
          { src: "/placeholder.svg", alt: "Excursions photo 3" },
          { src: "/placeholder.svg", alt: "Excursions photo 4" },
          { src: "/placeholder.svg", alt: "Excursions photo 5" },
          { src: "/placeholder.svg", alt: "Excursions photo 6" },
        ],
        buttonLabel: "Back to Programs",
      },
      {
        id: "launch-pad",
        title: "The Launch Pad",
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
            </DialogHeader>
            
            <p className="text-base text-muted-foreground">
              {openItem?.blurb}
            </p>

            {/* Gallery */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {openItem?.images.slice(0, 6).map((img, idx) => (
                <div 
                  key={idx} 
                  className="overflow-hidden rounded-xl border border-border bg-muted"
                >
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>

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
