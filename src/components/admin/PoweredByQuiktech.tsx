import { useState } from "react";

/**
 * Shared "Powered by QUIKTECH" footer for the admin area.
 *
 * The logo is loaded from /public/quiktech-logo.png (drop the file there and it
 * appears automatically — no rebuild needed). Until that file exists the image
 * 404s and we fall back to a clean "QUIKTECH" wordmark, so the footer always
 * renders something sensible.
 *
 * size="lg" is used on the main dashboard (slightly bigger logo); the default
 * "sm" is used in the section layout footers.
 */
interface PoweredByQuiktechProps {
  size?: "sm" | "lg";
}

const PoweredByQuiktech = ({ size = "sm" }: PoweredByQuiktechProps) => {
  const [imgOk, setImgOk] = useState(true);
  const logoHeight = size === "lg" ? "h-20" : "h-7";
  const textSize = size === "lg" ? "text-sm" : "text-xs";

  return (
    <footer className={`mt-auto border-t border-white/10 px-4 ${size === "lg" ? "py-6" : "py-4"}`}>
      <div className={`flex items-center justify-center gap-2 text-white/40 ${textSize}`}>
        <span className="uppercase tracking-wide">Powered by</span>
        {imgOk ? (
          <img
            src="/quiktech-logo.png"
            alt="QUIKTECH — Gym Management Software"
            className={`${logoHeight} w-auto opacity-90`}
            onError={() => setImgOk(false)}
          />
        ) : (
          <span className="font-bold tracking-wide text-white/60">QUIKTECH</span>
        )}
      </div>
    </footer>
  );
};

export default PoweredByQuiktech;
