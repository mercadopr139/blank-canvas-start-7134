import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const houseRules = [
  {
    number: 1,
    title: "RESPECT",
    description:
      "Address all coaches, mentors, and adults as 'Coach,' 'Sir,' or 'Ma'am.' Greet everyone who walks through the door. Respect is earned and given freely at NLA.",
  },
  {
    number: 2,
    title: "BE ON TIME",
    description:
      "Being 'on time' at NLA means arriving 15 minutes early. If you're early, you're on time. If you're on time, you're late. If you're late, don't bother.",
  },
  {
    number: 3,
    title: "BE PREPARED",
    description:
      "Show up with the right attitude, equipment, and attire. Being prepared means you're ready to work the moment practice begins.",
  },
  {
    number: 4,
    title: "SUPPORT YOUR TEAM",
    description:
      "The gym is a community far bigger than you. Cheer on your teammates, encourage one another, and lift each other up. We win together.",
  },
  {
    number: 5,
    title: "RESPECT YOUR TEAM",
    description:
      "If you have an issue with a fellow NLA Boxer, love and correct them — squash the issue immediately. No grudges, no drama. Handle it face to face.",
  },
  {
    number: 6,
    title: "BE CREDIBLE",
    description:
      "Tell the entire truth, never lie, and remain accountable. No stealing, no drugs, no dishonesty. Your word is your bond at NLA.",
  },
  {
    number: 7,
    title: "NO SOCIAL MEDIA",
    description:
      "NLA has a social media director to ensure our values are never misrepresented. Do not post NLA content without approval. Protect the brand.",
  },
  {
    number: 8,
    title: "BE A LEADER",
    description:
      "In the absence of direction, lead and take action. Don't wait to be told what to do. Step up, take initiative, and set the example.",
  },
  {
    number: 9,
    title: "KEEP YOUR HOUSE ORDERLY",
    description:
      "The gym is cleaned daily. Put equipment back where it belongs. If you see something out of place, fix it. This is your house — treat it that way.",
  },
  {
    number: 10,
    title: "WE ARE NOT VICTIMS",
    description:
      "Resiliency is developed through challenging circumstances. We don't complain, we don't quit, and we don't make excuses. We overcome.",
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
