const FreeAccessMarquee = () => {
  const message = "ALL YOUTH FREE — GUARANTEED";
  // Repeat the message to create seamless loop
  const repeatedMessage = `${message} \u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0 ${message} \u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0 ${message} \u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0 ${message}`;

  return (
    <section className="bg-background py-2 md:py-3 overflow-hidden border-b border-border/30">
      <div className="relative">
        <div className="flex whitespace-nowrap animate-marquee-fast">
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
