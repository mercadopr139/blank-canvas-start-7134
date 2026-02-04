import { Users, Heart, ShieldCheck, Bus, Gift } from "lucide-react";

const ImpactStrip = () => {
  const stats = [
    {
      icon: Gift,
      value: "FREE FOR ALL YOUTH",
      label: "No-cost access to programs, meals, and transportation",
      highlighted: true,
    },
    {
      icon: Users,
      value: "500+",
      label: "Youth Served Annually",
    },
    {
      icon: Heart,
      value: "70%",
      label: "Youth from Low-Income Households",
    },
    {
      icon: ShieldCheck,
      value: "95%",
      label: "Non-Contact, Safety-Focused Training",
    },
    {
      icon: Bus,
      value: "Meals & Transportation",
      label: "Five Nights a Week Access Support",
    },
  ];

  return (
    <section className="bg-foreground py-8 md:py-10">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-y-8 gap-x-4 md:gap-6 justify-items-center">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className={`text-center w-full max-w-[160px] md:max-w-none flex flex-col items-center ${
                stat.highlighted 
                  ? "col-span-2 md:col-span-1 bg-[#2d6a4f]/20 rounded-lg py-3 px-4 border border-[#2d6a4f]/40" 
                  : ""
              }`}
            >
              <stat.icon className={`h-6 w-6 mb-2 ${stat.highlighted ? "text-[#2d6a4f]" : "text-background/70"}`} />
              <div className={`text-lg md:text-xl font-black mb-1 leading-tight ${stat.highlighted ? "text-[#2d6a4f]" : "text-background"}`}>
                {stat.value}
              </div>
              <div className={`text-xs md:text-sm leading-tight px-1 ${stat.highlighted ? "text-[#2d6a4f]/80" : "text-background/70"}`}>
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
