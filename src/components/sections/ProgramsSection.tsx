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
    description: "A character and leadership-focused girls program designed to support youth through mentorship, reflection, and personal growth alongside athletic training.",
  },
];

const ProgramsSection = () => {
  return (
    <section className="py-20 md:py-28 bg-primary">
      <div className="container">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-primary-foreground mb-6">
            Our Programs
          </h2>
          <p className="text-lg md:text-xl text-primary-foreground/70 max-w-3xl mx-auto leading-relaxed">
            We offer three core programs designed to meet youth where they are and grow with them over time. Each program includes boxing & fitness training, mentorship, structure, and opportunities for personal, professional, and spiritual development.
          </p>
        </div>

        {/* Program cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {programs.map((program, index) => (
            <Card 
              key={index} 
              className={`border-none shadow-lg hover:shadow-xl transition-shadow duration-300 ${
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
              <CardContent className="flex flex-col gap-6">
                <p className="text-muted-foreground leading-relaxed">
                  {program.description}
                </p>
                <Button 
                  className={`w-full font-semibold ${
                    index === 0 
                      ? "bg-secondary hover:bg-secondary/90 text-foreground" 
                      : "bg-background hover:bg-background/90 text-foreground border border-border"
                  }`}
                >
                  SIGN-UP
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProgramsSection;
