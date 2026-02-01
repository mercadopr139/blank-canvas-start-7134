import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const GymBuddies = () => {
  const gymBuddiesImages = [
    {
      src: "/placeholder.svg",
      alt: "Partnership with local law enforcement",
      caption: "Law Enforcement",
    },
    {
      src: "/placeholder.svg",
      alt: "Fire department collaboration",
      caption: "Fire Department",
    },
    {
      src: "/placeholder.svg",
      alt: "U.S. Coast Guard partnership",
      caption: "U.S. Coast Guard",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        <section className="py-20 md:py-28 bg-background">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              {/* Section header */}
              <div className="text-left mb-8">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground mb-6">
                  Gym Buddies Program
                </h1>
              </div>

              {/* Description */}
              <div className="text-left mb-12 space-y-6">
                <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
                  No Limits Academy serves over <span className="font-bold text-foreground">500 youth each year</span> across Cape May County.
                </p>
                <p className="text-lg md:text-xl text-foreground/80 leading-relaxed">
                  Gym Buddies brings local first responders—law enforcement officers, firefighters, and U.S. Coast Guard members—into the gym to train alongside our youth. These sessions build trust, break down barriers, and create meaningful connections between young people and the heroes who serve their community. It's mentorship in action, one workout at a time.
                </p>
              </div>

              {/* Photo Gallery */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {gymBuddiesImages.map((image, index) => (
                  <div key={index} className="group relative overflow-hidden rounded-lg">
                    <div className="aspect-[4/3] bg-muted">
                      <img
                        src={image.src}
                        alt={image.alt}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-foreground/80 text-background px-3 py-2">
                      <p className="text-sm font-medium">{image.caption}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default GymBuddies;
