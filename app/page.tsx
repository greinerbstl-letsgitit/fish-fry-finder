import { supabase } from "@/lib/supabase";
import {
  EventListWithFilters,
  type EventWithLocation,
} from "@/app/components/EventListWithFilters";

async function getUpcomingEvents(): Promise<EventWithLocation[]> {
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
      locations (name, city, state, zip, lat, lng)
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

  return (data || []).map((row: { locations: unknown; [k: string]: unknown }) => {
    const { locations, ...rest } = row;
    const location = Array.isArray(locations) ? locations[0] : locations;
    return { ...rest, location } as EventWithLocation;
  });
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

      <EventListWithFilters events={events} />
    </div>
  );
}
