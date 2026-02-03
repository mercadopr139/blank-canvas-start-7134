import { useState } from "react";

type Img = { src: string; alt: string; caption?: string };

export function ClickToEnlargeGallery({ 
  images,
  showCaptions = false 
}: { 
  images: Img[];
  showCaptions?: boolean;
}) {
  const [activeImg, setActiveImg] = useState<Img | null>(null);

  return (
    <div className="relative">
      {/* Gallery grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {images.map((img, idx) => (
          <div key={idx} className="group relative overflow-hidden rounded-lg">
            <button
              type="button"
              onClick={() => setActiveImg(img)}
              className="block w-full aspect-[4/3] bg-muted"
              aria-label="Enlarge image"
            >
              <img
                src={img.src}
                alt={img.alt}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            </button>
            {showCaptions && img.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-foreground/80 text-background px-3 py-2">
                <p className="text-sm font-medium">{img.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox overlay */}
      {activeImg && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {/* dark overlay */}
          <button
            type="button"
            className="absolute inset-0 bg-black/80"
            onClick={() => setActiveImg(null)}
            aria-label="Close enlarged image"
          />
          {/* image */}
          <div className="relative z-10 w-full max-w-3xl">
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
            {activeImg.caption && (
              <p className="mt-2 text-center text-background text-sm font-medium">
                {activeImg.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
