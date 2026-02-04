import { useEffect, useRef } from "react";

const FreeAccessMarquee = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const message = "ALL YOUTH FREE • NO COST ACCESS • SERVING OUR COMMUNITY";
  // Repeat the message to create seamless loop
  const repeatedMessage = `${message} \u00A0\u00A0\u00A0\u00A0\u00A0 ${message} \u00A0\u00A0\u00A0\u00A0\u00A0 ${message} \u00A0\u00A0\u00A0\u00A0\u00A0 ${message}`;

  return (
    <section className="bg-background py-3 md:py-4 overflow-hidden border-b border-border/30">
      <div className="relative">
        <div 
          ref={scrollRef}
          className="flex whitespace-nowrap animate-marquee"
        >
          <span className="text-sm md:text-base font-bold tracking-widest text-foreground/90 px-4">
            {repeatedMessage}
          </span>
          <span className="text-sm md:text-base font-bold tracking-widest text-foreground/90 px-4">
            {repeatedMessage}
          </span>
        </div>
      </div>
    </section>
  );
};

export default FreeAccessMarquee;
