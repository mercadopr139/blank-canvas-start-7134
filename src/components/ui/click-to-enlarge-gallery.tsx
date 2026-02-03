import { useEffect, useMemo, useState } from "react";
import PortalLightbox from "./portal-lightbox";

type Img = { src: string; alt: string; caption?: string };

export function ClickToEnlargeGallery({ 
  images,
  showCaptions = false,
  variant = "compact",
}: { 
  images: Img[];
  showCaptions?: boolean;
  variant?: "compact" | "featured";
}) {
  const [activeImg, setActiveImg] = useState<Img | null>(null);

  useEffect(() => {
    if (!activeImg) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [activeImg]);

  const ui = useMemo(() => {
    if (variant === "featured") {
      return {
        gridClassName: "grid grid-cols-1 sm:grid-cols-3 gap-4",
        itemClassName: "group relative overflow-hidden rounded-lg",
        buttonClassName: "block w-full aspect-[4/3] bg-muted",
        imgClassName:
          "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105",
        captionWrapClassName:
          "absolute bottom-0 left-0 right-0 bg-foreground/80 text-background px-3 py-2",
        captionTextClassName: "text-sm font-medium",
      } as const;
    }

    return {
      gridClassName: "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3",
      itemClassName: "overflow-hidden rounded-xl border border-border bg-muted",
      buttonClassName: "block w-full",
      imgClassName: "h-40 w-full object-cover",
      captionWrapClassName: "px-3 py-2 bg-foreground",
      captionTextClassName: "text-xs text-background text-center",
    } as const;
  }, [variant]);

  return (
    <div className="relative">
      {/* Gallery grid */}
      <div className={ui.gridClassName}>
        {images.map((img, idx) => (
          <div key={idx} className={ui.itemClassName}>
            <button
              type="button"
              onClick={() => setActiveImg(img)}
              className={ui.buttonClassName}
              aria-label="Enlarge image"
            >
              <img
                src={img.src}
                alt={img.alt}
                className={ui.imgClassName}
                loading="lazy"
              />
            </button>
            {showCaptions && img.caption ? (
              <div className={ui.captionWrapClassName}>
                <p className={ui.captionTextClassName}>{img.caption}</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <PortalLightbox
        open={!!activeImg}
        img={activeImg}
        onClose={() => setActiveImg(null)}
      />
    </div>
  );
}
