const scheduleBlocks = [
  {
    time: "2:30pm–5:30pm",
    title: "Open Gym & Arrival Window",
    description: "Youth arrive after school for supervised free time, snacks, mentorship, and formal & informal support.",
  },
  {
    time: "5:15pm",
    title: "Team Roll Call",
    description: "Attendance is taken, the schedule is reviewed, expectations are set, and daily reflection is completed as a group.",
  },
  {
    time: "5:30pm–7:00pm",
    title: "Senior Boxing Program",
    description: "A high-expectation training block that includes strength & conditioning, boxing fundamentals, skill development, conditioning, spiritual development, and the discipline to follow through.",
  },
  {
    time: "7:00pm–7:15pm",
    title: "Daily Duties",
    description: "Youth rotate responsibilities to ensure our facility remains neat, clean, & orderly—reinforcing ownership, teamwork, and respect.",
  },
  {
    time: "7:15pm–8:30pm",
    title: "Dinner",
    description: "Sit-down, family-style meals where youth break bread together & connect.",
  },
];

const DailyRhythmSection = () => {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-foreground mb-4">
              Daily Rhythm
            </h2>
            <p className="text-xl md:text-2xl font-semibold text-primary mb-6">
              Senior Boxing – Typical Day (Ages 11–19)
            </p>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              No Limits Academy operates Monday through Friday, 2:30pm–8:30pm. Senior Boxing youth are permitted to arrive as early as 2:30pm for supervised open gym and structured after-school support.
            </p>
          </div>

          {/* Schedule blocks */}
          <div className="space-y-4">
            {scheduleBlocks.map((block, index) => (
              <div 
                key={index}
                className="bg-secondary rounded-xl p-6 md:p-8"
              >
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="md:w-48 flex-shrink-0">
                    <span className="text-sm md:text-base font-bold text-primary">
                      {block.time}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl font-bold text-secondary-foreground mb-2">
                      {block.title}
                    </h3>
                    <p className="text-secondary-foreground/80 leading-relaxed">
                      {block.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DailyRhythmSection;
