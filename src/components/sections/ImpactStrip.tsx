import { Users, Heart, ShieldCheck, Utensils, TrendingUp, Bus } from "lucide-react";

const ImpactStrip = () => {
  const stats = [
    {
      icon: TrendingUp,
      value: "$2.6M+",
      label: "Raised Since 2020",
    },
    {
      icon: Users,
      value: "500+",
      label: "Youth Served Annually",
    },
    {
      icon: ShieldCheck,
      value: "95%",
      label: "Youth Participate in Non-Contact Boxing",
    },
    {
      icon: Heart,
      value: "70%",
      label: "Below Poverty Line",
    },
    {
      icon: Utensils,
      value: "Meals Served",
      label: "Five Nights a Week",
    },
    {
      icon: Bus,
      value: "Free",
      label: "Transportation",
    },
  ];

  return (
    <section className="bg-foreground py-8 md:py-10">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-y-8 gap-x-4 md:gap-6 justify-items-center">
          {stats.map((stat, index) => (
            <div key={index} className="text-center w-full max-w-[160px] md:max-w-none flex flex-col items-center">
              <stat.icon className="h-6 w-6 mb-2 text-background/70" />
              <div className="text-xl md:text-3xl font-black text-background mb-1 leading-tight">
                {stat.value}
              </div>
              <div className="text-xs md:text-sm text-background/70 leading-tight px-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ImpactStrip;
