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
        <section className="pt-12 pb-10 md:pt-16 md:pb-14 bg-background">
          <div className="container">
            {/* Section Header with red accent */}
            <div className="mb-12 md:mb-16">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--nla-red))] mb-2">
                Get Involved
              </p>
              <div className="flex items-center gap-4">
                <div className="w-1 h-10 bg-[hsl(var(--nla-red))] rounded-full" />
                <h2 className="text-3xl md:text-4xl font-black text-foreground">
                  How It Works
                </h2>
              </div>
            </div>

            {/* Steps */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-0 mb-16">
              {[
                { icon: Heart, step: "01", title: "Want to Feed our Kids?", desc: "Join the Meal Train and help nourish our youth with a home-cooked or delivered meal." },
                { icon: Calendar, step: "02", title: "Pick a Date", desc: "Choose a scheduled program day that works for you." },
                { icon: Utensils, step: "03", title: "Plan a Meal", desc: "Prepare a group meal or arrange delivery for our youth participants." },
                { icon: Truck, step: "04", title: "Jump Aboard", desc: "All details included in the link below. Click to view & Sign-Up!" },
              ].map((item, i) => (
                <div key={i} className="relative group">
                  {/* Connector line */}
                  {i < 3 && (
                    <div className="hidden lg:block absolute top-10 right-0 w-full h-[2px] bg-border z-0 translate-x-1/2" />
                  )}
                  <div className="relative z-10 flex flex-col items-center text-center px-6 py-8">
                    {/* Step number + icon */}
                    <div className="relative mb-5">
                      <div className="w-20 h-20 rounded-2xl bg-foreground flex items-center justify-center transition-all duration-300 group-hover:bg-[hsl(var(--nla-red))] group-hover:scale-105 group-hover:shadow-lg">
                        <item.icon className="w-9 h-9 text-background" />
                      </div>
                      <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[hsl(var(--nla-red))] text-[hsl(var(--nla-red-foreground))] text-xs font-bold flex items-center justify-center">
                        {item.step}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    {i === 3 && (
                      <Button size="sm" className="mt-4 bg-[hsl(var(--nla-red))] text-[hsl(var(--nla-red-foreground))] hover:bg-[hsl(var(--nla-red))]/90" asChild>
                        <a href={MEAL_TRAIN_LINK} target="_blank" rel="noopener noreferrer">
                          Meal Train Sign-Up
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="w-16 h-1 bg-[hsl(var(--nla-red))] mx-auto mb-10 rounded-full" />

            {/* Partner Logos */}
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-8">
                Proudly supported by local businesses who help fuel our youth
              </p>
              <div className="flex flex-wrap items-center justify-center gap-10 md:gap-14">
                <img src={tacoCaballitoLogo} alt="Taco Caballito Tequileria" className="h-16 md:h-22 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300" />
                <img src={mudhenBrewingLogo} alt="Mud Hen Brewing Co." className="h-12 md:h-18 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300" />
                <img src={capeSquareLogo} alt="Cape Square Entertainment" className="h-20 md:h-26 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300" />
                <img src={mattsFamilyLogo} alt="Matt's Family - Taste the Love" className="h-44 md:h-52 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300" />
              </div>
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