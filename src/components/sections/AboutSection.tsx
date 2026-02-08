import coreValuesBanner from "@/assets/gym-buddies/core-values-banner.png";
import gymYouthGathering from "@/assets/gym-youth-gathering.jpg";

const AboutSection = () => {
  return (
    <section className="relative bg-background">
      <div className="relative">
        {/* Mobile: Core Values banner with solid background (no photo) */}
        <div className="md:hidden bg-background py-8">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <div className="core-values mx-auto">
                <img 
                  src={coreValuesBanner} 
                  alt="NLA Core Values: Respect, Commitment, Accountability, Leadership, Trust, Service"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Text content with photo background */}
        <div className="md:hidden relative">
          {/* Background image - only behind text content */}
          <div className="absolute inset-0 overflow-hidden">
            <img 
              src={gymYouthGathering} 
              alt=""
              className="w-full h-full object-cover object-top opacity-50"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/70" />
          </div>

          <div className="relative py-12">
            <div className="container">
              <div className="max-w-4xl mx-auto text-left">
                <h2 className="text-3xl font-black text-foreground leading-tight mb-8">
                  No Limits Academy is more than a boxing gym.
                </h2>
                
                <p className="text-lg text-foreground leading-relaxed my-12">
                  We are a place where young people are known, challenged, and supported—every single day. Built on consistency, discipline, and real relationships, we provide structure and high expectations while balancing tough love with an unwavering commitment to every kid we serve.
                </p>
                
                <p className="text-2xl font-bold text-primary mt-16">
                  Boxing is the tool. Growth is the goal.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop layout - unchanged */}
        <div className="hidden md:block py-28">
          <div className="container">
            <div className="max-w-4xl mx-auto text-left">
              <div className="md:float-right md:ml-8 md:mb-4 md:max-w-[800px]">
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
              
              <h2 className="text-4xl lg:text-5xl font-black text-foreground leading-tight mb-8">
                No Limits Academy is more than a boxing gym.
              </h2>
              
              <p className="text-xl text-foreground leading-relaxed my-12">
                We are a place where young people are known, challenged, and supported—every single day. Built on consistency, discipline, and real relationships, we provide structure and high expectations while balancing tough love with an unwavering commitment to every kid we serve.
              </p>
              
              <p className="text-3xl lg:text-4xl font-bold text-primary mt-16">
                Boxing is the tool. Growth is the goal.
              </p>
              
              <div className="clear-both" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
