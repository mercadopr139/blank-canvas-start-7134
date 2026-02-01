import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const programs = [
  {
    title: "Junior Boxing Program",
    ages: "Ages 7–10 | Tuesdays",
    description: "An introduction to boxing, fitness, and discipline in a safe, supportive environment focused on confidence, listening skills, and teamwork.",
  },
  {
    title: "Senior Boxing Program",
    ages: "Ages 11–19 | Monday–Friday",
    description: "A structured, high-expectation boys program combining boxing & fitness training with mentorship, accountability, leadership development, and life skills.",
  },
  {
    title: "Grit & Grace Program",
    ages: "Ages 11–19 | Monday–Friday",
    description: "A boxing-based character and leadership program for girls, within the Senior Boxing Program, designed to support youth through mentorship, reflection, and personal growth alongside athletic training.",
  },
];

interface ProgramsSectionProps {
  onMoreInfo?: (program: "junior" | "senior") => void;
}

const ProgramsSection = ({ onMoreInfo }: ProgramsSectionProps) => {
  return (
    <section className="py-20 md:py-28 bg-primary">
      <div className="container">
        {/* Section header */}
        <div className="text-left mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-primary-foreground mb-6">
            Our Programs
          </h2>
          <p className="text-lg md:text-xl text-primary-foreground/70 max-w-3xl leading-relaxed">
            We offer three core programs designed to meet youth where they are and grow with them over time. Each program includes boxing & fitness training, mentorship, structure, and opportunities for personal, professional, and spiritual development.
          </p>
        </div>

        {/* Program cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {programs.map((program, index) => (
            <Card 
              key={index} 
              className={`border-none shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full ${
                index === 0 
                  ? "bg-muted" 
                  : "bg-background"
              }`}
            >
              <CardHeader className="pb-4">
                <div className={`text-sm font-semibold mb-2 ${
                  index === 0 ? "text-foreground" : "text-primary"
                }`}>
                  {program.ages}
                </div>
                <CardTitle className="text-xl md:text-2xl font-bold text-foreground">
                  {program.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-6">
                <p className={`leading-relaxed flex-1 ${index === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                  {program.description}
                </p>
                <div className="flex flex-col gap-3">
                  <Button 
                    className={`w-full font-semibold ${
                      index === 0 
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground" 
                        : "bg-foreground hover:bg-foreground/90 text-background"
                    }`}
                    asChild
                  >
                    <a href="https://wkf.ms/45C6tce" target="_blank" rel="noopener noreferrer">
                      SIGN-UP
                    </a>
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    className={`w-full font-semibold ${
                      index === 0 
                        ? "border-primary text-primary hover:bg-primary hover:text-primary-foreground" 
                        : "border-foreground text-foreground hover:bg-foreground hover:text-background"
                    }`}
                    onClick={() => onMoreInfo?.(index === 0 ? "junior" : "senior")}
                  >
                    MORE INFO
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProgramsSection;
