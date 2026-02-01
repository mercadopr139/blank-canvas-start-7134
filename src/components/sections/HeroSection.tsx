import { Button } from "@/components/ui/button";

const HeroSection = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center bg-secondary overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>
      
      {/* Accent line */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-32 bg-primary rounded-r-full" />
      
      <div className="container relative z-10">
        <div className="max-w-4xl">
          {/* Tagline */}
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="w-8 h-[2px] bg-primary" />
            <span className="text-primary font-semibold tracking-wider text-sm uppercase">
              Building Tomorrow's Leaders
            </span>
          </div>
          
          {/* Main headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-secondary-foreground leading-[0.95] tracking-tight mb-6">
            We Show Up<br />
            <span className="text-primary">Every Day</span>—<br />
            for Our Youth.
          </h1>
          
          {/* Subheadline */}
          <p className="text-xl md:text-2xl lg:text-3xl font-semibold text-secondary-foreground/80 mb-8 max-w-2xl">
            We Build Disciplined, Confident Young People.
          </p>
          
          {/* Description */}
          <p className="text-lg text-secondary-foreground/60 mb-10 max-w-xl leading-relaxed">
            No Limits Academy is a free, year-round youth development organization serving youth, 7–19 years old, of Cape May County. We show up Monday through Friday, 2:30–8:30 PM, using boxing, mentorship, and structure to build disciplined, confident, and accountable young people.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-6 text-lg">
              Get Involved
            </Button>
            <Button size="lg" variant="outline" className="border-2 border-secondary-foreground/20 text-secondary-foreground hover:bg-secondary-foreground/5 font-semibold px-8 py-6 text-lg">
              Learn More
            </Button>
          </div>
        </div>
      </div>
      
      {/* Decorative element */}
      <div className="absolute right-0 bottom-0 w-1/3 h-full bg-gradient-to-l from-primary/10 to-transparent hidden lg:block" />
    </section>
  );
};

export default HeroSection;
