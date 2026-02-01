const AboutSection = () => {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main headline */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground leading-tight mb-8">
            No Limits Academy is more than a boxing gym.
          </h2>
          
          {/* Body text */}
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8">
            We are a place where young people are known, challenged, and supported—every single day. Built on consistency, discipline, and real relationships, we provide structure and high expectations while balancing tough love with an unwavering commitment to every kid we serve.
          </p>
          
          {/* Tagline */}
          <p className="text-2xl md:text-3xl font-bold text-primary">
            Boxing is the tool. Growth is the goal.
          </p>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
