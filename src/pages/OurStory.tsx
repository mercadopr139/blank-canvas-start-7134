import { useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PortalLightbox from "@/components/ui/portal-lightbox";
import joshMcNallyDave from "@/assets/our-story/josh-mcnally-dave.jpeg";
import facilityConstructionCrew from "@/assets/facility/facility-construction-crew.png";
import facilityPlumbingCrew from "@/assets/facility/facility-plumbing-crew.png";
import facilityRebarPrep from "@/assets/facility/facility-rebar-prep.png";
import facilityFloorWork from "@/assets/facility/facility-floor-work.png";
import facilityThumbsUp from "@/assets/facility/facility-thumbs-up.png";
import facilityFramingFloorWork from "@/assets/facility/facility-framing-floor.png";
import facilityBathroom from "@/assets/facility/facility-bathroom.png";
import facilityLoungeArea from "@/assets/facility/facility-lounge-area.png";
import facilityFloorCleaning from "@/assets/facility/facility-floor-cleaning.png";
import facilityMovingBoxes from "@/assets/facility/facility-moving-boxes.png";
import facilityDoorInstall from "@/assets/facility/facility-door-install.png";
import facilityKitchen from "@/assets/facility/facility-kitchen.png";
import facilityDemolition from "@/assets/facility/facility-demolition.png";
import facilityBuildCrew from "@/assets/facility/facility-build-crew.png";
import facilityPlanning from "@/assets/facility/facility-planning.png";
import facilityGreenTeam from "@/assets/facility/facility-green-team.png";
import facilityEmptyWarehouse from "@/assets/facility/facility-empty-warehouse.png";
import facilityMetalwork from "@/assets/facility/facility-metalwork.png";
import facilitySteelFrame from "@/assets/facility/facility-steel-frame.png";
import facilityWelding from "@/assets/facility/facility-welding.png";
import facilityDumpster from "@/assets/facility/facility-dumpster.png";
import facilityGymFloorPrep from "@/assets/facility/facility-gym-floor-prep.png";
import facilityRigInstall from "@/assets/facility/facility-rig-install.png";
import facilityKidOnPlates from "@/assets/facility/facility-kid-on-plates.png";
import facilityFramingOverview from "@/assets/facility/facility-framing-overview.png";
import facilityFramingFloor from "@/assets/facility/facility-framing-floor.png";
import facilityFramingWall from "@/assets/facility/facility-framing-wall.png";
import facilityWallRaising from "@/assets/facility/facility-wall-raising.png";
import facilityWallFraming from "@/assets/facility/facility-wall-framing.png";
import facilityPlywoodWall from "@/assets/facility/facility-plywood-wall.png";
import facilityEquipmentPrep from "@/assets/facility/facility-equipment-prep.png";
import facilityFinishedGym from "@/assets/facility/facility-finished-gym.png";
import facilityFoundersCleaning from "@/assets/facility/facility-founders-cleaning.png";
import facilityDemoFloor from "@/assets/facility/facility-demo-floor.png";
import facilityFloorInstall1 from "@/assets/facility/facility-floor-install-1.png";
import facilityFloorInstall2 from "@/assets/facility/facility-floor-install-2.png";
import facilityFloorDiscussion from "@/assets/facility/facility-floor-discussion.png";
import facilityScaffoldWork from "@/assets/facility/facility-scaffold-work.png";
import facilityHighWork from "@/assets/facility/facility-high-work.png";
import facilityFinishedCourt from "@/assets/facility/facility-finished-court.png";

type FacilityImg = { src: string; alt: string };

const facilityImages: FacilityImg[] = [
  { src: facilityConstructionCrew, alt: "Construction crew breaking ground" },
  { src: facilityPlumbingCrew, alt: "Plumbing installation crew" },
  { src: facilityRebarPrep, alt: "Rebar and foundation preparation" },
  { src: facilityFloorWork, alt: "Floor installation in progress" },
  { src: facilityFramingFloorWork, alt: "Framing and floor work" },
  { src: facilityBathroom, alt: "Finished bathroom facilities" },
  { src: facilityThumbsUp, alt: "Facility space taking shape" },
  { src: facilityLoungeArea, alt: "Finished lounge area" },
  { src: facilityFloorCleaning, alt: "Floor cleaning and prep" },
  { src: facilityMovingBoxes, alt: "Moving equipment in" },
  { src: facilityDoorInstall, alt: "Door frame installation" },
  { src: facilityKitchen, alt: "Finished kitchen" },
  { src: facilityDemolition, alt: "Demolition day" },
  { src: facilityBuildCrew, alt: "Build crew on site" },
  { src: facilityPlanning, alt: "Planning the build" },
  { src: facilityGreenTeam, alt: "Volunteer crew thumbs up" },
  { src: facilityEmptyWarehouse, alt: "Empty warehouse before renovation" },
  { src: facilityMetalwork, alt: "Metalwork and welding" },
  { src: facilitySteelFrame, alt: "Steel frame assembly" },
  { src: facilityWelding, alt: "Welding steel structure" },
  { src: facilityDumpster, alt: "Demolition debris removal" },
  { src: facilityGymFloorPrep, alt: "Gym floor preparation" },
  { src: facilityRigInstall, alt: "Installing the rig" },
  { src: facilityKidOnPlates, alt: "Future champion testing the equipment" },
  { src: facilityFramingOverview, alt: "Framing work overview" },
  { src: facilityFramingFloor, alt: "Framing the floor structure" },
  { src: facilityFramingWall, alt: "Wall framing installation" },
  { src: facilityWallRaising, alt: "Raising the walls" },
  { src: facilityWallFraming, alt: "Framing progress" },
  { src: facilityPlywoodWall, alt: "Plywood sheathing installation" },
  { src: facilityEquipmentPrep, alt: "Assembling gym equipment" },
  { src: facilityFinishedGym, alt: "The finished facility" },
  { src: facilityFoundersCleaning, alt: "Founders prepping the space" },
  { src: facilityDemoFloor, alt: "Floor demolition" },
  { src: facilityFloorInstall1, alt: "Installing the new floor" },
  { src: facilityFloorInstall2, alt: "Floor installation progress" },
  { src: facilityFloorDiscussion, alt: "Planning floor layout" },
  { src: facilityScaffoldWork, alt: "Working on scaffolding" },
  { src: facilityHighWork, alt: "High ceiling work" },
  { src: facilityFinishedCourt, alt: "Finished basketball court and gym" },
];

const OurStory = () => {
  const [activeImg, setActiveImg] = useState<FacilityImg | null>(null);

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

              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10">
                Today, No Limits Academy is more than a boxing gym. It is a community hub built on mentorship, belonging, and opportunity. Leveraging backgrounds in education, military service, business, and boxing, Josh and Dave created a space where young people are challenged, supported, and believed in. Through discipline and care, NLA teaches its athletes that their circumstances do not define their future—and that no one succeeds alone.
              </p>

              {/* Photo Slot C - Centered at end */}
              <div className="w-full max-w-[420px] mx-auto">
                <div className="bg-muted rounded-lg shadow-md overflow-hidden">
                  <img 
                    src={joshMcNallyDave} 
                    alt="Josh, Coach McNally, and Dave at 2025 Naval Academy Brigade boxing championships"
                    className="w-full h-auto"
                  />
                  <div className="p-3 text-center">
                    <p className="text-sm text-muted-foreground italic">
                      Josh, Coach McNally, and Dave at 2025 Naval Academy Brigade boxing championships
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Our Facility Section */}
        <section className="py-16 md:py-20 bg-foreground">
          <div className="container">
            <div className="max-w-[1200px] mx-auto">
              <h2 className="text-3xl md:text-4xl font-black text-background mb-4">
                Our Facility
              </h2>
              <p className="text-lg text-background/80 mb-10">
                We began our journey in April of 2020 and moved into our current location in Rio Grande, NJ. Since then, we have methodically renovated, built, and modified our space to create a state-of-the-art training and youth development center that services at-risk and local youth of Cape May County.
              </p>
              
              {/* Photo Gallery - 4x4 desktop, 3 cols tablet, 2 cols mobile */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {facilityImages.map((img, idx) => (
                  <div key={idx} className="overflow-hidden rounded-xl bg-muted">
                    <button
                      type="button"
                      onClick={() => setActiveImg(img)}
                      className="block w-full aspect-[4/3]"
                      aria-label={`Enlarge ${img.alt}`}
                    >
                      <img
                        src={img.src}
                        alt={img.alt}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Lightbox */}
      <PortalLightbox
        open={!!activeImg}
        img={activeImg}
        onClose={() => setActiveImg(null)}
      />

      <Footer />
    </div>
  );
};

export default OurStory;
