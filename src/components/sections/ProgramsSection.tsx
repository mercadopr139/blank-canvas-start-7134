import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const programs = [
  {
    title: "Junior Boxing Program",
    ages: "Ages 7–10 | Tuesdays",
    description: "An introduction to boxing, fitness, and discipline in a safe, supportive environment focused on confidence, listening skills, and teamwork.",
  },
  {
    title: "Senior Boxing Program",
    ages: "Ages 11–19 | Monday–Friday",
    description: "A structured, high-expectation program combining boxing & fitness training with mentorship, accountability, leadership development, and life skills.",
  },
  {
    title: "Grit & Grace Program",
    ages: "Ages 11–19 | Monday–Friday",
    description: "A character and leadership-focused program designed to support youth through mentorship, reflection, and personal growth alongside athletic training.",
  },
];

const ProgramsSection = () => {
  return (
    <section className="py-20 md:py-28 bg-secondary">
      <div className="container">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-secondary-foreground mb-6">
            Our Programs
          </h2>
          <p className="text-lg md:text-xl text-secondary-foreground/70 max-w-3xl mx-auto leading-relaxed">
            We offer three core programs designed to meet youth where they are and grow with them over time. Each program includes boxing & fitness training, mentorship, structure, and opportunities for personal, professional, and spiritual development.
          </p>
        </div>

        {/* Program cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {programs.map((program, index) => (
            <Card 
              key={index} 
              className="bg-background border-none shadow-lg hover:shadow-xl transition-shadow duration-300"
            >
              <CardHeader className="pb-4">
                <div className="text-sm font-semibold text-primary mb-2">
                  {program.ages}
                </div>
                <CardTitle className="text-xl md:text-2xl font-bold text-foreground">
                  {program.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {program.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProgramsSection;
