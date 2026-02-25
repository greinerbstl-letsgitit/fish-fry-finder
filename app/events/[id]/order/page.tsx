import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { OrderForm } from "./OrderForm";

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function getEventById(id: string) {
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
      locations (id, name, city, state, address, zip)
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const location = Array.isArray(data.locations) ? data.locations[0] : data.locations;
  return { ...data, location };
}

async function getMenuItems(eventId: string) {
  console.log("[order page] getMenuItems called with eventId:", eventId);

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, description, price, category, prep_time_minutes, dietary_tags")
    .eq("event_id", eventId)
    .eq("available", true)
    .or("blocked.eq.false,blocked.is.null")
    .order("category")
    .order("name");

  if (error) {
    console.error("[order page] getMenuItems error:", error.message, error);
    return [];
  }

  console.log("[order page] getMenuItems result: count =", data?.length ?? 0, "items:", data?.[0] ? "first item keys: " + Object.keys(data[0]).join(", ") : "no items");
  return data || [];
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [event, menuItems] = await Promise.all([
    getEventById(id),
    getMenuItems(id),
  ]);

  if (!event) notFound();

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const isToday = event.event_date === today;

  const [startHour, startMin] = (event.start_time || '00:00').split(':').map(Number);
  const [endHour, endMin] = (event.end_time || '23:59').split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const isOpen = isToday && currentMinutes >= startMinutes && currentMinutes <= endMinutes;

  const loc = event.location as { name?: string } | null;
  const locationName = loc?.name ?? "Unknown";

  const menuItemsWithNumericPrice = menuItems.map((item) => ({
    ...item,
    price: typeof item.price === "string" ? parseFloat(item.price) : item.price,
  }));

  return (
    <div className="min-h-screen bg-[#1e3a5f]">
      <header className="border-b border-[#2d5a87] bg-[#16324a] px-4 py-6 text-white shadow-lg sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href={`/events/${id}`}
            className="inline-flex items-center text-sm font-medium text-amber-200 hover:text-amber-100"
          >
            ← Back to menu
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Order from {locationName}
          </h1>
          <p className="mt-2 text-blue-100">
            {formatEventDate(event.event_date)}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <OrderForm
          eventId={id}
          locationName={locationName}
          event={{
            event_date: event.event_date,
            start_time: event.start_time,
            end_time: event.end_time,
            dine_in: event.dine_in,
            pickup: event.pickup,
          }}
          menuItems={menuItemsWithNumericPrice}
        />
      </main>
    </div>
  );
}
