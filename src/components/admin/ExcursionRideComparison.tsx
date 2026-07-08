// A side-by-side "Ride There | Ride Home" table for an excursion, so coaches
// and admins can see at a glance who switched vehicles for the trip home.
// Used on the Coach Mode trip screen and in the admin Edit Excursion report.

type Vehicle = { id: string; name: string };

type RosterYouth = {
  registration_id: string;
  child_first_name: string;
  child_last_name: string;
  vehicle_id: string | null;
  return_vehicle_id: string | null;
};

type Personnel = { id: string; name: string; vehicle_id: string | null };

export default function ExcursionRideComparison({
  vehicles,
  youth,
  personnel = [],
  returnPlan,
}: {
  vehicles: Vehicle[];
  youth: RosterYouth[];
  personnel?: Personnel[];
  returnPlan: string | null;
}) {
  const nameFor = (id: string | null) => vehicles.find((v) => v.id === id)?.name ?? null;

  // A youth's ride home: their own return vehicle when the coach rearranged,
  // the same vehicle they came in when they kept it the same, and unknown
  // when no ride-home was ever recorded.
  const homeVehicleId = (y: RosterYouth): string | null => {
    if (returnPlan === "custom") return y.return_vehicle_id;
    if (returnPlan === "same") return y.vehicle_id;
    return null;
  };

  const anyChanged =
    returnPlan === "custom" &&
    youth.some((y) => (y.return_vehicle_id ?? null) !== (y.vehicle_id ?? null));

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[420px]">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 px-2 pb-1.5 text-[10px] uppercase tracking-wider text-white/40 font-semibold">
            <span>Youth</span>
            <span>Ride There</span>
            <span>Ride Home</span>
          </div>
          <div className="space-y-1">
            {youth.map((y) => {
              const there = nameFor(y.vehicle_id) ?? "—";
              const homeId = homeVehicleId(y);
              const home = returnPlan ? (nameFor(homeId) ?? "Not set") : "—";
              const changed =
                returnPlan === "custom" && (y.return_vehicle_id ?? null) !== (y.vehicle_id ?? null);
              return (
                <div
                  key={y.registration_id}
                  className={`grid grid-cols-[1.4fr_1fr_1fr] gap-2 items-center px-2 py-1.5 rounded-md text-sm ${
                    changed ? "bg-amber-500/10 border border-amber-400/30" : "border border-transparent"
                  }`}
                >
                  <span className="font-semibold truncate">
                    {y.child_first_name} {y.child_last_name}
                  </span>
                  <span className="text-white/70 truncate">{there}</span>
                  <span className={`truncate flex items-center gap-1 ${changed ? "text-amber-200 font-semibold" : "text-white/70"}`}>
                    {home}
                    {changed && <span aria-label="switched vehicles" title="Switched vehicles for the ride home">↔</span>}
                  </span>
                </div>
              );
            })}
            {personnel.map((p) => {
              const van = nameFor(p.vehicle_id) ?? "Driving separately";
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 items-center px-2 py-1.5 rounded-md text-sm border border-transparent"
                >
                  <span className="font-semibold truncate flex items-center gap-1.5">
                    {p.name}
                    <span className="text-[9px] uppercase tracking-wider text-sky-300/90 bg-sky-500/10 border border-sky-400/20 rounded px-1 py-0.5">Coach/Volunteer</span>
                  </span>
                  <span className="text-white/70 truncate">{van}</span>
                  <span className="text-white/70 truncate">{van}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {anyChanged && (
        <p className="text-[11px] text-amber-200/70 mt-2 px-2 flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/40 border border-amber-400/40" />
          Highlighted = switched vehicles for the ride home
        </p>
      )}
    </div>
  );
}
