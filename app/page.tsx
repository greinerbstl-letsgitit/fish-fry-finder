import Link from "next/link";
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
      <header className="border-b border-[#2d5a87] bg-[#16324a] text-white shadow-lg">
        {/* Navbar */}
        <nav className="mx-auto max-w-4xl flex justify-end items-center gap-4 sm:gap-6 px-4 py-4 sm:px-6 lg:px-8 border-b border-[#2d5a87]/60">
          <Link
            href="/admin/login"
            className="text-sm font-medium text-white hover:text-amber-200 transition"
          >
            Sign In
          </Link>
          <Link
            href="/admin/signup"
            className="rounded-lg bg-[#c9a227] px-4 py-2 text-sm font-bold text-[#1e3a5f] shadow-md transition hover:bg-[#d4af37] hover:shadow-lg active:bg-[#b8941f]"
          >
            List Your Fish Fry
          </Link>
        </nav>
        {/* Hero */}
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 sm:py-12 text-center">
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
