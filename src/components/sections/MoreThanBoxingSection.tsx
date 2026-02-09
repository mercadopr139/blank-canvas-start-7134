import moreThanBoxingImage from "@/assets/programs/more-than-boxing-gym.jpg";

const MoreThanBoxingSection = () => {
  return (
    <section className="relative bg-black overflow-hidden">
      <div className="container md:py-24 py-[20px]">
        <div className="relative w-full max-w-3xl mx-auto">
          {/* Image cropped from top */}
          <div className="relative h-[300px] md:h-[400px] overflow-hidden rounded-lg">
            <img 
              src={moreThanBoxingImage} 
              alt="No Limits Academy youth gathered around a campfire" 
              className="w-full h-full object-cover object-bottom" 
            />
            {/* Text overlay positioned on the image */}
            <div className="absolute top-4 md:top-8 left-0 right-0 flex justify-center">
              <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white text-center drop-shadow-lg">
                More than a boxing gym.
              </h2>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MoreThanBoxingSection;