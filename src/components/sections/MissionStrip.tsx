const MissionStrip = () => {
  return (
    <section className="w-full py-10 md:py-14" style={{ backgroundColor: '#bf0f3e' }}>
      <div className="container">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs md:text-sm font-bold tracking-[0.25em] uppercase text-white/60 mb-3">
            Our Mission
          </p>
          <p className="text-2xl md:text-4xl lg:text-5xl font-black text-white leading-tight">
            Through boxing, we develop our kids{" "}
            <span className="italic">personally</span>,{" "}
            <span className="italic">professionally</span>, and{" "}
            <span className="italic">spiritually</span>.
          </p>
        </div>
      </div>
    </section>
  );
};

export default MissionStrip;
