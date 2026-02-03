import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

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
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!activeImg) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [activeImg]);

  const overlay = useMemo(() => {
    if (!activeImg) return null;

    const left = anchor?.x ?? window.innerWidth / 2;
    const top = anchor?.y ?? window.innerHeight / 2;

    return (
      <div className="fixed inset-0 z-[9999]">
        {/* dark overlay */}
        <button
          type="button"
          className="absolute inset-0 bg-foreground/80"
          onClick={() => setActiveImg(null)}
          aria-label="Close enlarged image"
        />

        {/* image (positioned over clicked item) */}
        <div
          className="absolute z-10 w-[92%] max-w-3xl p-4"
          style={{
            left,
            top,
            transform: "translate(-50%, -50%)",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveImg(null)}
            className="absolute -top-10 right-4 rounded-xl bg-background px-3 py-2 text-sm font-semibold text-foreground"
          >
            ✕ Close
          </button>
          <img
            src={activeImg.src}
            alt={activeImg.alt}
            className="max-h-[80vh] w-full rounded-2xl object-contain bg-background"
          />
          {activeImg.caption && (
            <p className="mt-2 text-center text-background text-sm font-medium">
              {activeImg.caption}
            </p>
          )}
        </div>
      </div>
    );
  }, [activeImg, anchor]);

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
      captionWrapClassName: "hidden",
      captionTextClassName: "",
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
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                const pad = 24;
                const clampedX = Math.min(Math.max(x, pad), window.innerWidth - pad);
                const clampedY = Math.min(
                  Math.max(y, pad),
                  window.innerHeight - pad
                );
                setAnchor({ x: clampedX, y: clampedY });
                setActiveImg(img);
              }}
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

      {/* Lightbox overlay (portal to body to avoid scroll-container positioning issues) */}
      {activeImg && overlay ? createPortal(overlay, document.body) : null}
    </div>
  );
}
