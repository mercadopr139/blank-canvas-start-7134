import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import nlaAvalonAward from "@/assets/gym-buddies/nla-avalon-award.png";

const ImpactSection = () => {
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
              No Limits Academy serves over <span className="font-bold text-foreground">500 youth each year</span> across Cape May County.
            </p>

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
            <img 
              src={nlaAvalonAward} 
              alt="NLA youth with Avalon Police Chief receiving award" 
              className="mx-auto mb-6 rounded-lg shadow-lg max-w-md w-full"
            />
            <p className="text-sm md:text-base text-foreground/80 leading-relaxed mb-6">
              Learn more about Gym Buddies and how shared training has strengthened trust and relationships throughout our community.
            </p>
            <Button
              asChild
              variant="default"
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              <Link to="/gym-buddies">Gym Buddies</Link>
            </Button>
          </div>

          {/* Awards & Recognition */}
          <div className="mt-12 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
            <h3 className="text-lg font-bold text-foreground">
              Awards & Community Recognition
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              No Limits Academy has been recognized by local, state, and national
              organizations for our youth impact, mentorship, and community leadership.
            </p>
            <ul className="mt-5 space-y-3">
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-sm leading-relaxed text-foreground/80">
                  2023 Middle Matters Civic Recognition Award
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-sm leading-relaxed text-foreground/80">
                  United States House of Representatives — Congressional Proclamation
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-sm leading-relaxed text-foreground/80">
                  USA Boxing Mid-Atlantic Boxing — George Hill Humanitarian Award
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-sm leading-relaxed text-foreground/80">
                  BCMF — Be Kind Award Recipient
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-sm leading-relaxed text-foreground/80">
                  CMC Chamber of Commerce — Non-Profit of the Year Award
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-sm leading-relaxed text-foreground/80">
                  Cape Assist — Partner in Prevention Award
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-sm leading-relaxed text-foreground/80">
                  Cape May County NAACP Freedom Fund — "Recognition of Educator Award"
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ImpactSection;
