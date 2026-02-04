const HeroSection = () => {
  return <section className="relative min-h-[90vh] flex items-center bg-primary overflow-hidden pb-12 md:pb-16">
      
      {/* Accent line */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-32 bg-primary rounded-r-full" />
      
      <div className="container relative z-10 pt-12 md:pt-20">
        <div className="max-w-4xl">
          {/* Main headline */}
          {/* Main headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-primary-foreground leading-[1.1] tracking-tight mb-6">
            We Show Up <span style={{ color: '#bf0f3e' }}>Every Day</span>—for Our Youth
          </h1>
          
          {/* Supporting statement */}
          <p className="text-xl md:text-2xl lg:text-3xl font-semibold text-primary-foreground/70 mb-12">
            We Build Disciplined, Confident Young People.
          </p>
          
          {/* Main paragraph */}
          <p className="text-lg md:text-xl font-medium text-primary-foreground/80 mb-10 max-w-3xl leading-relaxed">
            No Limits Academy is a <span className="text-nla font-bold">FREE</span>, year-round youth development organization serving youth, 7–19 years old, of Cape May County. We show up Monday through Friday, 2:30 PM–8:30 PM, using boxing, mentorship, and structure to build disciplined, confident, and accountable young people.
          </p>
          
          {/* Mission - closing line */}
          <p className="text-xl md:text-2xl font-semibold text-primary-foreground mb-10 max-w-xl leading-relaxed mt-12">
            Through boxing, we develop our kids personally, professionally, and spiritually.
          </p>
        </div>
      </div>
      
      {/* Decorative element */}
      <div className="absolute right-0 bottom-0 w-1/3 h-full bg-gradient-to-l from-primary/10 to-transparent hidden lg:block" />
    </section>;
};
export default HeroSection;