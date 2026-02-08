const FreeAccessMarquee = () => {
  const message = "ALL YOUTH FREE — GUARANTEED";
  // Repeat the message to create seamless loop
  const repeatedMessage = `${message} \u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0 ${message} \u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0 ${message} \u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0 ${message}`;

  return (
    <section className="bg-nla py-2 md:py-3 overflow-hidden">
      <div className="relative">
      <div className="flex whitespace-nowrap animate-marquee-fast">
          <span className="text-base md:text-xl font-black tracking-widest text-nla-foreground px-4">
            {repeatedMessage}
          </span>
          <span className="text-base md:text-xl font-black tracking-widest text-nla-foreground px-4">
            {repeatedMessage}
          </span>
        </div>
      </div>
    </section>
  );
};

export default FreeAccessMarquee;
