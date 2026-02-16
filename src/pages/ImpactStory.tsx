import { useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Users, TrendingUp, Heart, Shield, ShieldCheck, Utensils, HandHeart, Calendar, Briefcase, RefreshCw, Bus } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
const ImpactStory = () => {
  const [demographicsOpen, setDemographicsOpen] = useState(false);
  const [transportationOpen, setTransportationOpen] = useState(false);
  const topStats = [{
    icon: TrendingUp,
    value: "$2.6M+",
    label: "Raised Since 2020",
    description: "Reinvested in our community"
  }, {
    icon: Users,
    value: "500+",
    label: "Youth Served Annually",
    description: "Across Cape May County"
  }, {
    icon: ShieldCheck,
    value: "95%",
    label: "Youth Participate in Non-Contact Boxing",
    description: "Safety-focused training and development"
  }];
  const bottomStats = [{
    icon: Heart,
    value: "70%",
    label: "Below Poverty Line",
    description: "Of registered youth"
  }, {
    icon: Utensils,
    value: "Meals Served",
    label: "Five Nights a Week",
    description: "September through June"
  }];
  const partners = ["Schools", "Law Enforcement", "Mental Health Providers", "Public Officials"];
  return <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-primary md:py-24 py-[30px]">
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
                {topStats.map((stat, index) => {
                const isYouthCard = stat.label === "Youth Served Annually";
                return <Card key={index} className={`border-2 border-foreground/10 hover:border-foreground/20 transition-colors ${isYouthCard ? "cursor-pointer hover:shadow-lg" : ""}`} onClick={isYouthCard ? () => setDemographicsOpen(true) : undefined}>
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
                        {isYouthCard && <div className="mt-3 text-sm font-medium text-[#bf0f3e] hover:text-[#bf0f3e]/80 transition-colors">
                            View NLA demographics →
                          </div>}
                      </CardContent>
                    </Card>;
              })}
              </div>
              
              {/* Bottom row: 3 cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {bottomStats.map((stat, index) => <Card key={index} className="border-2 border-foreground/10 hover:border-foreground/20 transition-colors">
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
                  </Card>)}
                
                {/* Transportation Card */}
                <Card className="border-2 border-foreground/10 hover:border-foreground/20 hover:shadow-lg transition-all cursor-pointer" onClick={() => setTransportationOpen(true)}>
                  <CardContent className="p-8 text-center">
                    <Bus className="h-10 w-10 mx-auto mb-4 text-foreground" />
                    <div className="text-4xl md:text-5xl font-black text-foreground mb-2">
                      Free
                    </div>
                    <div className="text-lg font-bold text-foreground mb-1">
                      Transportation
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Five days a week
                    </div>
                    <div className="mt-3 text-sm font-medium text-[#bf0f3e] hover:text-[#bf0f3e]/80 transition-colors">
                      View NLA fleet →
                    </div>
                  </CardContent>
                </Card>
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
        <section className="md:py-20 bg-background py-[30px]">
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
                    <p className="text-sm text-muted-foreground mb-4">
                      NLA has become a trusted resource for local schools, establishing itself as a creative, innovative partner for behavioral intervention and extended support for youth across Cape May County.
                    </p>
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
                    <p className="text-sm text-muted-foreground mb-4">
                      Elected officials and government leaders at the municipal, county, state, and federal levels have recognized NLA's impact and actively supported our mission through endorsements, proclamations, and ongoing collaboration.
                    </p>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>Middle Township Mayor and former Police Chief Chris Leusner, along with multiple municipal mayors across Cape May County</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>New Jersey State Assembly members</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-foreground mt-1">•</span>
                        <span>United States Representative for New Jersey's 2nd Congressional District </span>
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
                    <p className="text-sm text-muted-foreground mb-4">
                      Through our Gym Buddies initiative and community partnerships, NLA has built genuine, trust-based relationships with law enforcement agencies across Cape May County—bridging the gap between officers and the youth they serve.
                    </p>
                    {(() => {
                    const lawEnforcementPartners = ["Avalon Police Department", "Blue Knights Motorcycle Club", "Cape May County Prosecutor's Office", "Cape May County Sheriff's Department", "Cape May Police Department", "Lower Township Police Department", "Middle Township Police Department", "North Wildwood Police Department", "Police Benevolent Association (Local PBA 59)", "Wildwood Crest Police Department", "Wildwood Police Department"].sort((a, b) => a.localeCompare(b));
                    return <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                          {lawEnforcementPartners.map((item) => <li key={item}>{item}</li>)}
                        </ul>;
                  })()}
                  </AccordionContent>
                </AccordionItem>

                {/* Mental Health & Youth Support Services */}
                <AccordionItem value="mental-health" className="bg-accent border border-border rounded-lg px-6">
                  <AccordionTrigger className="text-lg font-bold text-foreground hover:no-underline py-6">
                    Mental Health & Youth Support Services
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <p className="text-sm text-muted-foreground mb-4">
                      NLA partners with licensed mental health providers and youth-serving organizations to offer embedded, on-site support—ensuring our kids have access to counseling and prevention services right where they already are.
                    </p>
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
                <div className="bg-foreground rounded-lg p-6 border-l-4 border-[#2d6a4f]">
                  <div className="flex items-start gap-4">
                    <HandHeart className="h-8 w-8 text-[#2d6a4f] shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-bold text-background mb-2">Donors</h3>
                      <p className="text-background/80">
                        Individual and community supporters who believe in our mission.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-foreground rounded-lg p-6 border-l-4 border-[#2d6a4f]">
                  <div className="flex items-start gap-4">
                    <Calendar className="h-8 w-8 text-[#2d6a4f] shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-bold text-background mb-2">Fundraising</h3>
                      <p className="text-background/80">
                        Events and community-driven initiatives that strengthen local investment.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-foreground rounded-lg p-6 border-l-4 border-[#2d6a4f]">
                  <div className="flex items-start gap-4">
                    <Briefcase className="h-8 w-8 text-[#2d6a4f] shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-bold text-background mb-2">Fee for Service</h3>
                      <p className="text-background/80">
                        Contracted programming with schools and partner agencies that helps offset program costs.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-foreground rounded-lg p-6 border-l-4 border-[#2d6a4f]">
                  <div className="flex items-start gap-4">
                    <RefreshCw className="h-8 w-8 text-[#2d6a4f] shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-bold text-background mb-2">Re-Grants</h3>
                      <p className="text-background/80">
                        County, state, and pass-through funding that supports prevention and youth development efforts.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* Demographics Modal */}
        <Dialog open={demographicsOpen} onOpenChange={setDemographicsOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-foreground">
                NLA Youth Demographics
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 pt-4">
              {/* Gender */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-3">Gender</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>Boys: 70%</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>Girls: 30%</span>
                  </li>
                </ul>
              </div>

              {/* Family Structure */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-3">Family Structure</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>143 youth living in single-parent households headed by mothers</span>
                  </li>
                </ul>
              </div>

              {/* Race / Ethnic Composition */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-3">Race / Ethnic Composition</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>Caucasian: 36.8%</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>Hispanic/Latino: 30.0%</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>African American: 20.0%</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>Multiracial: 10.4%</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>Asian: 1.0%</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>Native Hawaiian/Other Pacific Islander: 0.9%</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>American Indian/Alaska Native: 0.9%</span>
                  </li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Transportation Modal */}
        <Dialog open={transportationOpen} onOpenChange={setTransportationOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-foreground">
                NLA Transportation System
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 pt-4">
              <p className="text-muted-foreground leading-relaxed">
                NLA removes transportation barriers by operating its own fleet, ensuring consistent access to programming for youth in Cape May County's most underserved communities, including Woodbine and Wildwood.
              </p>

              {/* Transportation Assets */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-3">Transportation Assets</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>One mini bus (22-seat capacity)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>Two 15-passenger vans</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-foreground mt-0.5">•</span>
                    <span>One mini van</span>
                  </li>
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>

      <Footer />
    </div>;
};
export default ImpactStory;