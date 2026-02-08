import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const programs = [{
  title: "Junior Boxing Program",
  ages: "Ages 7–10 | Tuesdays",
  description: "An introduction to boxing, fitness, and discipline in a safe, supportive environment focused on confidence, listening skills, and teamwork."
}, {
  title: "Senior Boxing Program",
  ages: "Ages 11–19 | Monday–Friday",
  description: "A structured, high-expectation program combining boxing & fitness training with mentorship, accountability, leadership development, and life skills."
}];
interface ProgramsSectionProps {
  onMoreInfo?: (program: "junior" | "senior") => void;
}
const ProgramsSection = ({
  onMoreInfo
}: ProgramsSectionProps) => {
  const [signupModalOpen, setSignupModalOpen] = useState<"junior" | "senior" | null>(null);
  return <section id="programs" className="py-20 md:py-28 bg-primary">
      <div className="container">
        {/* Section header */}
        <div className="text-left mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-primary-foreground mb-6">
            Our Programs
          </h2>
          <p className="text-lg md:text-xl text-primary-foreground/70 max-w-3xl leading-relaxed">We offer two core programs designed to meet youth where they are and grow with them over time. Each program includes boxing & fitness training, mentorship, structure, and opportunities for personal, professional, and spiritual development.</p>
        </div>

        {/* Program cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {programs.map((program, index) => <Card key={index} className={`border-none shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full ${index === 0 ? "bg-muted" : "bg-background"}`}>
              <CardHeader className="pb-4">
                <div className={`text-sm font-semibold mb-2 ${index === 0 ? "text-foreground" : "text-primary"}`}>
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
                <div className="flex flex-col gap-3 items-center">
                  <Button 
                    className={`w-full font-semibold ${index === 0 ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-foreground hover:bg-foreground/90 text-background"}`}
                    onClick={() => setSignupModalOpen(index === 0 ? "junior" : "senior")}
                  >
                    SIGN-UP
                  </Button>
                  <Button variant="outline" size="sm" className={`w-1/2 font-semibold ${index === 0 ? "border-primary text-primary hover:bg-primary hover:text-primary-foreground" : "border-foreground text-foreground hover:bg-foreground hover:text-background"}`} onClick={() => onMoreInfo?.(index === 0 ? "junior" : "senior")}>
                    MORE INFO
                  </Button>
                </div>
              </CardContent>
            </Card>)}
        </div>
      </div>

      {/* Junior Boxing Signup Modal */}
      <Dialog open={signupModalOpen === "junior"} onOpenChange={(open) => !open && setSignupModalOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="sr-only">Junior Boxing Sign-Up</DialogTitle>
          </DialogHeader>
          <div className="w-full aspect-[4/3] bg-muted rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground text-sm">Junior Boxing Image Placeholder</span>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-semibold text-foreground">Quick Parent Snapshot 👇</p>
            <p className="text-muted-foreground">🥊 Cost: 100% FREE</p>
            <p className="text-muted-foreground">👕 What to bring: Gym-class style clothes + sneakers</p>
            <p className="text-muted-foreground">🕔 Program: 5:15–6:00 PM</p>
            <p className="text-muted-foreground">🍽️ Optional Aftercare: 6:00–7:15 PM (sit-down dinner included)</p>
            <p className="text-muted-foreground">⏰ Pick-Up: Please be on time — late pick-ups are not allowed</p>
          </div>
          <Button 
            className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            asChild
          >
            <a href="https://wkf.ms/45C6tce" target="_blank" rel="noopener noreferrer">
              SIGN-UP
            </a>
          </Button>
        </DialogContent>
      </Dialog>

      {/* Senior Boxing Signup Modal */}
      <Dialog open={signupModalOpen === "senior"} onOpenChange={(open) => !open && setSignupModalOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="sr-only">Senior Boxing Sign-Up</DialogTitle>
          </DialogHeader>
          <div className="w-full aspect-[4/3] bg-foreground/10 rounded-lg flex items-center justify-center">
            <span className="text-foreground/50 text-sm">Senior Boxing Image Placeholder</span>
          </div>
          <Button 
            className="w-full mt-4 bg-foreground hover:bg-foreground/90 text-background font-semibold"
            asChild
          >
            <a href="https://wkf.ms/45C6tce" target="_blank" rel="noopener noreferrer">
              SIGN-UP
            </a>
          </Button>
        </DialogContent>
      </Dialog>
    </section>;
};
export default ProgramsSection;