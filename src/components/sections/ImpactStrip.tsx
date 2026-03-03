import { Users, Heart, ShieldCheck, Utensils, TrendingUp, Bus } from "lucide-react";

const ImpactStrip = () => {
  const stats = [
    {
      icon: Users,
      value: "500+",
      label: "Youth Served Annually",
    },
    {
      icon: Heart,
      value: "70%",
      label: "Below Poverty Line",
    },
    {
      icon: Bus,
      value: "Transportation",
      label: "Free transportation offered for specific in-need areas",
    },
    {
      icon: Utensils,
      value: "Meals Served",
      label: "Five Nights a Week",
    },
    {
      icon: ShieldCheck,
      value: "95%",
      label: "Youth Participate in Non-Contact Boxing",
    },
    {
      icon: TrendingUp,
      value: "$2.7M+",
      label: "Raised Since 2020",
    },
  ];

  return (
    <section className="bg-foreground py-8 md:py-10">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center flex flex-col items-center px-2 py-3">
              <stat.icon className="h-6 w-6 mb-2 text-background/70" />
              <div className="text-xl md:text-3xl font-black text-background mb-1 leading-tight">
                {stat.value}
              </div>
              <div className="text-xs md:text-sm text-background/70 leading-tight">
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
