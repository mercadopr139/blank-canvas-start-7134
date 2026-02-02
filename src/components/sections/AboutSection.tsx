import coreValuesBanner from "@/assets/gym-buddies/core-values-banner.png";

const AboutSection = () => {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="max-w-4xl mx-auto text-left">
          {/* Core Values Banner - Float Right on Desktop */}
          <div className="md:float-right md:ml-8 md:mb-4 md:max-w-[400px] mb-8 w-full max-w-[420px] mx-auto md:mx-0">
            <img 
              src={coreValuesBanner} 
              alt="NLA Core Values: Respect, Commitment, Accountability, Leadership, Trust, Service"
              className="w-full h-auto"
            />
          </div>

          {/* Main headline */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground leading-tight mb-8">
            No Limits Academy is more than a boxing gym.
          </h2>
          
          {/* Body text */}
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed my-12">
            We are a place where young people are known, challenged, and supported—every single day. Built on consistency, discipline, and real relationships, we provide structure and high expectations while balancing tough love with an unwavering commitment to every kid we serve.
          </p>
          
          {/* Tagline */}
          <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-primary mt-16">
            Boxing is the tool. Growth is the goal.
          </p>
          
          {/* Clear floats */}
          <div className="clear-both" />
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
