import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Heart } from "lucide-react";
import nlaAvalonAward from "@/assets/gym-buddies/nla-avalon-award.png";
import middleMattersChrissy from "@/assets/awards/middle-matters-chrissy-casiello.jpg";
import georgeHillAward from "@/assets/awards/george-hill-award-ceremony.jpeg";
const awards = [`BCMF — Be Kind Award Recipient`, `Cape Assist — Partner in Prevention Award`, `Cape May County NAACP Freedom Fund — "Recognition of Educator Award"`, `CMC Chamber of Commerce — Non-Profit of the Year Award`, `Middle Township City Council — "Middle Matters" Civic Recognition Award`, `United States House of Representatives — Congressional Proclamation of Recognition`, `USA Boxing's Mid-Atlantic Association — George Hill Humanitarian Award`].sort((a, b) => a.localeCompare(b));
const ImpactSection = () => {
  return <><section className="md:pt-28 md:pb-10 bg-background py-[30px]">
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

            {/* Impact Stats */}
            
            
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

    {/* Awards & Community Recognition - separate black section */}
    <section className="py-16 bg-black md:py-[60px]">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Awards & Community Recognition
          </h3>
          <p className="text-sm leading-relaxed text-white/70 mb-8">
            No Limits Academy has been recognized by local, state, and national
            organizations for our youth impact, mentorship, and community leadership.
          </p>
          <ul className="space-y-3">
            {awards.map((award) => <li key={award} className="flex items-start gap-3">
                <Trophy className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#bf0f3e]" />
                <span className="text-sm leading-relaxed text-white/80">{award}</span>
              </li>)}
          </ul>
          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-2xl rounded-lg overflow-hidden">
              <img src={georgeHillAward} alt="NLA receives USA Boxing George Hill Humanitarian Award at Middle Township" className="w-full object-cover object-bottom" style={{ marginTop: '-15%' }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  </>;
};
export default ImpactSection;