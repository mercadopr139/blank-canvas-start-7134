import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import nlaAvalonAward from "@/assets/gym-buddies/nla-avalon-award.png";
import middleMattersChrissy from "@/assets/awards/middle-matters-chrissy-casiello.jpg";
const awards = [`BCMF — Be Kind Award Recipient`, `Cape Assist — Partner in Prevention Award`, `Cape May County NAACP Freedom Fund — "Recognition of Educator Award"`, `CMC Chamber of Commerce — Non-Profit of the Year Award`, `Middle Township City Council — "Middle Matters" Civic Recognition Award`, `United States House of Representatives — Congressional Proclamation of Recognition`, `USA Boxing's Mid-Atlantic Association — George Hill Humanitarian Award`].sort((a, b) => a.localeCompare(b));
const ImpactSection = () => {
  return <section className="py-20 md:py-28 bg-background">
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
              Impact at NLA is built through consistency—youth commit to the program, and our staff commits to them. By showing up every day during one of the most chaotic seasons of a young person's life, we become a steady, reliable presence that helps guide their personal journey.
            </p>
            
            <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
              <span className="font-bold text-foreground">70% of our registered youth fall below the federal poverty line.</span>
            </p>
            
            <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
              Our one-stop, wraparound approach to youth development has attracted schools, law enforcement, mental health providers, public officials, and community partners who recognize NLA as a legitimate, trusted hub for real, lasting impact.
            </p>
          </div>

          {/* Gym Buddies CTA */}
          <div className="text-center mt-10">
            <img src={nlaAvalonAward} alt="NLA youth with Avalon Police Chief receiving award" className="mx-auto mb-6 rounded-lg shadow-lg max-w-md w-full" />
            <p className="text-sm md:text-base text-foreground/80 leading-relaxed mb-6">
              Learn more about Gym Buddies and how shared training has strengthened trust and relationships throughout our community.
            </p>
            <Button asChild variant="default" className="bg-foreground text-background hover:bg-foreground/90">
              <Link to="/gym-buddies">Gym Buddies</Link>
            </Button>
          </div>

          {/* Awards & Recognition */}
          <div className="mt-12 rounded-2xl p-6 ring-1 ring-white/10 bg-secondary">
            <h3 className="text-lg font-bold text-foreground">
              Awards & Community Recognition
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              No Limits Academy has been recognized by local, state, and national
              organizations for our youth impact, mentorship, and community leadership.
            </p>
            <ul className="mt-5 space-y-3">
              {awards.map(award => <li key={award} className="flex items-start gap-3">
                  <Trophy className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="text-sm leading-relaxed text-foreground/80">{award}</span>
                </li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>;
};
export default ImpactSection;