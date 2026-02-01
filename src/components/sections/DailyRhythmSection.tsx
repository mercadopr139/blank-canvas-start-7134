const dailyActivities = [
  "Arrival, check-in, and snacks",
  "Mentorship, supervised free time, and informal support",
  "Strength & conditioning and boxing & fitness training",
  "Team meeting, reflection, and accountability",
  "Daily duties to reinforce ownership, teamwork, and respect",
];

const DailyRhythmSection = () => {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground mb-6">
              Our Daily Rhythm
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Consistency is the foundation of everything we do. No Limits Academy operates Monday through Friday, 2:30–8:30 PM, providing a safe, structured, and reliable environment for youth during critical after-school and evening hours.
            </p>
          </div>

          {/* Daily activities */}
          <div className="bg-secondary rounded-2xl p-8 md:p-12">
            <h3 className="text-xl md:text-2xl font-bold text-secondary-foreground mb-6">
              A typical day includes:
            </h3>
            <ul className="space-y-4">
              {dailyActivities.map((activity, index) => (
                <li 
                  key={index} 
                  className="flex items-start gap-4 text-lg text-secondary-foreground/80"
                >
                  <span className="w-2 h-2 rounded-full bg-primary mt-2.5 flex-shrink-0" />
                  <span>{activity}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DailyRhythmSection;
