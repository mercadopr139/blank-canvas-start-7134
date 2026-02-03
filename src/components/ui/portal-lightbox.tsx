import { useEffect } from "react";
import { createPortal } from "react-dom";

type Img = { src: string; alt?: string };

export default function PortalLightbox({
  open,
  img,
  onClose,
}: {
  open: boolean;
  img: Img | null;
  onClose: () => void;
}) {
  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !img) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center"
      style={{ pointerEvents: "auto" }}
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
        style={{ pointerEvents: "auto" }}
      />

      {/* Panel */}
      <div
        className="relative z-[2147483647] w-[92%] max-w-4xl"
        onClick={(e) => e.stopPropagation()}
        style={{ pointerEvents: "auto" }}
      >
        {/* Close */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="absolute right-3 top-3 z-[2147483647] rounded-xl bg-white px-3 py-2 text-sm font-semibold shadow"
          style={{ pointerEvents: "auto" }}
        >
          ✕ Close
        </button>

        {/* Image */}
        <div className="rounded-2xl bg-black p-2">
          <img
            src={img.src}
            alt={img.alt || "Expanded image"}
            className="max-h-[82vh] w-full rounded-xl object-contain"
            draggable={false}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
