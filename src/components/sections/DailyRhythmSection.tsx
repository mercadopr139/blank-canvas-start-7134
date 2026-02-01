const seniorScheduleBlocks = [
  {
    time: "2:30pm–5:30pm",
    title: "Open Gym & Arrival Window",
    description: "Youth arrive after school for supervised free time, snacks, mentorship, and formal & informal support.",
  },
  {
    time: "5:15pm",
    title: "Team Roll Call",
    description: "Youth are welcomed, attendance is taken, the day's schedule and expectations are reviewed, and daily reflection is completed together as a group.",
  },
  {
    time: "5:30pm–7:00pm",
    title: "Senior Boxing Program",
    description: "A high-expectation training block that includes strength & conditioning, boxing fundamentals, spiritual growth, and the discipline required to show up, work as a team, and follow through on personal and team goals.",
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

const juniorScheduleBlocks = [
  {
    time: "5:15pm",
    title: "Junior Roll Call & Welcome",
    description: "A brief team meeting to greet youth, set expectations, and transition into the evening together.",
  },
  {
    time: "5:30pm–6:00pm",
    title: "Boxing Training",
    description: "Foundational boxing instruction focused on movement, coordination, and confidence, with Senior Boxing youth assisting as part of their service and leadership responsibilities.",
  },
  {
    time: "6:00pm–7:00pm",
    title: "Reflection & Learning",
    description: "Age-appropriate reflection and values-based discussion, followed by educational programming including Delta Dental's Smile Lab Program and NJ4S Lil' Champs Program.",
    optional: true,
  },
  {
    time: "7:00pm–7:15pm",
    title: "Dinner & Dismissal",
    description: "Youth share a sit-down meal before dismissal. Junior Boxing emphasizes life skills such as hygiene, responsibility, and being good stewards of their community.",
    optional: true,
  },
];

type ScheduleBlock = {
  time: string;
  title: string;
  description: string;
  optional?: boolean;
};

const ScheduleBlockComponent = ({ blocks }: { blocks: ScheduleBlock[] }) => (
  <div className="space-y-4">
    {blocks.map((block, index) => (
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
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg md:text-xl font-bold text-secondary-foreground">
                {block.title}
              </h3>
              {block.optional && (
                <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  Optional
                </span>
              )}
            </div>
            <p className="text-secondary-foreground/80 leading-relaxed">
              {block.description}
            </p>
          </div>
        </div>
      </div>
    ))}
  </div>
);

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
          </div>

          {/* Senior Boxing Schedule */}
          <div className="mb-16">
            <div className="text-center mb-8">
            <p className="text-xl md:text-2xl font-semibold text-primary mb-1">
              Senior Boxing – Typical Day (Ages 11–19)
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Includes Grit & Grace Program
            </p>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                No Limits Academy operates Monday through Friday, 2:30pm–8:30pm. Senior Boxing youth are permitted to arrive as early as 2:30pm for supervised open gym and structured after-school support.
              </p>
            </div>
            <ScheduleBlockComponent blocks={seniorScheduleBlocks} />
          </div>

          {/* Junior Boxing Schedule */}
          <div>
            <div className="text-center mb-8">
              <p className="text-xl md:text-2xl font-semibold text-primary mb-4">
                Junior Boxing – Typical Day (Ages 7–10)
              </p>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                Junior Boxing follows a shortened, age-appropriate schedule designed to introduce structure, discipline, and community in a supportive environment. <span className="font-medium">Practice officially ends at 6:00pm</span>—extended programming and dinner are available for families who wish to stay.
              </p>
            </div>
            <ScheduleBlockComponent blocks={juniorScheduleBlocks} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default DailyRhythmSection;
