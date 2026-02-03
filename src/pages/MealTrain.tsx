import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Utensils, Heart } from "lucide-react";
import mealTrainHero from "@/assets/meal-train/meal-train-hero.jpg";
import mealTrainLogo from "@/assets/meal-train/meal-train-logo.png";

const MEAL_TRAIN_LINK = "https://www.mealtrain.com/trains/ode4rn";

const MealTrain = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Image */}
        <section className="w-full">
          <img 
            src={mealTrainHero} 
            alt="NLA volunteers serving meals to youth participants" 
            className="w-full h-auto object-cover max-h-[500px]"
          />
        </section>

        {/* Hero Section */}
        <section className="bg-primary py-16 md:py-24">
          <div className="container">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-primary-foreground leading-tight mb-6">
                Meal Train
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/80 leading-relaxed mb-8">
                The NLA Meal Train supports our youth participants by providing free, sit-down meals during scheduled program days. These meals create consistency, build community, and ensure our athletes are fueled, focused, and cared for while they train and learn together. Volunteers play a vital role in making this possible.
              </p>
              <div className="flex flex-col items-center gap-3">
                <img 
                  src={mealTrainLogo} 
                  alt="Meal Train logo" 
                  className="w-48 h-auto mb-2"
                />
                <Button 
                  size="lg" 
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold text-lg px-8 py-6"
                  asChild
                >
                  <a href={MEAL_TRAIN_LINK} target="_blank" rel="noopener noreferrer">
                    Jump Aboard!
                  </a>
                </Button>
                <p className="text-sm text-primary-foreground/60">
                  Thank you for feeding our kids!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 md:py-20 bg-background">
          <div className="container">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-10">
              How It Works
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
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
                    <Heart className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Support the Program</h3>
                  <p className="text-muted-foreground">
                    Help create a welcoming, consistent environment for our athletes.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Meal Ideas */}
        <section className="py-16 md:py-20 bg-primary">
          <div className="container">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-8">
              Helpful Meal Ideas
            </h2>
            <ul className="space-y-3 max-w-xl">
              {[
                "Family-style dinners",
                "Pasta + salad",
                "Soups / comfort meals",
                "Ready-to-heat meals",
                "Grocery or delivery gift cards",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-lg text-primary-foreground/90">
                  <span className="w-2 h-2 bg-primary-foreground rounded-full flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Important Notes */}
        <section className="py-16 md:py-20 bg-background">
          <div className="container">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
              Important Notes
            </h2>
            <ul className="space-y-3 max-w-2xl">
              {[
                "Meals are served on-site during scheduled NLA programming.",
                "Meal details and quantities will be listed in the MealTrain signup.",
                "If you cannot cook, delivery or gift cards are always helpful.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-lg text-muted-foreground">
                  <span className="w-2 h-2 bg-foreground rounded-full flex-shrink-0 mt-2" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-16 md:py-20 bg-primary">
          <div className="container text-center">
            <Button 
              size="lg" 
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold text-lg px-8 py-6"
              asChild
            >
              <a href={MEAL_TRAIN_LINK} target="_blank" rel="noopener noreferrer">
                Sign Up for a Meal
              </a>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default MealTrain;
