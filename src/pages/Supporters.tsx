import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { ClickToEnlargeGallery } from "@/components/ui/click-to-enlarge-gallery";
import supporterCheck1 from "@/assets/supporters/supporter-check-1.jpeg";
import supporterCheck2 from "@/assets/supporters/supporter-check-2.jpeg";

const supporterImages = [
  { src: supporterCheck1, alt: "Supporter donation check presentation", caption: "Caption coming soon" },
  { src: supporterCheck2, alt: "Supporter donation check presentation with youth", caption: "Caption coming soon" },
];
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

          {/* Supporter Photo Gallery */}
          <div className="mb-12">
            <ClickToEnlargeGallery images={supporterImages} showCaptions variant="featured" />
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