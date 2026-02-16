import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import launchPadLogo from "@/assets/programs/launch-pad-logo.png";

const Vision = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-primary py-16 md:py-24">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-primary-foreground leading-tight">
                Our Vision
              </h1>
            </div>
          </div>
        </section>

        {/* Vision Content */}
        <section className="py-16 md:py-20 bg-background">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <p className="text-xl md:text-2xl font-semibold text-foreground/90 mb-8">To become a leader in youth development—setting a national standard for how children transform.</p>
              
              <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                <p>
                  No Limits Academy exists to help young people build discipline, resilience, and direction—so they can break cycles of poverty and pursue meaningful futures. We believe social entrepreneurship is key to that mission: youth should learn not only how to work, but how to think, lead, and build.
                </p>
                <p className="font-semibold text-foreground">Our model combines personal, professional, and spiritual development—alongside education, discipline, and hard work—to create lasting transformation.</p>
                <div className="flex justify-center my-6">
                  <img src={launchPadLogo} alt="The Launch Pad Logo" className="h-56 md:h-64 w-auto" />
                </div>
                <p>
                  <span className="font-bold text-foreground">The Launch Pad</span> ensures participants continue receiving guidance, opportunity, and support long after they graduate from NLA. Through a growing network of local businesses and mentors, young people gain real-world exposure to careers, entrepreneurship, and leadership—learning not just to be strong employees, but to develop the mindset and skills of employers.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Vision;
