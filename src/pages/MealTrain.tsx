import { useState } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Utensils, Heart, Bus } from "lucide-react";
import PortalLightbox from "@/components/ui/portal-lightbox";
import mealTrainHero from "@/assets/meal-train/meal-train-hero.jpg";
import mealTrainLogo from "@/assets/meal-train/meal-train-logo.png";

const MEAL_TRAIN_LINK = "https://www.mealtrain.com/trains/ode4rn";

// Placeholder for meal train photo - replace with actual image when available
const mealTrainPhoto = "/placeholder.svg";

const MealTrain = () => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  return <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Image */}
        <section className="w-full lg:py-8 lg:px-8">
          <img src={mealTrainHero} alt="NLA volunteers serving meals to youth participants" className="w-full h-auto object-cover max-h-[500px] md:[object-position:center_25%] lg:max-w-4xl lg:mx-auto lg:rounded-xl lg:object-contain lg:max-h-none" />
        </section>

        {/* Hero Section - Intro */}
        <section className="bg-primary py-16 md:py-[30px]">
          <div className="container">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-primary-foreground leading-tight mb-4">
                Meal Train
              </h1>
              <img src={mealTrainLogo} alt="Meal Train logo" className="w-32 md:w-40 h-auto mb-6" />
              <p className="text-lg md:text-xl text-primary-foreground/80 leading-relaxed">
                The NLA Meal Train supports our youth participants by providing free, sit-down meals during scheduled program days. These meals create consistency, build community, and ensure our athletes are fueled, focused, and cared for while they train and learn together. Volunteers play a vital role in making this possible.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="pt-8 pb-16 md:pt-10 md:pb-20 bg-background">
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
                    <Bus className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Jump Aboard</h3>
                  <p className="text-muted-foreground mb-4">
                    All details included in the link below. Sign up to provide a meal for our youth.
                  </p>
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <a href={MEAL_TRAIN_LINK} target="_blank" rel="noopener noreferrer">
                      Sign Up
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Jump Aboard CTA */}
            <div className="flex flex-col items-center gap-3 pt-8">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-lg px-8 py-[20px]" asChild>
                <a href={MEAL_TRAIN_LINK} target="_blank" rel="noopener noreferrer">
                  Jump Aboard!
                </a>
              </Button>
              <p className="text-sm text-muted-foreground">
                Thank you for feeding our kids!
              </p>
            </div>
          </div>
        </section>

        {/* Photo Section */}
        <section className="py-16 md:py-20 bg-foreground">
          <div className="container">
            <div 
              className="relative w-full max-w-2xl mx-auto cursor-pointer group"
              onClick={() => setLightboxOpen(true)}
            >
              <img 
                src={mealTrainPhoto} 
                alt="We feed our kids 5 nights a week" 
                className="w-full h-64 md:h-80 object-cover rounded-lg transition-transform group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors rounded-lg" />
            </div>
            <p className="text-center mt-6 text-lg font-semibold text-background">
              We feed our kids 5 nights a week.
            </p>

            {/* Lightbox */}
            <PortalLightbox 
              open={lightboxOpen} 
              onClose={() => setLightboxOpen(false)}
              img={{ src: mealTrainPhoto, alt: "We feed our kids 5 nights a week" }}
            />
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-16 md:py-20 bg-primary">
          <div className="container text-center">
            <Button size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold text-lg px-8 py-6" asChild>
              <a href={MEAL_TRAIN_LINK} target="_blank" rel="noopener noreferrer">
                Sign Up for a Meal
              </a>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>;
};
export default MealTrain;