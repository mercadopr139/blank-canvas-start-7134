import { useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Utensils, Heart, Truck } from "lucide-react";
import PortalLightbox from "@/components/ui/portal-lightbox";
import { ClickToEnlargeGallery } from "@/components/ui/click-to-enlarge-gallery";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mealTrainGalleryImages } from "@/data/mealTrainGallery";
import mealTrainHero from "@/assets/meal-train/meal-train-hero.jpg";
import mealTrainLogo from "@/assets/meal-train/meal-train-logo.png";
import mealTrainServing from "@/assets/meal-train/meal-train-serving.jpg";
import mattsFamilyLogo from "@/assets/meal-train/matts-family-taste-the-love.png";
import tacoCaballitoLogo from "@/assets/meal-train/taco-caballito-logo.png";
import mudhenBrewingLogo from "@/assets/meal-train/mudhen-brewing-logo.jpg";
import capeSquareLogo from "@/assets/meal-train/cape-square-entertainment-logo.png";

const MEAL_TRAIN_LINK = "https://www.mealtrain.com/trains/ode4rn";

const MealTrain = () => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  return <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Image */}
        <section className="w-full lg:py-8 lg:px-8">
          <img src={mealTrainHero} alt="NLA volunteers serving meals to youth participants" className="w-full h-auto object-cover max-h-[500px] md:[object-position:center_25%] lg:max-w-4xl lg:mx-auto lg:rounded-xl lg:object-contain lg:max-h-none" />
        </section>

        {/* Hero Section - Intro */}
        <section className="bg-primary py-8 md:py-[40px]">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-primary-foreground leading-tight mb-4">
                Meal Train
              </h1>
              <img src={mealTrainLogo} alt="Meal Train logo" className="w-32 md:w-40 h-auto mb-6 mx-auto object-fill" />
              <p className="text-lg md:text-xl text-primary-foreground/80 leading-relaxed text-justify">
                Prepare a group meal or arrange delivery for our youth participants.
                The NLA Meal Train supports our youth participants by providing free, sit-down meals during scheduled program days. These meals create consistency, build community, and ensure our athletes are fueled, focused, and cared for while they train and learn together. Volunteers play a vital role in making this possible.
              </p>
              <div className="mt-6">
                <Button className="bg-background text-foreground hover:bg-background/90" asChild>
                  <a href={MEAL_TRAIN_LINK} target="_blank" rel="noopener noreferrer">
                    Meal Train Sign-Up
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="pt-8 pb-6 md:pt-10 md:pb-8 bg-background py-[20px]">
          <div className="container">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-10">
              How It Works
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <Card className="border-border">
                <CardContent className="pt-8 pb-8 text-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Heart className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Want to Feed our Kids?</h3>
                  <p className="text-muted-foreground">
                    Join the Meal Train and help nourish our youth with a home-cooked or delivered meal.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-border">
                <CardContent className="pt-8 pb-8 text-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Pick a Date</h3>
                  <p className="text-muted-foreground">
                    Choose a scheduled program day that works for you.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-border">
                <CardContent className="pt-8 pb-8 text-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Utensils className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Provide a Meal</h3>
                  <p className="text-muted-foreground">
                    Prepare a group meal or arrange delivery for our youth participants.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="pt-8 pb-8 text-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Truck className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Jump Aboard</h3>
                  <p className="text-muted-foreground mb-4">All details included in the link below. Click to view & Sign-Up!</p>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <a href={MEAL_TRAIN_LINK} target="_blank" rel="noopener noreferrer">
                      Meal Train Sign-Up
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Partner Logos */}
            <div className="text-center mt-2">
              <div className="flex flex-wrap items-center justify-center gap-10 md:gap-14">
                <img src={tacoCaballitoLogo} alt="Taco Caballito Tequileria" className="h-16 md:h-22 w-auto object-contain" />
                <img src={mudhenBrewingLogo} alt="Mud Hen Brewing Co." className="h-12 md:h-18 w-auto object-contain" />
                <img src={capeSquareLogo} alt="Cape Square Entertainment" className="h-20 md:h-26 w-auto object-contain" />
                <img src={mattsFamilyLogo} alt="Matt's Family - Taste the Love" className="h-44 md:h-52 w-auto object-contain" />
              </div>
              <p className="text-sm text-muted-foreground mt-6 italic">
                Proudly supported by local businesses who help fuel our youth.
              </p>
            </div>
          </div>
        </section>

        {/* Photo Section */}
        <section className="py-16 md:py-20 bg-foreground">
          <div className="container">
            <div className="relative w-full max-w-2xl mx-auto cursor-pointer group" onClick={() => setLightboxOpen(true)}>
              <img src={mealTrainServing} alt="We feed our kids 5 nights a week" className="w-full h-64 md:h-80 object-cover rounded-lg transition-transform group-hover:scale-[1.02]" />
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors rounded-lg" />
            </div>
            <p className="text-center mt-6 text-lg font-semibold text-background">
              We feed our kids 5 nights a week.
            </p>
            <div className="flex justify-center mt-6">
              <Button onClick={() => setGalleryOpen(true)} className="bg-background text-foreground hover:bg-background/90">
                View Meal Train Photos
              </Button>
            </div>

            {/* Lightbox */}
            <PortalLightbox open={lightboxOpen} onClose={() => setLightboxOpen(false)} img={{
            src: mealTrainServing,
            alt: "We feed our kids 5 nights a week"
          }} />
          </div>
        </section>

        {/* Gallery Dialog */}
        <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Meal Train Photos</DialogTitle>
            </DialogHeader>
            <ClickToEnlargeGallery images={mealTrainGalleryImages} showCaptions />
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setGalleryOpen(false)} className="bg-foreground text-background hover:bg-foreground/90">
                Back to Meal Train
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>

      <Footer />
    </div>;
};
export default MealTrain;