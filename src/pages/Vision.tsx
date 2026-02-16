import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import launchPadLogo from "@/assets/programs/launch-pad-logo.png";
import launchPadLogoNew from "@/assets/programs/launch-pad-logo-new.png";

const Vision = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-primary py-20 md:py-[50px]">
          <div className="container">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-primary-foreground leading-[1.1] tracking-tight mb-6">
                Our Vision
              </h1>
              <p className="text-xl md:text-2xl font-semibold text-primary-foreground/70 leading-snug">
                To become a leader in youth development—setting a national standard for how children transform.
              </p>
            </div>
          </div>
        </section>

        {/* Social Entrepreneurship Model */}
        <section className="py-16 bg-background md:py-[60px]">
          <div className="container">
            <div className="max-w-4xl">
              <div className="flex items-center justify-between gap-3 md:gap-5 mb-8">
                <div className="flex-1">
                  <div className="flex items-start gap-4">
                    <div className="w-1 self-stretch rounded-full bg-nla shrink-0" />
                    <div>
                      <span className="inline-block text-xs font-black tracking-[0.25em] uppercase text-nla mb-2">
                        The Model
                      </span>
                      <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground leading-[1.1] tracking-tight">
                        Our Social Entrepreneurship Model
                      </h2>
                    </div>
                  </div>
                </div>
                <img
                  src={launchPadLogo}
                  alt="The Launch Pad"
                  className="h-24 md:h-32 lg:h-40 w-auto shrink-0" />

              </div>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">
                At No Limits Academy, youth don't just join a program—they enter a <strong className="text-foreground">development pipeline</strong>.
              </p>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                We don't just train athletes. We develop <strong className="text-foreground">future leaders, employees, employers, entrepreneurs, and community builders</strong>.
              </p>
            </div>
          </div>
        </section>

        {/* Launch Pad Logo + Details */}
        <section className="py-16 bg-primary my-0 md:py-[60px] overflow-hidden">
          <div className="container">
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
              <div className="flex-1">
                <div className="flex items-start gap-4 mb-10">
                  <div className="w-1 self-stretch rounded-full bg-nla shrink-0" />
                  <div>
                    <span className="inline-block text-xs font-black tracking-[0.25em] uppercase text-nla mb-2">
                      The Launch Pad
                    </span>
                    <h2 className="text-2xl md:text-3xl font-black text-primary-foreground leading-tight">
                      How we execute our mission long-term.
                    </h2>
                  </div>
                </div>

                <p className="text-lg md:text-xl text-primary-foreground/80 leading-relaxed mb-8">
                  The Launch Pad keeps young people connected to <strong className="text-primary-foreground">guidance, opportunity, and support</strong> long after they leave the gym—through a growing network of <strong className="text-primary-foreground">mentors, local businesses, and real-world partnerships</strong>.
                </p>

                <ul className="space-y-4 mb-10">
                  {[
                  "Career exposure and workforce readiness",
                  "Entrepreneurship and leadership development",
                  "Mentorship, accountability, and next-step planning"].
                  map((item) =>
                  <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-2 w-2 rounded-full bg-nla shrink-0" />
                      <span className="text-lg text-primary-foreground font-medium">{item}</span>
                    </li>
                  )}
                </ul>

                <p className="text-xl md:text-2xl font-bold text-primary-foreground leading-snug">
                  Youth don't just learn how to be strong employees—they develop the mindset and skills of <strong>builders and leaders</strong>.
                </p>
              </div>

              <div className="shrink-0 lg:w-[340px] xl:w-[420px]">
                <img
                  src={launchPadLogoNew}
                  alt="The Launch Pad"
                  className="w-full h-auto drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Why This Matters */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container">
            <div className="max-w-3xl">
              <div className="flex items-start gap-4 mb-8">
                <div className="w-1 self-stretch rounded-full bg-nla shrink-0" />
                <div>
                  <span className="inline-block text-xs font-black tracking-[0.25em] uppercase text-nla mb-2">
                    Why It Matters
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black text-foreground leading-[1.1] tracking-tight">
                    Most youth programs end when the program ends.
                  </h2>
                </div>
              </div>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">
                No Limits Academy is built differently. The Launch Pad creates a <strong className="text-foreground">long-term model of development</strong> that produces lasting outcomes.
              </p>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                For donors, that means your support doesn't just fund training—you're investing in a <strong className="text-foreground">system that changes life trajectories</strong>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>);

};

export default Vision;