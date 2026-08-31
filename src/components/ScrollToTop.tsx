import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Force an INSTANT jump to top on route change. The global CSS
    // `html { scroll-behavior: smooth }` (great for in-page anchor links) would
    // otherwise animate this — so a new page inherits the prior scroll position
    // and visibly glides up. "instant" overrides the CSS just for this reset.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
