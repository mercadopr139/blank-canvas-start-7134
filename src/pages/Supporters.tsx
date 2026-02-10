import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
const supporters = [{
  name: "Supporter 1",
  img: "https://via.placeholder.com/300x200"
}, {
  name: "Supporter 2",
  img: "https://via.placeholder.com/300x200"
}, {
  name: "Supporter 3",
  img: "https://via.placeholder.com/300x200"
}, {
  name: "Supporter 4",
  img: "https://via.placeholder.com/300x200"
}];
const PAYPAL_LINK = "https://www.paypal.com/ncp/payment/TMMDVUSEQKHJC";
const Supporters = () => {
  return <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container py-10 md:py-16 px-4 bg-primary">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-primary-foreground">
            Our Supporters
          </h1>
          <p className="text-lg mb-8 max-w-2xl leading-relaxed text-secondary">
            No Limits Academy is supported by amazing people and organizations who
            believe in our kids, our mission, and our community.
          </p>

          {/* Supporter Photo Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            {supporters.map((s, index) => <Card key={index} className="overflow-hidden">
                <img src={s.img} alt={s.name} className="w-full h-44 object-cover" />
                <CardContent className="p-4">
                  <p className="text-lg font-semibold text-foreground">{s.name}</p>
                </CardContent>
              </Card>)}
          </div>

          {/* Donate Section */}
          <div className="rounded-2xl bg-foreground text-background text-center p-8 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Want to Support No Limits Academy?
            </h2>
            <p className="text-base mb-6 opacity-90">
              Your donation helps us keep kids training, mentored, and safe.
            </p>
            <Button size="lg" className="bg-background text-foreground hover:bg-background/90 font-bold text-base px-8" asChild>
              <a href={PAYPAL_LINK} target="_blank" rel="noopener noreferrer">
                DONATE VIA PAYPAL
              </a>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>;
};
export default Supporters;