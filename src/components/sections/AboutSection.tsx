import coreValuesBanner from "@/assets/gym-buddies/core-values-banner.png";
import gymYouthGathering from "@/assets/gym-youth-gathering.jpg";

const AboutSection = () => {
  return (
    <section className="relative bg-background">
      {/* Mobile: Faded background image */}
      <div className="md:hidden absolute inset-0 overflow-hidden">
        <img 
          src={gymYouthGathering} 
          alt=""
          className="w-full h-full object-cover object-center opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/70" />
      </div>

      <div className="relative py-20 md:py-28">
        <div className="container">
          <div className="max-w-4xl mx-auto text-left">
            {/* Desktop: Side by side images */}
            <div className="hidden md:block md:float-right md:ml-8 md:mb-4 md:max-w-[800px]">
              <div className="flex gap-4 items-start">
                <div className="flex-1 rounded-lg overflow-hidden shadow-lg">
                  <img 
                    src={gymYouthGathering} 
                    alt="NLA youth gathered in the gym for a presentation"
                    className="w-full h-auto object-cover"
                  />
                </div>
                <div className="core-values flex-1">
                  <img 
                    src={coreValuesBanner} 
                    alt="NLA Core Values: Respect, Commitment, Accountability, Leadership, Trust, Service"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
            
            {/* Mobile: Just Core Values banner (photo is background) */}
            <div className="md:hidden mb-8">
              <div className="core-values mx-auto">
                <img 
                  src={coreValuesBanner} 
                  alt="NLA Core Values: Respect, Commitment, Accountability, Leadership, Trust, Service"
                  className="w-full h-auto"
                />
              </div>
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
      </div>
    </section>
  );
};

export default AboutSection;
