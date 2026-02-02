import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const OurStory = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-primary py-16 md:py-24">
          <div className="container">
            <div className="max-w-[900px] mx-auto">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-primary-foreground leading-tight">
                Our Story
              </h1>
            </div>
          </div>
        </section>

        {/* Story Content */}
        <section className="py-16 md:py-20 bg-background">
          <div className="container">
            <div className="max-w-[900px] mx-auto prose prose-lg">
              
              {/* Photo Slot A - Float Right on Desktop */}
              <div className="md:float-right md:ml-5 md:mb-4 md:max-w-[380px] mb-6 w-full max-w-[420px] mx-auto md:mx-0">
                <div className="bg-muted rounded-lg shadow-md overflow-hidden">
                  <div className="aspect-[4/5] flex items-center justify-center bg-accent border-2 border-dashed border-border">
                    <span className="text-muted-foreground text-center px-4 font-medium">
                      [INSERT JOSH PHOTO HERE]
                    </span>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-sm text-muted-foreground italic">
                      Caption: [Add caption here]
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">
                No Limits Academy was founded by Josh Mercado, whose life has been shaped by the power—and absence—of mentorship. Raised in a single-parent household, Josh grew up acutely aware of what it meant to feel unrepresented and unsupported, watching other children benefit from adults who coached, advocated, and opened doors for them. That early longing to be seen, guided, and defended became a defining force in his life.
              </p>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">
                Sports provided an outlet, but boxing became the turning point. While pursuing his education at Lock Haven University—known for both its nationally ranked boxing program and strong teacher preparation—Josh found structure, accountability, and belief in his own potential. He became a National Collegiate Boxing Champion, later competing professionally, while earning his degree in Secondary Education. Boxing did more than sharpen his athletic ability; it taught him discipline, resilience, and how to confront adversity with focus and self-control.
              </p>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">
                After graduating, Josh felt a calling to make an impact beyond the ring. He spent over a decade as a psychology and sociology teacher, earning recognition for exceptional classroom culture, relationship-based discipline, and student motivation. As both a teacher and multi-sport coach, Josh was intentional about becoming the mentor he once needed—consistent, fair, and committed to giving every young person a genuine opportunity.
              </p>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">
                Along that journey, Josh's path intersected with Dave Von Savage Jr. More than a decade ago, Dave hired Josh as his boxing trainer, and what began as sessions in a residential gym evolved into a lasting friendship rooted in trust, discipline, and shared values. Though raised in different circumstances, both men were shaped by environments that emphasized accountability, service, and leadership.
              </p>

              {/* Clear floats before Photo Slot B */}
              <div className="clear-both" />

              {/* Photo Slot B - Float Left on Desktop */}
              <div className="md:float-left md:mr-5 md:mb-4 md:max-w-[380px] mb-6 mt-4 w-full max-w-[420px] mx-auto md:mx-0">
                <div className="bg-muted rounded-lg shadow-md overflow-hidden">
                  <div className="aspect-[4/3] flex items-center justify-center bg-accent border-2 border-dashed border-border">
                    <span className="text-muted-foreground text-center px-4 font-medium">
                      [INSERT JOSH + DAVE (OR NLA) PHOTO HERE]
                    </span>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-sm text-muted-foreground italic">
                      Caption: [Add caption here]
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">
                Dave, raised by both parents and influenced by their commitment to community service, attended the United States Naval Academy in Annapolis. There, he distinguished himself academically and athletically as a four-year member of the Navy boxing team, earning multiple Brigade Boxing Championships. Following graduation, he was commissioned as a United States Navy Officer and continued his military career for seven years before later graduating from the Wharton School of the University of Pennsylvania with a Master of Business Administration.
              </p>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">
                What neither Josh nor Dave fully understood at the time was how closely their paths had already been shaped by the same boxing lineage. Dave trained at the Naval Academy under Jim McNally, who previously founded the boxing program at Lock Haven University—where Josh would later win a national championship. Long before they ever met, the same philosophy, standards, and approach to discipline had been instilled in both of them, quietly preparing each for a partnership neither could have imagined.
              </p>

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">
                Though their lives unfolded along different paths, Josh and Dave stayed closely connected, united by boxing, friendship, and a shared belief in the power of structure and consistency to change lives. In 2020, those parallel journeys converged with the establishment of No Limits Academy. In 2022, Josh resigned from his teaching position to commit to NLA full time, allowing the organization to grow from a vision into a comprehensive youth development program serving children across Cape May County.
              </p>

              {/* Clear floats before final paragraph */}
              <div className="clear-both" />

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                Today, No Limits Academy is more than a boxing gym. It is a community hub built on mentorship, belonging, and opportunity. Leveraging backgrounds in education, military service, business, and boxing, Josh and Dave created a space where young people are challenged, supported, and believed in. Through discipline and care, NLA teaches its athletes that their circumstances do not define their future—and that no one succeeds alone.
              </p>

            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default OurStory;
