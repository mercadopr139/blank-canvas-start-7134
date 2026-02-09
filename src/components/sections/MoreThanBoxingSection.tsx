import moreThanBoxingImage from "@/assets/programs/more-than-boxing-gym.jpg";
const MoreThanBoxingSection = () => {
  return <section className="relative bg-black overflow-hidden">
      <div className="container md:py-24 py-[20px]">
        <div className="relative w-full max-w-3xl mx-auto text-4xl text-center">
          {/* Text positioned to overlap */}
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg mb-[-30px] md:mb-[-40px] relative z-10 text-center">
            More than a boxing gym.
          </h2>
          {/* Image container */}
          <div className="relative h-[350px] md:h-[450px] overflow-hidden rounded-lg">
            <img src={moreThanBoxingImage} alt="No Limits Academy youth gathered around a campfire" className="w-full h-full object-[center_30%] object-contain" />
          </div>
        </div>
      </div>
    </section>;
};
export default MoreThanBoxingSection;