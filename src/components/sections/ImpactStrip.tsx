import { Users, Heart, ShieldCheck, Bus } from "lucide-react";

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
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <stat.icon className="h-6 w-6 mx-auto mb-2 text-background/70" />
              <div className="text-2xl md:text-3xl font-black text-background mb-1">
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
