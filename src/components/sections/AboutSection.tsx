import coreValuesBanner from "@/assets/gym-buddies/core-values-banner.png";
import gymYouthGathering from "@/assets/gym-youth-gathering.jpg";

const AboutSection = () => {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="max-w-4xl mx-auto text-left">
          {/* Image Pair - Creative Layout */}
          <div className="md:float-right md:ml-8 md:mb-4 mb-8 w-full md:max-w-[800px]">
            {/* Desktop: Side by side */}
            <div className="hidden md:flex gap-4 items-start">
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
            
            {/* Mobile: Stacked with creative overlap effect */}
            <div className="md:hidden relative">
              {/* Youth gathering photo - tilted slightly */}
              <div className="relative z-10 mx-4 -rotate-2 rounded-lg overflow-hidden shadow-xl">
                <img 
                  src={gymYouthGathering} 
                  alt="NLA youth gathered in the gym for a presentation"
                  className="w-full h-auto object-cover"
                />
              </div>
              {/* Core Values banner - underneath, tilted opposite */}
              <div className="core-values relative z-0 -mt-8 mx-2 rotate-1 rounded-lg overflow-hidden shadow-lg">
                <img 
                  src={coreValuesBanner} 
                  alt="NLA Core Values: Respect, Commitment, Accountability, Leadership, Trust, Service"
                  className="w-full h-auto"
                />
              </div>
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
    </section>
  );
};

export default AboutSection;
