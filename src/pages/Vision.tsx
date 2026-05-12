import {
  Shield,
  GraduationCap,
  Wrench,
  Briefcase,
  Compass,
  ClipboardCheck,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import launchPadLogoNew from "@/assets/programs/launch-pad-logo-new.png";

const FOUR_PADS = [
  {
    icon: Shield,
    title: "Military & Law Enforcement",
    body: "ASVAB preparation, recruiter matching, and full readiness for service.",
  },
  {
    icon: GraduationCap,
    title: "College",
    body: "SAT prep, scholarship and financial aid applications, housing, and admissions support.",
  },
  {
    icon: Wrench,
    title: "Trade School",
    body: "Application support and guidance through every phase of the trade school process.",
  },
  {
    icon: Briefcase,
    title: "Workforce",
    body: "Direct placement within our growing network of local business owners and organizations committed to developing young leaders.",
  },
];

const UNIVERSAL_CURRICULUM = [
  "Professionalism — how to dress, present, and carry yourself",
  "Work ethic — showing up early, staying late, finishing the job",
  "The value of starting at the bottom and earning your way up",
  "Communication, conduct, and character",
  "Long-term thinking and personal accountability",
];

const Vision = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-primary py-20 md:py-[50px]">
          <div className="container">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-primary-foreground leading-[1.1] tracking-tight mb-6">
                Our Vision
              </h1>
              <p className="text-xl md:text-2xl font-semibold text-primary-foreground/70 leading-snug">
                To become a national leader in youth development — building a model that transforms how young people discover their gifts, choose their path, and execute on their future.
              </p>
            </div>
          </div>
        </section>

        {/* Our Social Entrepreneurship Model */}
        <section className="bg-background md:py-[60px] py-[30px]">
          <div className="container">
            <div className="max-w-4xl">
              <div className="flex items-center justify-between gap-3 md:gap-5 mb-8">
                <div className="flex-1">
                  <div className="flex items-start gap-4">
                    <div className="w-1 self-stretch rounded-full bg-nla shrink-0" />
                    <div>
                      <span className="inline-block text-xs font-black tracking-[0.25em] uppercase text-nla mb-2">
                        The Model
                      </span>
                      <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground leading-[1.1] tracking-tight">
                        Our Social Entrepreneurship Model
                      </h2>
                    </div>
                  </div>
                </div>
                <img
                  src={launchPadLogoNew}
                  alt="The Launch Pad"
                  className="hidden md:block h-32 lg:h-40 w-auto shrink-0"
                />
              </div>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">
                At No Limits Academy, youth don't just join a program — they enter a <strong className="text-foreground">development pipeline</strong>.
              </p>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                We don't just train athletes. We develop <strong className="text-foreground">future leaders, employees, employers, entrepreneurs, and community builders</strong> — young people equipped to break cycles of poverty and lead the next generation forward.
              </p>
              <div className="md:hidden flex justify-center mt-8">
                <img
                  src={launchPadLogoNew}
                  alt="The Launch Pad"
                  className="h-40 w-auto"
                />
              </div>
            </div>
          </div>
        </section>

        {/* The Launch Pad — intro + Workforce Standard callout */}
        <section className="py-16 bg-primary md:py-[60px] overflow-hidden">
          <div className="container">
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
              <div className="flex-1">
                <div className="flex items-start gap-4 mb-8">
                  <div className="w-1 self-stretch rounded-full bg-nla shrink-0" />
                  <div>
                    <span className="inline-block text-xs font-black tracking-[0.25em] uppercase text-nla mb-2">
                      The Launch Pad
                    </span>
                    <h2 className="text-3xl md:text-4xl font-black text-primary-foreground leading-tight">
                      Where purpose meets a plan.
                    </h2>
                  </div>
                </div>

                <p className="text-lg md:text-xl text-primary-foreground/80 leading-relaxed mb-8">
                  The Launch Pad is what separates No Limits Academy from every other youth program. Starting at age 15, youth enter a classroom environment designed around an introspective process — one that helps them identify their <strong className="text-primary-foreground">God-given strengths</strong> and align those gifts with a real, viable future.
                </p>

                {/* Workforce Standard callout */}
                <div className="border-l-4 border-nla bg-primary-foreground/5 rounded-r-lg p-6 md:p-7">
                  <p className="text-xs font-black tracking-[0.2em] uppercase text-nla mb-3">
                    Our Workforce Standard
                  </p>
                  <p className="text-base md:text-lg text-primary-foreground/85 leading-relaxed">
                    We only place youth with employers committed to developing them as <strong className="text-primary-foreground">future leaders, owners, and decision-makers</strong>. Every placement is a leadership pipeline — not a labor pipeline. Breaking cycles of poverty requires proximity to leaders who pull young people upward.
                  </p>
                </div>
              </div>

              <div className="shrink-0 lg:w-[340px] xl:w-[420px]">
                <img
                  src={launchPadLogoNew}
                  alt="The Launch Pad"
                  className="w-full h-auto drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </section>

        {/* The Four Pads */}
        <section className="py-16 bg-background md:py-[80px]">
          <div className="container">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-1 self-stretch rounded-full bg-nla shrink-0" />
                <div>
                  <span className="inline-block text-xs font-black tracking-[0.25em] uppercase text-nla mb-2">
                    The Four Pads
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black text-foreground leading-[1.1] tracking-tight">
                    Four pathways. One plan per young person.
                  </h2>
                </div>
              </div>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 md:ml-5">
                Every young person in the program chooses one of four pathways — and we build a plan around it.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                {FOUR_PADS.map(({ icon: Icon, title, body }) => (
                  <div
                    key={title}
                    className="bg-primary rounded-2xl p-6 md:p-7 flex flex-col gap-4 hover:scale-[1.01] transition-transform"
                  >
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-nla/15 text-nla shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-black text-primary-foreground leading-tight mb-2">
                        {title}
                      </h3>
                      <p className="text-base text-primary-foreground/70 leading-relaxed">
                        {body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Two Coaches. One Mission. */}
        <section className="py-16 bg-primary md:py-[80px]">
          <div className="container">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-1 self-stretch rounded-full bg-nla shrink-0" />
                <div>
                  <span className="inline-block text-xs font-black tracking-[0.25em] uppercase text-nla mb-2">
                    The Coaches
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black text-primary-foreground leading-[1.1] tracking-tight">
                    Two Coaches. One Mission.
                  </h2>
                </div>
              </div>

              <p className="text-lg md:text-xl text-primary-foreground/70 leading-relaxed mb-10 md:ml-5">
                What makes The Launch Pad different isn't just the plan — it's the people walking with each young person every step of the way.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                <div className="bg-primary-foreground/[0.04] border border-primary-foreground/10 rounded-2xl p-7 md:p-8">
                  <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-nla/15 text-nla mb-5">
                    <Compass className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-primary-foreground leading-tight mb-3">
                    Pathway Coach
                  </h3>
                  <p className="text-base md:text-lg text-primary-foreground/75 leading-relaxed">
                    Helps each young person discover their strengths, clarify their gifts, and align with the Pad that fits their calling.
                  </p>
                </div>

                <div className="bg-primary-foreground/[0.04] border border-primary-foreground/10 rounded-2xl p-7 md:p-8">
                  <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-nla/15 text-nla mb-5">
                    <ClipboardCheck className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-primary-foreground leading-tight mb-3">
                    Accountability Coach
                  </h3>
                  <p className="text-base md:text-lg text-primary-foreground/75 leading-relaxed">
                    Owns the follow-through. Ensures every step — every test, every application, every deadline — is completed so the youth graduates ready to execute on their plan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The Universal Curriculum */}
        <section className="py-16 bg-background md:py-[80px]">
          <div className="container">
            <div className="max-w-4xl">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-1 self-stretch rounded-full bg-nla shrink-0" />
                <div>
                  <span className="inline-block text-xs font-black tracking-[0.25em] uppercase text-nla mb-2">
                    The Curriculum
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black text-foreground leading-[1.1] tracking-tight">
                    The Universal Curriculum
                  </h2>
                </div>
              </div>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 md:ml-5">
                Some of the most important lessons in life are best learned outside the classroom — through mentorship, real-world experience, and high standards. The Launch Pad teaches the fundamentals every young person needs to thrive, no matter which Pad they choose:
              </p>

              <ul className="space-y-4 mb-10 md:ml-5">
                {UNIVERSAL_CURRICULUM.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-2 w-2 rounded-full bg-nla shrink-0" />
                    <span className="text-lg text-foreground font-medium">{item}</span>
                  </li>
                ))}
              </ul>

              <p className="text-xl md:text-2xl font-bold text-foreground leading-snug md:ml-5">
                Our goal is simple: produce young people so prepared, so professional, and so disciplined that they become the <strong className="text-nla">most sought-after talent</strong> in their generation.
              </p>
            </div>
          </div>
        </section>

        {/* Why It Matters — black, opens the donor moment leading into the closer */}
        <section className="py-16 bg-primary md:py-[60px]">
          <div className="container">
            <div className="max-w-3xl">
              <div className="flex items-start gap-4 mb-8">
                <div className="w-1 self-stretch rounded-full bg-nla shrink-0" />
                <div>
                  <span className="inline-block text-xs font-black tracking-[0.25em] uppercase text-nla mb-2">
                    Why It Matters
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black text-primary-foreground leading-[1.1] tracking-tight">
                    Most youth programs end when the program ends.
                  </h2>
                </div>
              </div>
              <p className="text-lg md:text-xl text-primary-foreground/75 leading-relaxed mb-6">
                No Limits Academy is built differently. The Launch Pad is a <strong className="text-primary-foreground">long-term model of development</strong> that produces lasting outcomes — young people who graduate high school with a clear plan, the discipline to execute it, and a network of mentors and partners ready to support them.
              </p>
              <p className="text-lg md:text-xl text-primary-foreground/75 leading-relaxed">
                For donors and funders, that means your investment doesn't just fund training. You're investing in a <strong className="text-primary-foreground">system that changes life trajectories</strong> — and breaks generational cycles, one young person at a time.
              </p>
            </div>
          </div>
        </section>

        {/* Subtle divider so Why It Matters and the closer don't visually
            blur into a single block, even though both are black. */}
        <div className="bg-primary">
          <div className="container">
            <div className="max-w-3xl mx-auto">
              <div className="h-px bg-nla/40" />
            </div>
          </div>
        </div>

        {/* Invest in a generation — closer / donor statement */}
        <section className="bg-primary py-16 md:py-[80px]">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-4xl md:text-5xl font-black text-primary-foreground leading-[1.05] tracking-tight mb-6">
                Invest in a generation.
              </h2>
              <p className="text-lg md:text-xl text-primary-foreground/75 leading-relaxed">
                Your support fuels every Pad, every coach, and every young person in the pipeline. Join us in building a model that doesn't just change individual lives — it changes the future of entire communities.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Vision;
