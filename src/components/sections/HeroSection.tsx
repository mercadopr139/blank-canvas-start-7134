import heroVictory from "@/assets/hero/hero-victory.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-[75vh] flex items-center bg-primary overflow-hidden pb-12 md:pb-16">
      {/* Hero Image - Right Side */}
      <div className="absolute inset-0 lg:left-1/2 lg:right-0">
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/95 to-primary/40 lg:from-primary lg:via-primary/80 lg:to-transparent z-10" />
        <img
          src={heroVictory}
          alt="NLA youth boxer celebrating victory with referee raising their arm"
          className="w-full h-full object-cover object-[35%_center] lg:object-center opacity-60 lg:opacity-100" />

      </div>

      {/* Content */}
      <div className="container relative z-20 pt-12 md:pt-20 py-0">
        <div className="max-w-2xl lg:max-w-xl">
          {/* Main headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-primary-foreground leading-[1.1] tracking-tight mb-6">
            We Show Up <span style={{ color: '#bf0f3e' }}>Every Day</span>—for Our Youth
          </h1>

          {/* Supporting statement */}
          <p className="text-xl md:text-2xl lg:text-3xl font-semibold text-primary-foreground/70 mb-12">We Build Disciplined, Confident & Accountable Young People.

          </p>

          {/* Main paragraph */}
          <p className="text-lg md:text-xl font-medium text-primary-foreground/80 mb-10 max-w-3xl leading-relaxed">No Limits Academy is a FREE, year-round youth development center serving kids & young adults, 7–19 years old, of Cape May County. Monday through Friday, 2:30 PM–8:30 PM, we use boxing, mentorship, and structure set young people for success in life.
            <span className="text-nla font-bold">FREE</span>, year-round youth development center serving youth, 7–19 years old, of Cape May County. We show up Monday through Friday, 2:30 PM–8:30 PM, using boxing, mentorship, and structure to build disciplined, confident, and accountable young people.
          </p>

          {/* Mission Badge */}
          <div className="mt-12 mb-10 max-w-xl">
            <div className="flex items-start gap-4">
              <div className="w-1 self-stretch rounded-full bg-nla shrink-0" />
              <div>
                <span className="inline-block text-xs font-black tracking-[0.25em] uppercase text-nla mb-2">
                  Our Mission
                </span>
                <p className="text-xl md:text-2xl font-semibold text-primary-foreground leading-relaxed">
                  Through boxing, we develop our kids personally, professionally, and spiritually.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>);

};

export default HeroSection;