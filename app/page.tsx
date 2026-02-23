import Link from "next/link";
import { supabase } from "@/lib/supabase";

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return "—";
  const [hours, minutes] = timeStr.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${h}${minutes ? `:${minutes.toString().padStart(2, "0")}` : ":00"} ${period}`;
}

async function getUpcomingEvents() {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("events")
    .select(
      `
      id,
      event_date,
      start_time,
      end_time,
      dine_in,
      pickup,
      locations (name, city, state)
    `
    )
    .eq("active", true)
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Error fetching events:", error);
    return [];
  }

  return (data || []).map((row: { locations: unknown }) => ({
    ...row,
    location: Array.isArray(row.locations) ? row.locations[0] : row.locations,
  }));
}

export default async function Home() {
  const events = await getUpcomingEvents();

  return (
    <div className="min-h-screen bg-[#1e3a5f]">
      {/* Header */}
      <header className="border-b border-[#2d5a87] bg-[#16324a] px-4 py-8 text-white shadow-lg sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow sm:text-4xl lg:text-5xl">
            Find a Fish Fry & Order Online
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-blue-100">
            Skip the line — browse the menu and place your order before you
            arrive. Pay in person when you pick up.
          </p>
          <p className="mt-6 inline-block rounded-full bg-white/10 px-4 py-2 text-base font-medium text-amber-200">
            Supporting Catholic and Christian communities every Friday.
          </p>
        </div>
      </header>

      {/* Event cards */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {events.length === 0 ? (
          <div className="rounded-2xl border border-[#2d5a87] bg-white/5 px-6 py-12 text-center text-blue-100">
            <p className="text-lg">
              No upcoming fish fry events at the moment. Check back soon!
            </p>
          </div>
        ) : (
          <ul className="space-y-5">
            {events.map(
              (event: any) => {
                
                const loc = event.location;
                const locationName = loc && "name" in loc ? loc.name : "Unknown";
                const city = loc && "city" in loc ? loc.city : "";
                const state = loc && "state" in loc ? loc.state : "";
                const cityState = [city, state].filter(Boolean).join(", ");

                return (
                  <li
                    key={event.id}
                    className="overflow-hidden rounded-2xl border border-[#2d5a87] bg-white shadow-lg transition hover:shadow-xl"
                  >
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h2 className="text-xl font-bold text-[#1e3a5f]">
                            {locationName}
                          </h2>
                          {cityState && (
                            <p className="mt-1 text-[#2d5a87]">{cityState}</p>
                          )}
                          <p className="mt-2 text-sm font-medium text-gray-700">
                            {formatEventDate(event.event_date)}
                          </p>
                          <p className="mt-1 text-sm text-gray-600">
                            {formatTime(event.start_time)} –{" "}
                            {formatTime(event.end_time)}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {event.dine_in && (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                                Dine-in
                              </span>
                            )}
                            {event.pickup && (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                                Pickup
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
                          <Link
                            href={`/events/${event.id}/order`}
                            className="inline-flex items-center justify-center rounded-xl bg-[#c9a227] px-6 py-3.5 text-base font-bold uppercase tracking-wide text-[#1e3a5f] shadow-md transition hover:bg-[#d4af37] hover:shadow-lg active:bg-[#b8941f]"
                          >
                            Order Now
                          </Link>
                          <Link
                            href={`/events/${event.id}`}
                            className="text-center text-sm font-medium text-[#2d5a87] underline decoration-[#2d5a87]/50 underline-offset-2 hover:text-[#1e3a5f] sm:text-right"
                          >
                            View Menu
                          </Link>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              }
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
