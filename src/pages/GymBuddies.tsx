import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

import middleTownshipPd from "@/assets/gym-buddies/middle-township-pd.jpg";
import lowerTownshipPd from "@/assets/gym-buddies/lower-township-pd.jpg";
import shopWithCop from "@/assets/gym-buddies/shop-with-cop-2025.jpg";
import wildwoodFireDept from "@/assets/gym-buddies/wildwood-fire-dept.jpg";
import captainMiller from "@/assets/gym-buddies/captain-miller.jpg";
import avalonPd from "@/assets/gym-buddies/avalon-pd.png";
import avalonPd5 from "@/assets/gym-buddies/avalon-pd-5.jpg";
import acPoliceDept from "@/assets/gym-buddies/ac-police-dept.png";
import wildwoodPdProsecutors from "@/assets/gym-buddies/wildwood-pd-prosecutors.png";
import usCoastGuardBase from "@/assets/gym-buddies/us-coast-guard-base.png";
import knockoutCookoutMtpd from "@/assets/gym-buddies/knockout-cookout-mtpd.png";

import wildwoodFireDept2 from "@/assets/gym-buddies/wildwood-fire-dept-2.png";
import chiefsOfCmc from "@/assets/gym-buddies/chiefs-of-cmc.png";
import chiefJeffChristopher from "@/assets/gym-buddies/chief-jeff-christopher.png";
import chiefKevinLewis from "@/assets/gym-buddies/chief-kevin-lewis.png";
import mtpdAlyssaJones from "@/assets/gym-buddies/mtpd-alyssa-jones.png";
import ltpdSimba from "@/assets/gym-buddies/ltpd-simba.png";
import captainMiller2 from "@/assets/gym-buddies/captain-miller-2.png";
import millvillePdBryanH from "@/assets/gym-buddies/millville-pd-bryan-h.png";
import sleighDayAlyssaJones from "@/assets/gym-buddies/sleigh-day-alyssa-jones.png";
import nlaBlueKnights from "@/assets/gym-buddies/nla-blue-knights.png";
import nlaChiefsAssociationCmc from "@/assets/gym-buddies/nla-chiefs-association-cmc.png";
import nlaOceanCityPd from "@/assets/gym-buddies/nla-ocean-city-pd.png";
import nlaWildwoodCrestPd from "@/assets/gym-buddies/nla-wildwood-crest-pd.png";
import nlaWildwoodPd from "@/assets/gym-buddies/nla-wildwood-pd.png";
import nlaMtpd2 from "@/assets/gym-buddies/nla-mtpd-2.png";
import nlaNorthWildwoodPdFire from "@/assets/gym-buddies/nla-north-wildwood-pd-fire.png";
import copsAndHoopers2 from "@/assets/gym-buddies/cops-and-hoopers-2.png";
import copsAndHoopers3 from "@/assets/gym-buddies/cops-and-hoopers-3.png";

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
      src: avalonPd5,
      alt: "Congrats Chief Leusner NOW Mayor",
      caption: "Congrats Chief Leusner NOW Mayor!",
    },
    {
      src: acPoliceDept,
      alt: "NLA to AC Police Department",
      caption: "NLA to AC Police Department",
    },
    {
      src: wildwoodPdProsecutors,
      alt: "Wildwood PD and Prosecutors Office",
      caption: "Wildwood PD and Prosecutors Office",
    },
    {
      src: usCoastGuardBase,
      alt: "US Coast Guard Base, Cape May",
      caption: "US Coast Guard Base, Cape May",
    },
    {
      src: knockoutCookoutMtpd,
      alt: "Knockout Cookout with MTPD",
      caption: "Knockout Cookout with MTPD",
    },
    {
      src: wildwoodFireDept2,
      alt: "Wildwood Fire Department",
      caption: "Wildwood Fire Department",
    },
    {
      src: chiefsOfCmc,
      alt: "Some of the CHIEFS of CMC",
      caption: "Some of the CHIEFS of CMC!",
    },
    {
      src: chiefJeffChristopher,
      alt: "Chief of Avalon Jeff Christopher",
      caption: "Chief of Avalon, Jeff Christopher",
    },
    {
      src: chiefKevinLewis,
      alt: "Chief Kevin Lewis of Lower Township PD",
      caption: "Chief Kevin Lewis of Lower Township PD",
    },
    {
      src: mtpdAlyssaJones,
      alt: "MTPD's Alyssa Jones",
      caption: "MTPD's Alyssa Jones",
    },
    {
      src: ltpdSimba,
      alt: "Lower Township PD Simba",
      caption: "Lower Township PD, Simba",
    },
    {
      src: captainMiller2,
      alt: "Congrats Captain Miller",
      caption: "Congrats Captain Miller!",
    },
    {
      src: millvillePdBryanH,
      alt: "NLA to Millville PD Congrats Bryan H",
      caption: "NLA to Millville PD! Congrats Bryan H.",
    },
    {
      src: sleighDayAlyssaJones,
      alt: "Sleigh the Day with MTPD's Alyssa Jones",
      caption: "Sleigh the Day with MTPD's Alyssa Jones",
    },
    {
      src: nlaBlueKnights,
      alt: "NLA with the Blue Knights",
      caption: "NLA w/ the Blue Knights",
    },
    {
      src: nlaChiefsAssociationCmc,
      alt: "NLA with the Chiefs Association of CMC",
      caption: "NLA w/ the Chiefs Association of CMC",
    },
    {
      src: nlaOceanCityPd,
      alt: "NLA and Ocean City PD",
      caption: "NLA & Ocean City PD",
    },
    {
      src: nlaWildwoodCrestPd,
      alt: "NLA with Wildwood Crest PD",
      caption: "NLA w/ Wildwood Crest PD",
    },
    {
      src: nlaWildwoodPd,
      alt: "NLA with Wildwood PD",
      caption: "NLA w/ Wildwood PD",
    },
    {
      src: nlaMtpd2,
      alt: "NLA with MTPD",
      caption: "NLA w/ MTPD",
    },
    {
      src: nlaNorthWildwoodPdFire,
      alt: "NLA with North Wildwood Police and Fire",
      caption: "NLA w/ North Wildwood Police & Fire",
    },
    {
      src: copsAndHoopers2,
      alt: "Cops and Hoopers",
      caption: "Cops & Hoopers",
    },
    {
      src: copsAndHoopers3,
      alt: "Cops and Hoopers",
      caption: "Cops & Hoopers",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Title Section */}
        <section className="py-16 md:py-20 bg-foreground">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-background text-center">
                Gym Buddies Program
              </h1>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-16 md:py-20 bg-background">
          <div className="container">
            <div className="max-w-4xl mx-auto">
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
