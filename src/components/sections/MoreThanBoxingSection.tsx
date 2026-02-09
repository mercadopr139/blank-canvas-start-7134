import moreThanBoxingImage from "@/assets/programs/more-than-boxing-gym.jpg";

const MoreThanBoxingSection = () => {
  return (
    <section className="relative bg-black overflow-hidden">
      <div className="container md:py-24 py-[20px]">
        <div className="relative w-full max-w-3xl mx-auto">
          {/* Text positioned to overlap */}
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white text-center drop-shadow-lg mb-[-30px] md:mb-[-40px] relative z-10">
            More than a boxing gym.
          </h2>
          {/* Image container */}
          <div className="relative h-[350px] md:h-[450px] overflow-hidden rounded-lg">
            <img 
              src={moreThanBoxingImage} 
              alt="No Limits Academy youth gathered around a campfire" 
              className="w-full h-full object-cover object-[center_30%]" 
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default MoreThanBoxingSection;