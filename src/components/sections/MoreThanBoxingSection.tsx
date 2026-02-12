import { useState } from "react";
import moreThanBoxingImage from "@/assets/programs/more-than-boxing-gym.jpg";
import PortalLightbox from "@/components/ui/portal-lightbox";

const MoreThanBoxingSection = () => {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <section className="relative bg-black overflow-hidden">
      <div className="container md:py-24 py-[20px]">
        <div className="relative w-full max-w-3xl mx-auto text-4xl text-center">
          {/* Text positioned to overlap */}
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg mb-[-30px] md:mb-[-40px] relative z-10 text-center">
            More than a boxing gym.
          </h2>
          {/* Image container */}
          <div className="relative h-[350px] md:h-[450px] overflow-hidden rounded-lg">
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="w-full h-full cursor-pointer"
              aria-label="Enlarge image">

              <img
                src={moreThanBoxingImage}
                alt="No Limits Academy youth gathered around a campfire"
                className="w-full h-full object-[center_30%] object-contain px-0" />

            </button>
            {/* Caption */}
            <div className="absolute bottom-0 left-0 right-0 bg-foreground/80 px-3 py-2">
              <p className="text-sm text-background text-center font-medium">Camping in West Virginia</p>
            </div>
          </div>
        </div>
      </div>

      <PortalLightbox
        open={lightboxOpen}
        img={{ src: moreThanBoxingImage, alt: "No Limits Academy youth gathered around a campfire" }}
        onClose={() => setLightboxOpen(false)} />

    </section>);

};

export default MoreThanBoxingSection;