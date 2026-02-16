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

        {/* Vision Intro */}
        <section className="py-16 md:py-20 bg-background">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl md:text-2xl font-semibold text-foreground/90 mb-8">
                To become a leader in youth development—setting a national standard for how children transform.
              </h2>
              
              <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                <p>
                  No Limits Academy helps young people build <strong className="text-foreground">discipline, resilience, and direction</strong>—so they can break cycles of poverty and pursue meaningful futures.
                </p>
                <p>
                  But we don't believe transformation ends when the training session is over.
                </p>
                <p>
                  That's why our mission is powered by <strong className="text-foreground">social entrepreneurship</strong>—teaching youth not only how to work hard, but how to <strong className="text-foreground">think, lead, build, and create opportunity</strong>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Social Entrepreneurship Model */}
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">Our Social Entrepreneurship Model</h2>
              
              <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                <p>
                  At No Limits Academy, youth don't just join a program—they enter a <strong className="text-foreground">development pipeline</strong>.
                </p>
                <p>
                  We don't just train athletes. We develop <strong className="text-foreground">future leaders, employees, entrepreneurs, and community builders</strong>.
                </p>
              </div>

              <div className="flex justify-center my-12">
                <img src={launchPadLogo} alt="The Launch Pad" className="h-56 md:h-64 w-auto" />
              </div>
            </div>
          </div>
        </section>

        {/* The Launch Pad */}
        <section className="py-16 md:py-20 bg-background">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">The Launch Pad</h2>
              
              <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                <p>
                  <strong className="text-foreground">The Launch Pad is how we execute our mission long-term.</strong>
                </p>
                <p>
                  It keeps young people connected to <strong className="text-foreground">guidance, opportunity, and support</strong> long after they leave the gym—through a growing network of <strong className="text-foreground">mentors, local businesses, and real-world partnerships</strong>.
                </p>
                <ul className="list-disc list-inside space-y-2 pl-2">
                  <li>Career exposure and workforce readiness</li>
                  <li>Entrepreneurship and leadership development</li>
                  <li>Mentorship, accountability, and next-step planning</li>
                </ul>
                <p>
                  Youth don't just learn how to be strong employees—they develop the mindset and skills of <strong className="text-foreground">builders and leaders</strong>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Why This Matters */}
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">Why This Matters</h2>
              
              <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                <p>Most youth programs end when the program ends.</p>
                <p>
                  No Limits Academy is built differently. The Launch Pad creates a <strong className="text-foreground">long-term model of development</strong> that produces lasting outcomes.
                </p>
                <p>
                  For donors, that means your support doesn't just fund training—you're investing in a <strong className="text-foreground">system that changes life trajectories</strong>.
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
