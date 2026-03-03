import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Utensils, Users, Heart } from "lucide-react";
import mealTrainBg from "@/assets/meal-train/meal-train-volunteers-serving.png";

const bullets = [
  { icon: Utensils, text: "Free meals after scheduled program days (5x/week)" },
  { icon: Heart, text: "Consistency, community, and care for youth participants" },
  { icon: Users, text: "Volunteer- and partner-supported meal preparation & delivery" },
];

const MealTrainSection = () => {
  return (
    <section className="bg-background py-16 md:py-24">
      <div className="container">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 md:gap-14 items-start">
          {/* Left column – text */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--nla-red))] mb-2">
              Fueling Our Youth
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground mb-3">
              NLA Meal Train
            </h2>
            <p className="text-base md:text-lg font-medium text-foreground/70 mb-6">
              Free sit-down meals for our youth — five days a week.
            </p>

            <div className="space-y-4 text-foreground/80 leading-relaxed">
              <p>
                No Limits Academy provides free, sit-down meals at the gym five days a week after daily programming through the NLA Meal Train. These meals create consistency, build community, and ensure our athletes are fueled, focused, and cared for while they train and learn together.
              </p>
              <p>
                Volunteers make this possible. We partner with individuals, restaurants, and community supporters to prepare and deliver nourishing meals for our youth participants.
              </p>
            </div>

            <div className="mt-8 flex justify-center">
              <Button asChild variant="default" className="bg-foreground text-background hover:bg-foreground/90">
                <Link to="/meal-train">More Info</Link>
              </Button>
            </div>
          </div>

          {/* Right column – highlight card */}
          <div className="relative rounded-2xl overflow-hidden p-8 md:p-10 flex flex-col gap-6">
            <img src={mealTrainBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35" />
            <div className="absolute inset-0 bg-muted/50" />
            <h3 className="relative z-10 text-lg font-bold text-foreground">Program Highlights</h3>
            <ul className="relative z-10 space-y-5">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="mt-0.5 flex-shrink-0 w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
                    <b.icon className="w-5 h-5 text-background" />
                  </div>
                  <span className="text-sm md:text-base text-foreground/80 leading-snug pt-2">
                    {b.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MealTrainSection;
