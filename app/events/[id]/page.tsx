import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ShareMenu from "./ShareMenu";
import { Navbar } from "@/app/components/Navbar";

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

function formatPrice(price: number | string) {
  const n = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function getDietaryTagClasses(tag: string) {
  switch (tag) {
    case "Gluten Free":
      return "bg-green-100 text-green-800";
    case "Dairy Free":
      return "bg-blue-100 text-blue-800";
    case "Nut Free":
      return "bg-yellow-100 text-yellow-800";
    case "Vegetarian":
      return "bg-purple-100 text-purple-800";
    case "Vegan":
      return "bg-emerald-100 text-emerald-800";
    case "Spicy":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

const CATEGORY_ORDER = ["fish", "sides", "drinks", "desserts"];

function sortCategories(categories: string[]) {
  return [...categories].sort((a, b) => {
    const i = CATEGORY_ORDER.indexOf(a.toLowerCase());
    const j = CATEGORY_ORDER.indexOf(b.toLowerCase());
    if (i === -1 && j === -1) return a.localeCompare(b);
    if (i === -1) return 1;
    if (j === -1) return -1;
    return i - j;
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
      locations (id, name, city, state, address, zip, type)
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const location = Array.isArray(data.locations) ? data.locations[0] : data.locations;
  return { ...data, location };
}

async function getMenuItems(eventId: string) {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, description, price, category, dietary_tags")
    .eq("event_id", eventId)
    .eq("available", true)
    .order("category")
    .order("name");

  if (error) return [];
  return data || [];
}

export default async function EventPage({
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

  const loc = event.location as {
    name?: string;
    city?: string;
    state?: string;
    address?: string;
    zip?: string;
  } | null;

  const locationName = loc?.name ?? "Unknown";
  const address = loc?.address ?? "";
  const city = loc?.city ?? "";
  const state = loc?.state ?? "";
  const zip = loc?.zip ?? "";
  const cityStateZip = [city, state, zip].filter(Boolean).join(", ");

  const byCategory = menuItems.reduce<Record<string, typeof menuItems>>(
    (acc, item) => {
      const cat = item.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {}
  );
  const categories = sortCategories(Object.keys(byCategory));

  return (
    <div className="min-h-screen bg-[#1e3a5f]">
      {/* Back / Header */}
      <header className="border-b border-[#2d5a87] bg-[#16324a] text-white shadow-lg">
        <Navbar />
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-amber-200 hover:text-amber-100"
          >
            ← Back to events
          </Link>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {locationName}
            </h1>
            <ShareMenu locationName={locationName} />
          </div>
          {cityStateZip && (
            <p className="mt-1 text-blue-100">{cityStateZip}</p>
          )}
          {address && (
            <p className="mt-1 text-blue-100">{address}</p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Event date, time, badges */}
        <section className="rounded-2xl border border-[#2d5a87] bg-white p-5 shadow-lg sm:p-6">
          <p className="text-lg font-semibold text-[#1e3a5f]">
            {formatEventDate(event.event_date)}
          </p>
          <p className="mt-1 text-gray-600">
            {formatTime(event.start_time)} – {formatTime(event.end_time)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {event.dine_in && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                Dine-in
              </span>
            )}
            {event.pickup && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                Pickup
              </span>
            )}
          </div>
        </section>

        {/* Menu by category */}
        <section className="mt-8">
          <h2 className="text-xl font-bold text-white">Menu</h2>
          {categories.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-[#2d5a87] bg-white/5 px-6 py-8 text-center text-blue-100">
              No menu items available at this time.
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              {categories.map((category) => (
                <div
                  key={category}
                  className="overflow-hidden rounded-2xl border border-[#2d5a87] bg-white shadow-lg"
                >
                  <h3 className="border-b border-gray-100 bg-gray-50 px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#1e3a5f] sm:px-6">
                    {category}
                  </h3>
                  <ul className="divide-y divide-gray-100">
                    {byCategory[category].map((item) => (
                      <li key={item.id} className="px-5 py-4 sm:px-6">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900">
                              {item.name}
                            </p>
                            {item.description && (
                              <p className="mt-1 text-sm text-gray-600">
                                {item.description}
                              </p>
                            )}
                            {Array.isArray(item.dietary_tags) &&
                              item.dietary_tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {item.dietary_tags.map((tag: string) => (
                                    <span
                                      key={tag}
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getDietaryTagClasses(
                                        tag
                                      )}`}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                          </div>
                          <p className="mt-1 shrink-0 font-semibold text-[#1e3a5f] sm:mt-0">
                            {formatPrice(item.price)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Order Now CTA */}
        <div className="mt-10 text-center">
          <Link
            href={`/events/${id}/order`}
            className="inline-flex items-center justify-center rounded-xl bg-[#c9a227] px-8 py-4 text-lg font-bold uppercase tracking-wide text-[#1e3a5f] shadow-md transition hover:bg-[#d4af37] hover:shadow-lg active:bg-[#b8941f]"
          >
            Order Now
          </Link>
        </div>
      </main>
    </div>
  );
}
