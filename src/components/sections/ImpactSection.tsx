import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Heart } from "lucide-react";
import nlaAvalonAward from "@/assets/gym-buddies/nla-avalon-award.png";
import middleMattersChrissy from "@/assets/awards/middle-matters-chrissy-casiello.jpg";

const ImpactSection = () => {
  return (
    <section className="md:pt-28 md:pb-10 bg-background py-[30px]">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          {/* Section header */}
          <div className="text-left mb-8">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground mb-6">
              Impact & Credibility
            </h2>
          </div>

          {/* Middle Matters Award Image */}
          <div className="mb-10 rounded-xl overflow-hidden bg-muted">
            <img src={middleMattersChrissy} alt="Middle Township honors NLA Program Director Chrissy Casiello with Middle Matters Award" className="w-full" style={{
              objectFit: 'contain'
            }} />
          </div>

          {/* Content */}
          <div className="space-y-6 text-left">
            <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
              Impact at NLA is built through consistency. Youth commit to the program, and our staff commits to them. By becoming a steady, reliable presence during one of the most chaotic seasons of a young person's life, we can help guide their personal journeys.
            </p>

            <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
              Our one-stop, wraparound approach to youth development has attracted schools, law enforcement, mental health providers, public officials, and community partners who recognize NLA as a legitimate, trusted hub for real, lasting impact.
            </p>
          </div>

          {/* Gym Buddies CTA */}
          <div className="text-center mt-10">
            <div className="max-w-md mx-auto">
              <img src={nlaAvalonAward} alt="NLA youth with Avalon Police Chief receiving award" className="w-full rounded-lg shadow-lg" />
              <p className="text-xs md:text-sm text-foreground/60 leading-relaxed mt-2 mb-6">
                Learn more about Gym Buddies and how shared training has strengthened trust and relationships throughout our community.
              </p>
            </div>
            <Button asChild variant="default" className="bg-foreground text-background hover:bg-foreground/90">
              <Link to="/gym-buddies">Gym Buddies</Link>
            </Button>
          </div>

        </div>
      </div>
    </section>
  );
};
export default ImpactSection;