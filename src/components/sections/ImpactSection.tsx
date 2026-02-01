import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

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

          {/* Gym Buddies Button */}
          <div className="flex justify-center mt-10">
            <Button
              asChild
              variant="default"
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              <Link to="/gym-buddies">Gym Buddies</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ImpactSection;
