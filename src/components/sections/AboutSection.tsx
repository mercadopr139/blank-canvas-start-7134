import coreValuesBanner from "@/assets/gym-buddies/core-values-banner.png";
import gymYouthGathering from "@/assets/gym-youth-gathering.jpg";
const AboutSection = () => {
  return <section className="relative bg-background">
      <div className="relative">
        {/* Mobile: Core Values banner with solid background (no photo) */}
        <div className="md:hidden bg-background py-8">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <div className="core-values mx-auto">
                <img src={coreValuesBanner} alt="NLA Core Values: Respect, Commitment, Accountability, Leadership, Trust, Service" className="w-full h-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Text content with photo background */}
        <div className="md:hidden relative">
          {/* Background image - only behind text content */}
          <div className="absolute inset-0 overflow-hidden">
            <img src={gymYouthGathering} alt="" className="w-full h-full object-cover object-top opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background/80" />
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

        {/* Desktop: Core Values banner with solid background (no photo) */}
        <div className="hidden md:block bg-background py-8">
          <div className="container">
            <div className="max-w-4xl mx-auto">
            <div className="core-values max-w-md mx-auto px-0">
              <img src={coreValuesBanner} alt="NLA Core Values: Respect, Commitment, Accountability, Leadership, Trust, Service" className="w-full h-auto object-fill" />
            </div>
            </div>
          </div>
        </div>

        {/* Desktop: Text content with photo background */}
        <div className="hidden md:block relative">
          {/* Background image - only behind text content */}
          <div className="absolute inset-0 overflow-hidden">
            <img src={gymYouthGathering} alt="" className="w-full h-full object-cover object-[center_40%] opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background/80" />
          </div>

          <div className="relative py-20">
            <div className="container">
              <div className="max-w-4xl mx-auto text-left">
                <h2 className="text-4xl lg:text-5xl font-black text-foreground leading-tight mb-8">
                  No Limits Academy is more than a boxing gym.
                </h2>
                
                <p className="text-xl text-foreground leading-relaxed my-12">
                  We are a place where young people are known, challenged, and supported—every single day. Built on consistency, discipline, and real relationships, we provide structure and high expectations while balancing tough love with an unwavering commitment to every kid we serve.
                </p>
                
                <p className="text-3xl lg:text-4xl font-bold text-primary mt-16">
                  Boxing is the tool. Growth is the goal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>;
};
export default AboutSection;