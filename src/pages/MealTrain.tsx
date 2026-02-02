import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Utensils, Heart } from "lucide-react";

const MEAL_TRAIN_LINK = "https://www.mealtrain.com/trains/ode4rn";

const MealTrain = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-primary py-16 md:py-24">
          <div className="container">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-primary-foreground leading-tight mb-6">
                Meal Train
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/80 leading-relaxed mb-8">
                When a family in our NLA community faces hardship—injury, illness, crisis, or major life events—we rally around them. The Meal Train is a simple way to provide practical support through meals or delivery. Every signup helps a family feel cared for and supported.
              </p>
              <div className="flex flex-col items-start gap-3">
                <Button 
                  size="lg" 
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold text-lg px-8 py-6"
                  asChild
                >
                  <a href={MEAL_TRAIN_LINK} target="_blank" rel="noopener noreferrer">
                    Join the Meal Train
                  </a>
                </Button>
                <p className="text-sm text-primary-foreground/60">
                  Takes 2 minutes. Every meal helps.
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
                    Choose a day that works for your schedule.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-border">
                <CardContent className="pt-8 pb-8 text-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Utensils className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Choose a Meal</h3>
                  <p className="text-muted-foreground">
                    Drop-off or delivery—whatever works best.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-border">
                <CardContent className="pt-8 pb-8 text-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Heart className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Help a Family</h3>
                  <p className="text-muted-foreground">
                    Feel supported during a difficult time.
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
                "Grocery / delivery gift cards",
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
                "Dietary needs/allergies will be listed in the MealTrain signup.",
                "Please follow the drop-off instructions listed on the schedule.",
                "If you can't cook, delivery or gift cards are always helpful.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-lg text-muted-foreground">
                  <span className="w-2 h-2 bg-foreground rounded-full flex-shrink-0 mt-2" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Repeat CTA */}
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
