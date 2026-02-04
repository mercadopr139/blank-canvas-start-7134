import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Users, TrendingUp, Heart, Shield, ShieldCheck, Utensils, HandHeart, Calendar, Briefcase, RefreshCw } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const ImpactStory = () => {
  const topStats = [
    {
      icon: TrendingUp,
      value: "$2.6M+",
      label: "Raised Since 2020",
      description: "Reinvested in our community"
    },
    {
      icon: Users,
      value: "500+",
      label: "Youth Served Annually",
      description: "Across Cape May County"
    },
    {
      icon: ShieldCheck,
      value: "95%",
      label: "Youth Participate in Non-Contact Boxing",
      description: "Safety-focused training and development"
    }
  ];

  const bottomStats = [
    {
      icon: Heart,
      value: "70%",
      label: "Below Poverty Line",
      description: "Of registered youth"
    },
    {
      icon: Utensils,
      value: "Meals Served",
      label: "Five Nights a Week",
      description: "September through June"
    }
  ];

  const partners = [
    "Schools",
    "Law Enforcement",
    "Mental Health Providers",
    "Public Officials"
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-primary py-16 md:py-24">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-primary-foreground leading-tight mb-6">
                Our Impact
              </h1>
              <p className="text-xl md:text-2xl text-primary-foreground/90 font-medium">
                Real results. Real relationships. Real change.
              </p>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 md:py-20 bg-background">
          <div className="container">
            <div className="max-w-5xl mx-auto">
              {/* Top row: 3 cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-6 md:mb-8">
                {topStats.map((stat, index) => (
                  <Card key={index} className="border-2 border-foreground/10 hover:border-foreground/20 transition-colors">
                    <CardContent className="p-8 text-center">
                      <stat.icon className="h-10 w-10 mx-auto mb-4 text-foreground" />
                      <div className="text-4xl md:text-5xl font-black text-foreground mb-2">
                        {stat.value}
                      </div>
                      <div className="text-lg font-bold text-foreground mb-1">
                        {stat.label}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {stat.description}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* Bottom row: 2 cards centered */}
              <div className="flex flex-col md:flex-row justify-center gap-6 md:gap-8">
                {bottomStats.map((stat, index) => (
                  <Card key={index} className="border-2 border-foreground/10 hover:border-foreground/20 transition-colors md:w-[calc(33.333%-1rem)]">
                    <CardContent className="p-8 text-center">
                      <stat.icon className="h-10 w-10 mx-auto mb-4 text-foreground" />
                      <div className="text-4xl md:text-5xl font-black text-foreground mb-2">
                        {stat.value}
                      </div>
                      <div className="text-lg font-bold text-foreground mb-1">
                        {stat.label}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {stat.description}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Impact Overview */}
        <section className="py-16 md:py-20 bg-primary">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-black text-primary-foreground mb-8">
                How We Build Impact
              </h2>
              <p className="text-lg md:text-xl text-primary-foreground/90 leading-relaxed">
                Impact at NLA is built through <span className="font-bold text-primary-foreground">consistency</span>. 
                Youth commit to the program. Our staff commits to them. By showing up every day during 
                one of the most chaotic seasons of a young person's life, we become a steady, reliable 
                presence that helps guide their personal journey.
              </p>
            </div>
          </div>
        </section>

        {/* Credibility Section */}
        <section className="py-16 md:py-20 bg-background">
          <div className="container">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <Shield className="h-12 w-12 mx-auto mb-4 text-foreground" />
                <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4">
                  Community Impact
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Verified reach across Cape May County through trusted partnerships and community endorsements.
                </p>
              </div>

              <Accordion type="single" collapsible className="w-full space-y-4">
                {/* Schools & Education Partners */}
                <AccordionItem value="schools" className="bg-accent border border-border rounded-lg px-6">
                  <AccordionTrigger className="text-lg font-bold text-foreground hover:no-underline py-6">
                    Schools & Education Partners
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Cape May County Special Services</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Cape May County Technical High School</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Lower Cape May Regional School District</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Middle Township School District</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>North Wildwood School District</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Wildwood Catholic High School</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Wildwood Crest School District</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Wildwood School District</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Woodbine Elementary School</span>
                      </li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                {/* Public Officials & Government Support */}
                <AccordionItem value="officials" className="bg-accent border border-border rounded-lg px-6">
                  <AccordionTrigger className="text-lg font-bold text-foreground hover:no-underline py-6">
                    Public Officials & Government Support
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Middle Township Mayor and former Police Chief, Chris Leusner, and other various Cape May County Mayors</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>New Jersey State Assembly members</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>United States Congressman, Jeff Van Drew</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Cape May County Board of Commissioners leadership</span>
                      </li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                {/* Law Enforcement & Public Safety */}
                <AccordionItem value="law-enforcement" className="bg-accent border border-border rounded-lg px-6">
                  <AccordionTrigger className="text-lg font-bold text-foreground hover:no-underline py-6">
                    Law Enforcement & Public Safety
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Police Chiefs Association of Cape May County</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Cape May Police Chief, Dekon Fashaw</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Middle Township Police Chief, Tracey Super</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Cape May County Prosecutor's Office</span>
                      </li>
                      <li className="flex items-start gap-2 ml-6">
                        <span className="text-foreground mt-1">–</span>
                        <span>Over twelve municipal and county law enforcement agencies across Cape May County</span>
                      </li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                {/* Mental Health & Youth Support Services */}
                <AccordionItem value="mental-health" className="bg-accent border border-border rounded-lg px-6">
                  <AccordionTrigger className="text-lg font-bold text-foreground hover:no-underline py-6">
                    Mental Health & Youth Support Services
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Embedded mental health partnerships</span>
                      </li>
                      <li className="flex items-start gap-2 ml-6">
                        <span className="text-foreground mt-1">–</span>
                        <span>Acenda's NJ4S</span>
                      </li>
                      <li className="flex items-start gap-2 ml-6">
                        <span className="text-foreground mt-1">–</span>
                        <span>Cape Assist</span>
                      </li>
                      <li className="flex items-start gap-2 ml-6">
                        <span className="text-foreground mt-1">–</span>
                        <span>CARA</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Community-based youth support and prevention organizations serving Cape May County</span>
                      </li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </section>

        {/* How Our Work Is Sustained Section */}
        <section className="py-16 md:py-20 bg-primary">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-black text-primary-foreground mb-6 text-center">
                How Our Work Is Sustained
              </h2>
              <p className="text-lg md:text-xl text-primary-foreground/90 leading-relaxed text-center mb-12">
                No Limits Academy operates through a diversified funding model that prioritizes sustainability, transparency, and community trust.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-primary-foreground/10 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <HandHeart className="h-8 w-8 text-primary-foreground shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-bold text-primary-foreground mb-2">Donors</h3>
                      <p className="text-primary-foreground/80">
                        Individual and community supporters who believe in our mission.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary-foreground/10 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <Calendar className="h-8 w-8 text-primary-foreground shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-bold text-primary-foreground mb-2">Fundraising</h3>
                      <p className="text-primary-foreground/80">
                        Events and community-driven initiatives that strengthen local investment.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary-foreground/10 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <Briefcase className="h-8 w-8 text-primary-foreground shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-bold text-primary-foreground mb-2">Fee for Service</h3>
                      <p className="text-primary-foreground/80">
                        Contracted programming with schools and partner agencies that helps offset program costs.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary-foreground/10 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <RefreshCw className="h-8 w-8 text-primary-foreground shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-bold text-primary-foreground mb-2">Re-Grants</h3>
                      <p className="text-primary-foreground/80">
                        County, state, and pass-through funding that supports prevention and youth development efforts.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ImpactStory;
