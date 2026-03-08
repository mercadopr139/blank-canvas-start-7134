import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Users, Calendar, School, Utensils } from "lucide-react";
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

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-white">
                    <School className="w-4 h-4 text-[#bf0f3e]" /> By School District
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <PieChart>
                      <Pie
                        data={districtData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {districtData.map((_, index) => (
                          <Cell key={`district-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
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
