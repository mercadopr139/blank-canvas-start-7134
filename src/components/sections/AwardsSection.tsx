import { Trophy } from "lucide-react";
import georgeHillAward from "@/assets/awards/george-hill-award-ceremony.jpeg";

const awards = [
  `BCMF — Be Kind Award Recipient`,
  `Cape Assist — Partner in Prevention Award`,
  `Cape May County NAACP Freedom Fund — Recognition of Educator Award`,
  `Cape May County Chamber of Commerce — Non-Profit of the Year Award`,
  `Middle Township City Council — "Middle Matters" Civic Recognition Award`,
  `United States House of Representatives — Congressional Proclamation of Recognition`,
  `USA Boxing's Mid-Atlantic Association — George Hill Humanitarian Award`,
].sort((a, b) => a.localeCompare(b));

const AwardsSection = () => {
  return (
    <section className="py-16 bg-black md:py-[60px]" id="awards">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="border-l-4 border-[#bf0f3e] pl-4 mb-8">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#bf0f3e] mb-2">
              Honored & Recognized
            </p>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Awards & Community Recognition
            </h3>
            <p className="text-sm leading-relaxed text-white/70">
              No Limits Academy has been recognized by local, state, and national
              organizations for our youth impact, mentorship, and community leadership.
            </p>
          </div>

          {/* Feature photo — full width, cleanly framed (no forced crop) */}
          <figure className="mb-8">
            <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50 aspect-[5/2] md:aspect-[3/1]">
              <img
                src={georgeHillAward}
                alt="No Limits Academy receives the USA Boxing George Hill Humanitarian Award at Middle Township"
                className="w-full h-full object-cover"
                style={{ objectPosition: "50% 64%" }}
              />
            </div>
            <figcaption className="mt-3 text-center text-xs text-white/50">
              No Limits Academy honored at Middle Township — accepting the USA Boxing George Hill Humanitarian Award.
            </figcaption>
          </figure>

          {/* Award bullets */}
          <ul className="space-y-3">
            {awards.map((award) => (
              <li key={award} className="flex items-start gap-3">
                <Trophy className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#bf0f3e]" />
                <span className="text-sm leading-relaxed text-white/80">{award}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 border-b border-white/30" />
        </div>
      </div>
    </section>
  );
};

export default AwardsSection;
