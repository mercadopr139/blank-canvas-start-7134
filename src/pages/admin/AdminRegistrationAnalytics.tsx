import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Users, Calendar, School, Utensils, TrendingDown, DollarSign, Home } from "lucide-react";
import { differenceInYears, parseISO, subDays, isAfter } from "date-fns";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";

const COLORS = [
  "#bf0f3e",
  "#e84a6f",
  "#ff7f9e",
  "#f4a3b8",
  "#d4d4d4",
  "#8a8a8a",
];


const AdminRegistrationAnalytics = () => {
  const navigate = useNavigate();
  const goBack = () => navigate("/admin/operations");

  const { data: registrations, isLoading } = useQuery({
    queryKey: ["youth-registrations-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("*")
        .order("submission_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const now = new Date();
  const last7Days = subDays(now, 7);
  const last30Days = subDays(now, 30);
  const last90Days = subDays(now, 90);

  const countInPeriod = (days: Date) =>
    registrations?.filter((r) => isAfter(parseISO(r.submission_date), days)).length || 0;

  const programCounts = registrations?.reduce((acc, r) => {
    const program = r.child_boxing_program || "Unknown";
    acc[program] = (acc[program] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const programData = Object.entries(programCounts || {}).map(([name, count]) => ({
    name: name.replace("Boxing ", "").replace(" (Ages", "\n(Ages"),
    fullName: name,
    count,
  }));

  const ageBuckets = { "7-9": 0, "10-12": 0, "13-15": 0, "16-17": 0, "18-19": 0 };
  registrations?.forEach((r) => {
    const age = differenceInYears(new Date(), parseISO(r.child_date_of_birth));
    if (age >= 7 && age <= 9) ageBuckets["7-9"]++;
    else if (age >= 10 && age <= 12) ageBuckets["10-12"]++;
    else if (age >= 13 && age <= 15) ageBuckets["13-15"]++;
    else if (age >= 16 && age <= 17) ageBuckets["16-17"]++;
    else if (age >= 18 && age <= 19) ageBuckets["18-19"]++;
  });
  const ageData = Object.entries(ageBuckets).map(([age, count]) => ({ age, count }));

  const districtCounts = registrations?.reduce((acc, r) => {
    const district = r.child_school_district || "Unknown";
    acc[district] = (acc[district] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const districtData = Object.entries(districtCounts || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const lunchCounts = registrations?.reduce((acc, r) => {
    const status = r.free_or_reduced_lunch;
    if (status === "Yes" || status === "No") {
      acc[status] = (acc[status] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const lunchTotal = Object.values(lunchCounts || {}).reduce((s, v) => s + v, 0);
  const lunchData = Object.entries(lunchCounts || {}).map(([name, value]) => ({ name, value }));

  /* ───── RACE / ETHNICITY ───── */
  const raceCounts = registrations?.reduce((acc, r) => {
    const race = r.child_race_ethnicity;
    if (race) acc[race] = (acc[race] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  const raceTotal = Object.values(raceCounts).reduce((s, n) => s + n, 0);
  const raceSorted = Object.entries(raceCounts).sort((a, b) => b[1] - a[1]);
  const whiteCount = raceCounts["White"] || 0;
  const minorityCount = raceTotal - whiteCount;
  const minorityPct = raceTotal > 0 ? Math.round((minorityCount / raceTotal) * 100) : 0;

  /* ───── BELOW FEDERAL POVERTY LINE ───── */
  // Derived from the Free/Reduced Lunch answer, since F/R lunch eligibility is
  // federally defined around the poverty guidelines and is the metric schools,
  // CSBG, and most federal youth grants actually use.
  let belowFPL = 0;
  let fplEligible = 0;
  registrations?.forEach((r) => {
    const answer = r.free_or_reduced_lunch;
    if (answer !== "Yes" && answer !== "No") return;
    fplEligible++;
    if (answer === "Yes") belowFPL++;
  });
  const belowFPLPct = fplEligible > 0 ? Math.round((belowFPL / fplEligible) * 100) : 0;

  /* ───── ADULTS IN HOUSEHOLD ───── */
  const adultBuckets = ["1", "2", "3", "4+"];
  const adultCounts: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4+": 0 };
  let adultSum = 0;
  let adultRespondents = 0;
  registrations?.forEach((r) => {
    const n = r.adults_in_household;
    if (typeof n !== "number" || n < 1) return;
    adultRespondents++;
    adultSum += n;
    const bucket = n >= 4 ? "4+" : String(n);
    adultCounts[bucket] = (adultCounts[bucket] || 0) + 1;
  });
  const adultData = adultBuckets
    .map((name) => ({ name, count: adultCounts[name] }))
    .filter((d) => d.count > 0);
  const avgAdults = adultRespondents > 0 ? (adultSum / adultRespondents).toFixed(1) : "—";
  const singleAdultCount = adultCounts["1"] || 0;
  const singleAdultPct = adultRespondents > 0 ? Math.round((singleAdultCount / adultRespondents) * 100) : 0;

  /* ───── GENDER ───── */
  const sexCounts = registrations?.reduce((acc, r) => {
    const s = r.child_sex;
    if (s) acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  const sexTotal = (sexCounts["Male"] || 0) + (sexCounts["Female"] || 0);

  /* ───── HOUSEHOLD INCOME BREAKDOWN ───── */
  const incomeCounts = registrations?.reduce((acc, r) => {
    const inc = r.household_income_range;
    if (inc) acc[inc] = (acc[inc] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  // Normalize duplicate "Under / Less than" brackets into a single set of ordered buckets
  const incomeOrder = [
    "Under $25,000",
    "$25,000 - $49,999",
    "$50,000 - $74,999",
    "$75,000 - $99,999",
    "$100,000 - $149,999",
    "$150,000 or more",
  ];
  const mergedIncome: Record<string, number> = {};
  incomeOrder.forEach((k) => { mergedIncome[k] = 0; });
  Object.entries(incomeCounts).forEach(([k, v]) => {
    if (mergedIncome[k] !== undefined) { mergedIncome[k] += v; return; }
    // Map legacy "Less than" values into the merged buckets
    if (k === "Less than $25,000") mergedIncome["Under $25,000"] += v;
    else if (k === "Less than $35,000" || k === "Less than $45,000" || k === "$25,000 - $49,999") mergedIncome["$25,000 - $49,999"] += v;
    else if (k === "Less than $65,000") mergedIncome["$50,000 - $74,999"] += v;
    else if (k === "Less than $80,000") mergedIncome["$75,000 - $99,999"] += v;
    else if (k === "Greater than $80,001") mergedIncome["$100,000 - $149,999"] += v;
  });
  const incomeData = incomeOrder
    .map((name) => ({ name, count: mergedIncome[name] }))
    .filter((d) => d.count > 0);
  const incomeTotal = incomeData.reduce((s, d) => s + d.count, 0);

  /* ───── TOP DISTRICT (for headline row) ───── */
  const topDistrict = districtData[0];
  const topDistrictPct = registrations && registrations.length > 0 && topDistrict
    ? Math.round((topDistrict.count / registrations.length) * 100)
    : 0;

  const chartConfig = {
    count: { label: "Count", color: "#bf0f3e" },
    value: { label: "Count", color: "#bf0f3e" },
  };

  return (
    <div className="bg-black text-white">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-base font-semibold text-white">Registration Analytics</h2>
        <p className="text-xs text-white/50">Insights from youth registrations</p>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="text-center py-12 text-white/50">Loading analytics...</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Total"
                value={registrations?.length || 0}
                subtitle="All time"
                icon={<Users className="w-5 h-5" />}
              />
              <StatCard
                title="Last 7 Days"
                value={countInPeriod(last7Days)}
                subtitle="New registrations"
                icon={<Calendar className="w-5 h-5" />}
              />
              <StatCard
                title="Last 30 Days"
                value={countInPeriod(last30Days)}
                subtitle="New registrations"
                icon={<Calendar className="w-5 h-5" />}
              />
              <StatCard
                title="Last 90 Days"
                value={countInPeriod(last90Days)}
                subtitle="New registrations"
                icon={<Calendar className="w-5 h-5" />}
              />
            </div>

            {/* ═══════════ WHO WE SERVE (donor headline row) ═══════════ */}
            <div>
              <h3 className="text-sm font-semibold text-white/80 mb-3 tracking-wide uppercase">Who We Serve</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-4">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Distinct Youth</p>
                    <p className="text-3xl font-bold text-white">{registrations?.length || 0}</p>
                    <p className="text-xs text-white/40 mt-0.5">total registered</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-4">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Minority Youth</p>
                    <p className="text-3xl font-bold text-[#bf0f3e]">{minorityPct}%</p>
                    <p className="text-xs text-white/40 mt-0.5">{minorityCount} of {raceTotal} youth</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-4">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" /> Below Federal Poverty Line
                    </p>
                    <p className="text-3xl font-bold text-amber-400">{belowFPLPct}%</p>
                    <p className="text-xs text-white/40 mt-0.5">{belowFPL} of {fplEligible} youth</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-4">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1">
                      <School className="w-3 h-3" /> Top District
                    </p>
                    {topDistrict ? (
                      <>
                        <p className="text-lg font-bold text-white truncate">{topDistrict.name}</p>
                        <p className="text-xs text-white/40 mt-0.5">{topDistrictPct}% · {topDistrict.count} youth</p>
                      </>
                    ) : (
                      <p className="text-white/30">—</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Race / Ethnicity + Minority summary */}
            {raceTotal > 0 && (
              <div className="flex flex-col lg:flex-row gap-4">
                <Card className="bg-white/5 border-white/10 flex-1 max-w-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#bf0f3e]" /> Race / Ethnicity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {raceSorted.map(([race, count]) => {
                        const pctVal = Math.round((count / raceTotal) * 100);
                        return (
                          <div key={race} className="flex items-center gap-3">
                            <span className="text-xs text-white/70 w-52 flex-shrink-0 truncate" title={race}>{race}</span>
                            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden min-w-0">
                              <div className="h-full bg-[#bf0f3e] rounded-full" style={{ width: `${pctVal}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-white w-10 text-right tabular-nums">{pctVal}%</span>
                            <span className="text-[10px] text-white/40 w-14 text-right tabular-nums">{count} youth</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-white/30 mt-3 text-right">{raceTotal} total youth</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10 w-full lg:w-64">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-white">Minority</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="text-center flex-1">
                        <p className="text-3xl font-bold text-[#bf0f3e]">{minorityPct}%</p>
                        <p className="text-[10px] text-white/60 mt-0.5">Minority</p>
                        <p className="text-[10px] text-white/30">{minorityCount} youth</p>
                      </div>
                      <div className="w-px h-12 bg-white/10" />
                      <div className="text-center flex-1">
                        <p className="text-3xl font-bold text-white/70">{raceTotal > 0 ? Math.round((whiteCount / raceTotal) * 100) : 0}%</p>
                        <p className="text-[10px] text-white/60 mt-0.5">White</p>
                        <p className="text-[10px] text-white/30">{whiteCount} youth</p>
                      </div>
                    </div>
                    <div className="border-t border-white/10 mt-3 pt-1.5 text-center">
                      <p className="text-[10px] text-white/40">
                        <span className="font-semibold text-white/70">{raceTotal}</span> total youth
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-base text-white">By Program</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <BarChart data={programData} layout="vertical">
                      <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.5)" }} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.7)" }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="#bf0f3e" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-base text-white">Age Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <BarChart data={ageData}>
                      <XAxis dataKey="age" tick={{ fill: "rgba(255,255,255,0.7)" }} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.5)" }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="#bf0f3e" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* School District - full width */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-white">
                  <School className="w-4 h-4 text-[#bf0f3e]" /> By School District
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} style={{ height: `${Math.max(300, districtData.length * 36)}px` }}>
                  <BarChart data={districtData} layout="vertical" margin={{ left: 8, right: 40 }}>
                    <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={200}
                      tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="#bf0f3e" radius={4}>
                      {districtData.map((_, index) => (
                        <Cell key={`district-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Household Income + Free/Reduced Lunch */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-white">
                    <DollarSign className="w-4 h-4 text-[#bf0f3e]" /> Household Income
                    <span className="text-xs text-white/40 font-normal ml-2">({incomeTotal} reported)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {incomeData.map((d) => {
                      const pctVal = incomeTotal > 0 ? Math.round((d.count / incomeTotal) * 100) : 0;
                      return (
                        <div key={d.name} className="flex items-center gap-3">
                          <span className="text-xs text-white/70 w-40 flex-shrink-0 truncate">{d.name}</span>
                          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden min-w-0">
                            <div className="h-full bg-[#bf0f3e] rounded-full" style={{ width: `${pctVal}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-white w-10 text-right tabular-nums">{pctVal}%</span>
                          <span className="text-[10px] text-white/40 w-14 text-right tabular-nums">{d.count} hh</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-white">
                    <Utensils className="w-4 h-4 text-[#bf0f3e]" /> Free/Reduced Lunch
                    <span className="text-xs text-white/40 font-normal ml-2">({lunchTotal} responded)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <PieChart>
                      <Pie
                        data={lunchData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {lunchData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            {/* Gender + Adults in Household */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-white">Boy / Girl Ratio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="text-center flex-1">
                      <p className="text-3xl font-bold text-blue-400">{sexCounts["Male"] || 0}</p>
                      <p className="text-[10px] text-white/60 mt-0.5">Boys</p>
                      <p className="text-[10px] text-white/30">{sexTotal > 0 ? Math.round(((sexCounts["Male"] || 0) / sexTotal) * 100) : 0}%</p>
                    </div>
                    <div className="w-px h-12 bg-white/10" />
                    <div className="text-center flex-1">
                      <p className="text-3xl font-bold text-pink-400">{sexCounts["Female"] || 0}</p>
                      <p className="text-[10px] text-white/60 mt-0.5">Girls</p>
                      <p className="text-[10px] text-white/30">{sexTotal > 0 ? Math.round(((sexCounts["Female"] || 0) / sexTotal) * 100) : 0}%</p>
                    </div>
                  </div>
                  <div className="border-t border-white/10 mt-3 pt-1.5 text-center">
                    <p className="text-[10px] text-white/40">{sexTotal} total youth</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-white">
                    <Home className="w-4 h-4 text-[#bf0f3e]" /> Adults in Household
                    <span className="text-xs text-white/40 font-normal ml-2">({adultRespondents} reported)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-center flex-1">
                      <p className="text-3xl font-bold text-amber-400">{singleAdultPct}%</p>
                      <p className="text-[10px] text-white/60 mt-0.5">Single-Adult Home</p>
                      <p className="text-[10px] text-white/30">{singleAdultCount} of {adultRespondents}</p>
                    </div>
                    <div className="w-px h-12 bg-white/10" />
                    <div className="text-center flex-1">
                      <p className="text-3xl font-bold text-white">{avgAdults}</p>
                      <p className="text-[10px] text-white/60 mt-0.5">Avg Adults / Home</p>
                      <p className="text-[10px] text-white/30">across {adultRespondents} homes</p>
                    </div>
                  </div>
                  <div className="border-t border-white/10 pt-3 space-y-2">
                    {adultData.map((d) => {
                      const pctVal = adultRespondents > 0 ? Math.round((d.count / adultRespondents) * 100) : 0;
                      return (
                        <div key={d.name} className="flex items-center gap-3">
                          <span className="text-xs text-white/70 w-16 flex-shrink-0">{d.name} {d.name === "1" ? "adult" : "adults"}</span>
                          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden min-w-0">
                            <div className="h-full bg-[#bf0f3e] rounded-full" style={{ width: `${pctVal}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-white w-10 text-right tabular-nums">{pctVal}%</span>
                          <span className="text-[10px] text-white/40 w-14 text-right tabular-nums">{d.count} hh</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const StatCard = ({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
}) => (
  <Card className="bg-white/5 border-white/10">
    <CardContent className="pt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white/50">{title}</span>
        <span className="text-[#bf0f3e]">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-xs text-white/50">{subtitle}</div>
    </CardContent>
  </Card>
);

export default AdminRegistrationAnalytics;
