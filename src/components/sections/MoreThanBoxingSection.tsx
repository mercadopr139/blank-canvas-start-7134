import moreThanBoxingImage from "@/assets/programs/more-than-boxing-gym.jpg";

const MoreThanBoxingSection = () => {
  return (
    <section className="relative bg-black overflow-hidden">
      <div className="container py-16 md:py-24">
        <div className="relative w-full max-w-3xl mx-auto">
          {/* Image with creative fade */}
          <div className="relative">
            <img
              src={moreThanBoxingImage}
              alt="No Limits Academy youth at laser tag excursion"
              className="w-full h-auto rounded-lg"
            />
            {/* Gradient overlays for creative fade effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent rounded-lg" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60 rounded-lg" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black rounded-lg" />
          </div>
          
          {/* Text overlay on top of image */}
          <div className="absolute inset-0 flex items-start justify-center pt-8 md:pt-12">
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white text-center drop-shadow-lg">
              More than a boxing gym.
            </h2>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MoreThanBoxingSection;
