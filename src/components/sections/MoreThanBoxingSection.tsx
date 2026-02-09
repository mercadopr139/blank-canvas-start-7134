import moreThanBoxingImage from "@/assets/programs/more-than-boxing-gym.jpg";
const MoreThanBoxingSection = () => {
  return <section className="relative bg-black overflow-hidden">
      <div className="container md:py-24 py-[20px]">
        <div className="relative w-full max-w-3xl mx-auto">
          {/* Image with creative fade */}
          <div className="relative">
            <img src={moreThanBoxingImage} alt="No Limits Academy youth gathered around a campfire" className="w-full h-auto rounded-lg" />
          </div>
          
          {/* Text overlay on top of image */}
          <div className="absolute inset-0 flex items-start justify-center pt-8 md:pt-12">
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white text-center drop-shadow-lg">
              More than a boxing gym.
            </h2>
          </div>
        </div>
      </div>
    </section>;
};
export default MoreThanBoxingSection;