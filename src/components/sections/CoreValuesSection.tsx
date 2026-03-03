import coreValuesBanner from "@/assets/gym-buddies/core-values-banner.png";

const CoreValuesSection = () => {
  return (
    <section className="bg-background">
      {/* Mobile */}
      <div className="md:hidden py-8">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="core-values mx-auto">
              <img src={coreValuesBanner} alt="NLA Core Values: Respect, Commitment, Accountability, Leadership, Trust, Service" className="w-full h-auto" />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:block py-8">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="core-values max-w-2xl mx-auto px-0">
              <img src={coreValuesBanner} alt="NLA Core Values: Respect, Commitment, Accountability, Leadership, Trust, Service" className="w-full h-auto object-fill" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CoreValuesSection;
