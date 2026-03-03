import gymYouthGathering from "@/assets/gym-youth-gathering.jpg";

const AboutSection = () => {
  return (
    <section className="relative">
      {/* Mobile */}
      <div className="md:hidden relative">
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

      {/* Desktop */}
      <div className="hidden md:block relative">
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
                We are a place where young people are known, challenged, and supported—every single day. Built on consistency, discipline, and real relationships, the culture here is one of high expectations and dependable support, balancing tough love with an unwavering commitment to every kid who walks through our doors.
              </p>
              <p className="text-3xl lg:text-4xl font-bold text-primary mt-16">
                Boxing is the tool. Growth is the goal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
