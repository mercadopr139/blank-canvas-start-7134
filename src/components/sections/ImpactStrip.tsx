import { Users, Heart, ShieldCheck, Utensils, TrendingUp, Bus } from "lucide-react";

const stats = [
  { icon: Users, value: "500+", label: "Youth Served Annually" },
  { icon: Heart, value: "70%", label: "Below Poverty Line" },
  { icon: Bus, value: "Free", label: "Transportation" },
  { icon: Utensils, value: "Meals Served", label: "Five Nights a Week" },
  { icon: ShieldCheck, value: "95%", label: "Youth Participate in Non-Contact Boxing" },
  { icon: TrendingUp, value: "$2.6M+", label: "Raised Since 2020" },
];

const StatItem = ({ icon: Icon, value, label }: typeof stats[number]) => (
  <div className="text-center flex-shrink-0 flex flex-col items-center px-8 md:px-12">
    <Icon className="h-6 w-6 mb-2 text-background/70" />
    <div className="text-xl md:text-3xl font-black text-background mb-1 leading-tight whitespace-nowrap">
      {value}
    </div>
    <div className="text-xs md:text-sm text-background/70 leading-tight whitespace-nowrap">
      {label}
    </div>
  </div>
);

const ImpactStrip = () => {
  return (
    <section className="bg-foreground py-8 md:py-10 overflow-hidden">
      <div className="relative">
        <div className="flex whitespace-nowrap animate-marquee-slow">
          {[...stats, ...stats].map((stat, index) => (
            <StatItem key={index} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ImpactStrip;
