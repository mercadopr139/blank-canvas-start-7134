import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const ImpactSection = () => {
  const [isOpen, setIsOpen] = useState(false);

  const gymBuddiesImages = [
    {
      src: "/placeholder.svg",
      alt: "Partnership with local law enforcement",
      caption: "Law Enforcement",
    },
    {
      src: "/placeholder.svg",
      alt: "Fire department collaboration",
      caption: "Fire Department",
    },
    {
      src: "/placeholder.svg",
      alt: "U.S. Coast Guard partnership",
      caption: "U.S. Coast Guard",
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          {/* Section header */}
          <div className="text-left mb-8">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground mb-6">
              Impact & Credibility
            </h2>
          </div>

          {/* Content */}
          <div className="space-y-6 text-left">
            <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
              Impact at NLA is built through consistency—youth commit to the program, and our staff commits to them. By showing up every day during one of the most chaotic seasons of a young person's life, we become a steady, reliable presence that helps guide their personal journey.
            </p>
            
            <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
              No Limits Academy serves over <span className="font-bold text-foreground">500 youth each year</span> across Cape May County.
            </p>
            
            <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
              <span className="font-bold text-foreground">70% of our registered youth fall below the federal poverty line.</span>
            </p>
            
            <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
              Our one-stop, wraparound approach to youth development has attracted schools, law enforcement, mental health providers, public officials, and community partners who recognize NLA as a legitimate, trusted hub for real, lasting impact.
            </p>
          </div>

          {/* Gym Buddies Collapsible */}
          <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-10">
            <div className="flex justify-center">
              <CollapsibleTrigger asChild>
                <Button
                  variant="default"
                  className="group bg-foreground text-background hover:bg-foreground/90"
                >
                  Gym Buddies
                  <ChevronDown
                    className={cn(
                      "ml-2 h-4 w-4 transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-6 space-y-6">
              {/* Description */}
              <div className="text-left">
                <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4">
                  Gym Buddies Program
                </h3>
                <p className="text-lg text-foreground/80 leading-relaxed">
                  Gym Buddies brings local first responders—law enforcement officers, firefighters, and U.S. Coast Guard members—into the gym to train alongside our youth. These sessions build trust, break down barriers, and create meaningful connections between young people and the heroes who serve their community. It's mentorship in action, one workout at a time.
                </p>
              </div>

              {/* Photo Gallery */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {gymBuddiesImages.map((image, index) => (
                  <div key={index} className="group relative overflow-hidden rounded-lg">
                    <div className="aspect-[4/3] bg-muted">
                      <img
                        src={image.src}
                        alt={image.alt}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-foreground/80 text-background px-3 py-2">
                      <p className="text-sm font-medium">{image.caption}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </section>
  );
};

export default ImpactSection;
