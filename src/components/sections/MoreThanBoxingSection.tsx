import { useState } from "react";
import moreThanBoxingImage from "@/assets/programs/more-than-boxing-gym.jpg";
import excursionSpeedboatTubing from "@/assets/excursions/excursion-speedboat-tubing.png";
import excursionPaddleboard from "@/assets/excursions/excursion-paddleboard.png";
import PortalLightbox from "@/components/ui/portal-lightbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClickToEnlargeGallery } from "@/components/ui/click-to-enlarge-gallery";
import { excursionGalleryImages } from "@/data/excursionsGallery";

const MoreThanBoxingSection = () => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<{ src: string; alt: string }>({ src: "", alt: "" });
  const [galleryOpen, setGalleryOpen] = useState(false);

  const openLightbox = (src: string, alt: string) => {
    setLightboxImg({ src, alt });
    setLightboxOpen(true);
  };

  return (
    <section className="relative bg-black overflow-hidden">
      <div className="container md:py-24 py-[20px]">
        <div className="relative w-full text-center">
          {/* Title */}
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg mb-6 md:mb-8">
            More than a boxing gym.
          </h2>

          {/* Three images in a row */}
          <div className="flex justify-between gap-4 md:gap-8 w-full">
            {/* Tubing - Left */}
            <div className="relative h-[200px] md:h-[350px] overflow-hidden rounded-lg border-4 border-white">
              <button
                type="button"
                onClick={() => openLightbox(excursionSpeedboatTubing, "Speed Boat & Tubing Fun")}
                className="w-full h-full cursor-pointer"
                aria-label="Enlarge image"
              >
                <img
                  src={excursionSpeedboatTubing}
                  alt="Speed Boat & Tubing Fun"
                  className="w-full h-full object-cover"
                />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-foreground/80 px-2 py-1.5">
                <p className="text-xs md:text-sm text-background text-center font-medium">Speed Boat & Tubing</p>
              </div>
            </div>

            {/* Camping - Center */}
            <div className="relative h-[200px] md:h-[350px] overflow-hidden rounded-lg border-4 border-white">
              <button
                type="button"
                onClick={() => openLightbox(moreThanBoxingImage, "Camping in West Virginia")}
                className="w-full h-full cursor-pointer"
                aria-label="Enlarge image"
              >
                <img
                  src={moreThanBoxingImage}
                  alt="No Limits Academy youth gathered around a campfire"
                  className="w-full h-full object-cover object-[center_30%]"
                />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-foreground/80 px-2 py-1.5">
                <p className="text-xs md:text-sm text-background text-center font-medium">Camping in West Virginia</p>
              </div>
            </div>

            {/* Kayaking - Right */}
            <div className="relative h-[200px] md:h-[350px] overflow-hidden rounded-lg border-4 border-white">
              <button
                type="button"
                onClick={() => openLightbox(excursionPaddleboard, "Paddle Board & Kayaking")}
                className="w-full h-full cursor-pointer"
                aria-label="Enlarge image"
              >
                <img
                  src={excursionPaddleboard}
                  alt="Paddle Board & Kayaking"
                  className="w-full h-full object-cover"
                />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-foreground/80 px-2 py-1.5">
                <p className="text-xs md:text-sm text-background text-center font-medium">Paddle Board & Kayaking</p>
              </div>
            </div>
          </div>

          {/* More Excursions Button */}
          <div className="mt-8">
            <Button
              onClick={() => setGalleryOpen(true)}
              className="bg-background text-foreground hover:bg-background/90"
            >
              More Excursions
            </Button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <PortalLightbox
        open={lightboxOpen}
        img={lightboxImg}
        onClose={() => setLightboxOpen(false)}
      />

      {/* Excursions Gallery Dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Excursions</DialogTitle>
          </DialogHeader>
          <ClickToEnlargeGallery images={excursionGalleryImages} showCaptions />
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setGalleryOpen(false)} className="bg-foreground text-background hover:bg-foreground/90">
              Back to Programs
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default MoreThanBoxingSection;
