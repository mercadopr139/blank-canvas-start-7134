const scheduleBlocks = [
  {
    time: "2:30–5:00 PM",
    title: "Open Gym & Arrival Window",
    description: "Youth arrive after school for supervised free time, snacks, mentorship, informal support, and optional strength & conditioning.",
  },
  {
    time: "5:15 PM",
    title: "Team Roll Call",
    description: "Attendance, expectations, accountability, and daily focus are set as a group.",
  },
  {
    time: "5:30–7:00 PM",
    title: "Boxing & Fitness Training",
    description: "Structured training including strength & conditioning, boxing fundamentals, skill development, and conditioning. This is a high-expectation training block.",
  },
  {
    time: "7:00–7:30 PM",
    title: "Daily Duties & Reflection",
    description: "Youth rotate responsibilities to maintain a neat, clean, and orderly facility while reinforcing ownership, teamwork, and respect, followed by reflection.",
  },
  {
    time: "7:30–8:30 PM",
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
              No Limits Academy operates Monday through Friday, 2:30–8:30 PM. Senior Boxing youth are permitted to arrive as early as 2:30 PM for supervised open gym and structured after-school support.
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
