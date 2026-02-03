import { useState } from "react";

type Img = { src: string; alt: string };

export function ClickToEnlargeGallery({ images }: { images: Img[] }) {
  const [activeImg, setActiveImg] = useState<Img | null>(null);

  return (
    <div className="relative">
      {/* Gallery grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, idx) => (
          <div key={idx} className="overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setActiveImg(img)}
              className="block w-full"
              aria-label="Enlarge image"
            >
              <img
                src={img.src}
                alt={img.alt}
                className="h-40 w-full object-cover"
                loading="lazy"
              />
            </button>
          </div>
        ))}
      </div>

      {/* Lightbox overlay (inside same modal) */}
      {activeImg && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          {/* dark overlay */}
          <button
            type="button"
            className="absolute inset-0 bg-black/80"
            onClick={() => setActiveImg(null)}
            aria-label="Close enlarged image"
          />
          {/* image */}
          <div className="relative z-10 w-[92%] max-w-3xl">
            <button
              type="button"
              onClick={() => setActiveImg(null)}
              className="absolute -top-10 right-0 rounded-xl bg-background px-3 py-2 text-sm font-semibold text-foreground"
            >
              ✕ Close
            </button>
            <img
              src={activeImg.src}
              alt={activeImg.alt}
              className="max-h-[80vh] w-full rounded-2xl object-contain bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
}
