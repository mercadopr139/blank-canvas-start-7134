import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const houseRules = [
  {
    number: 1,
    title: "RESPECT",
    description:
      'Greet all coaches, mentors, and adults upon arrival and departure. Address all coaches, mentors, and adults as "Coach," "Sir," or "Ma\'am."',
  },
  {
    number: 2,
    title: "BE ON TIME",
    description:
      "Being on time means you are 15 minutes early. No call, no show is unacceptable. 100% attendance is not required. 100% communication is required.",
  },
  {
    number: 3,
    title: "BE PREPARED",
    description:
      "Show up at the right time with the right attitude, the right equipment, and right attire.",
  },
  {
    number: 4,
    title: "SUPPORT YOUR TEAM",
    description:
      "The gym is a community far bigger than you. Always contribute to the team and remember, to whom much is given, much will be required.",
  },
  {
    number: 5,
    title: "RESPECT YOUR TEAM",
    description:
      "Never fight a fellow NLA Boxer. Love and correct them. If there is an issue, squash it immediately.",
  },
  {
    number: 6,
    title: "BE CREDIBLE",
    description:
      "Tell the entire truth, never lie, and remain accountable for your actions. We will not steal. We will not do drugs.",
  },
  {
    number: 7,
    title: "NO SOCIAL MEDIA",
    description:
      "We are internally driven. NLA has a social media director that will ensure our values are never misrepresented.",
  },
  {
    number: 8,
    title: "BE A LEADER",
    description:
      "Leaders outwork everyone in the room. If you are unsure if something is your responsibility, be assertive and make it your responsibility. In the absence of direction, NLA Boxers lead and take action. Take ownership and pride in whatever role you have.",
  },
  {
    number: 9,
    title: "KEEP YOUR HOUSE ORDERLY",
    description:
      "Clean the gym daily, never neglect or take it for granted. Make improvements when needed and keep it secure.",
  },
  {
    number: 10,
    title: "WE ARE NOT VICTIMS",
    description:
      "Life is unfair, unforgiving, and exhausting. Our past is our past. Resiliency is developed through challenging circumstances.",
  },
];

const HouseRules = () => {
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Header />
      <main className="flex-1 px-4 py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <Link
              to="/rookie-orientation#step-4"
              className="inline-flex items-center text-neutral-400 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orientation
            </Link>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
              NLA HOUSE RULES
            </h1>
            <p className="text-neutral-400">
              Know them. Live them. These are non-negotiable.
            </p>
          </div>

          {/* Rules */}
          <div className="space-y-4">
            {houseRules.map((rule) => (
              <div
                key={rule.number}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 md:p-6 flex gap-4 items-start"
              >
                <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[#bf0f3e] flex items-center justify-center text-sm font-black text-white">
                  {rule.number}
                </span>
                <div>
                  <h3 className="text-white font-bold text-lg mb-1">
                    {rule.title}
                  </h3>
                  <p className="text-neutral-300 text-sm leading-relaxed">
                    {rule.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer className="bg-neutral-950 border-neutral-800" />
    </div>
  );
};

export default HouseRules;
