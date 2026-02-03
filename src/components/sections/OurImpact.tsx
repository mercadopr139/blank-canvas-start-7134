import { Button } from "@/components/ui/button";

function ImpactCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="bg-card rounded-xl p-6 shadow-sm border">
      <h3 className="text-lg font-bold text-foreground mb-3">{title}</h3>
      <ul className="space-y-2">
        {lines.map((l, idx) => (
          <li key={idx} className="text-muted-foreground text-sm leading-relaxed">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OurImpact() {
  const donateUrl = "https://www.paypal.com/ncp/payment/TMMDVUSEQKHJC";

  return (
    <section id="impact" className="py-20 md:py-28 bg-background">
      <div className="container">
        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground mb-6">
            Our Impact
          </h2>

          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8">
            No Limits Academy (NLA) is a trusted youth-development hub in Cape May County—built on
            daily structure, real relationships, and boxing-based mentorship that keeps kids safe,
            supported, and progressing.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Button
              className="bg-[#bf0f3e] hover:bg-[#a00d35] text-white font-semibold"
              onClick={() => window.open(donateUrl, "_blank", "noopener,noreferrer")}
            >
              Donate
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/programs")}
            >
              Explore Programs
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/gym-buddies")}
            >
              Gym Buddies
            </Button>
          </div>
        </div>

        {/* Impact highlights */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <ImpactCard
            title="Youth Served"
            lines={[
              "500+ youth served annually",
              "70% fall below the federal poverty line",
              "Free programming for all participants",
            ]}
          />
          <ImpactCard
            title="Daily Structure"
            lines={[
              "4 days/week boxing-based mentorship",
              "After-school and summer programming",
              "Meals provided at every session",
            ]}
          />
          <ImpactCard
            title="Community Trust"
            lines={[
              "Partnerships with local schools",
              "Law enforcement collaboration",
              "Mental health provider network",
            ]}
          />
        </div>

        {/* Proof + partners */}
        <div className="max-w-3xl mx-auto space-y-10">
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4">
              Proof of Credibility
            </h3>

            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                NLA maintains fee-for-service partnerships with Woodbine Elementary School District,
                Cape May County Technical High School, and Cape May County Special Services School
                District—demonstrating strong institutional trust and consistent collaboration.
              </p>

              <p className="text-muted-foreground leading-relaxed">
                Our model has been highlighted at statewide professional development conferences as a
                promising approach to student engagement and support—showing that what's working in
                Cape May County is being noticed beyond it.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4">
              Financial Strength & Sustainability
            </h3>

            <p className="text-muted-foreground leading-relaxed">
              From 2021–2025, NLA's reported annual revenue grew year-over-year:
              <span className="font-semibold text-foreground">
                {" "}
                $149K → $374K → $519K → $597K → $932K
              </span>
              , totaling approximately{" "}
              <span className="font-semibold text-foreground">$2.57M over five years</span>—supporting
              free programming for youth and long-term stability.
            </p>
          </div>

          <div>
            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4">
              Why This Matters
            </h3>

            <p className="text-muted-foreground leading-relaxed">
              We don't just run practices—we provide consistent structure, mentorship, meals, and
              support systems that families can rely on. Boxing is the tool. Life readiness is the
              outcome.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
