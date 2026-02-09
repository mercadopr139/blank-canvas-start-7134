import moreThanBoxingImage from "@/assets/programs/more-than-boxing-gym.jpg";

const MoreThanBoxingSection = () => {
  return (
    <section className="py-16 md:py-20 bg-background">
      <div className="container">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">
          More than a boxing gym.
        </h2>
        
        <div className="w-full max-w-2xl">
          <img
            src={moreThanBoxingImage}
            alt="No Limits Academy youth at laser tag excursion"
            className="w-full h-auto rounded-lg shadow-lg"
          />
        </div>
      </div>
    </section>
  );
};

export default MoreThanBoxingSection;
