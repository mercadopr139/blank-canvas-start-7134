import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Add your sections here */}
        <section className="container py-24 flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground text-center">
            Add your content sections here
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
