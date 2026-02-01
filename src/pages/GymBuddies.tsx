import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

import middleTownshipPd from "@/assets/gym-buddies/middle-township-pd.jpg";
import lowerTownshipPd from "@/assets/gym-buddies/lower-township-pd.jpg";
import shopWithCop from "@/assets/gym-buddies/shop-with-cop-2025.jpg";
import wildwoodFireDept from "@/assets/gym-buddies/wildwood-fire-dept.jpg";
import captainMiller from "@/assets/gym-buddies/captain-miller.jpg";
import avalonPd from "@/assets/gym-buddies/avalon-pd.png";
import avalonPd1 from "@/assets/gym-buddies/avalon-pd-1.jpg";
import avalonPd2 from "@/assets/gym-buddies/avalon-pd-2.jpg";
import avalonPd3 from "@/assets/gym-buddies/avalon-pd-3.jpg";
import avalonPd4 from "@/assets/gym-buddies/avalon-pd-4.jpg";
import avalonPd5 from "@/assets/gym-buddies/avalon-pd-5.jpg";
import copsHoopersFlyer from "@/assets/gym-buddies/cops-hoopers-flyer.jpg";

const GymBuddies = () => {
  const gymBuddiesImages = [
    {
      src: middleTownshipPd,
      alt: "NLA to Middle Township PD",
      caption: "NLA to Middle Township PD!",
    },
    {
      src: lowerTownshipPd,
      alt: "NLA to Lower Township PD",
      caption: "NLA to Lower Township PD!",
    },
    {
      src: shopWithCop,
      alt: "Shop with a Cop 2025",
      caption: "Shop with a Cop 2025",
    },
    {
      src: wildwoodFireDept,
      alt: "NLA to Wildwood Fire Department",
      caption: "NLA to Wildwood Fire Department!",
    },
    {
      src: captainMiller,
      alt: "Congrats Captain Miller",
      caption: "Congrats Captain Miller!",
    },
    {
      src: avalonPd,
      alt: "Avalon Police Department",
      caption: "Avalon Police Department",
    },
    {
      src: avalonPd1,
      alt: "Thank You Avalon PD",
      caption: "Thank You Avalon PD!",
    },
    {
      src: avalonPd2,
      alt: "Avalon PD Training",
      caption: "Avalon PD Training",
    },
    {
      src: avalonPd3,
      alt: "Avalon PD Partnership",
      caption: "Avalon PD Partnership",
    },
    {
      src: avalonPd4,
      alt: "Avalon PD Community",
      caption: "Avalon PD Community",
    },
    {
      src: avalonPd5,
      alt: "Avalon PD Event",
      caption: "Avalon PD Event",
    },
    {
      src: copsHoopersFlyer,
      alt: "Cops and Hoopers",
      caption: "Cops & Hoopers",
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
