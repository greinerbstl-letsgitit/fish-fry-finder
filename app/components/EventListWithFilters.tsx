"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  citiesMatch,
  fetchCityCoords,
  fetchZipCoords,
  haversineMiles,
} from "@/lib/geo";

export type EventWithLocation = {
  id: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  dine_in: boolean;
  pickup: boolean;
  location: {
    name?: string;
    city?: string;
    state?: string;
    zip?: string;
    lat?: number | null;
    lng?: number | null;
  } | null;
};

const WITHIN_MILES_OPTIONS = [
  { value: "", label: "Show all" },
  { value: "10", label: "Within 10 mi" },
  { value: "25", label: "Within 25 mi" },
  { value: "50", label: "Within 50 mi" },
  { value: "100", label: "Within 100 mi" },
] as const;

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

function getLocationCity(event: EventWithLocation): string {
  const loc = event.location;
  return loc && "city" in loc && loc.city ? String(loc.city).trim() : "";
}

function getLocationState(event: EventWithLocation): string {
  const loc = event.location;
  return loc && "state" in loc && loc.state ? String(loc.state).trim() : "";
}

function getLocationCoords(event: EventWithLocation): {
  lat: number;
  lng: number;
} | null {
  const loc = event.location;
  if (!loc || !("lat" in loc) || !("lng" in loc)) return null;
  const lat = loc.lat;
  const lng = loc.lng;
  if (lat == null || lng == null || typeof lat !== "number" || typeof lng !== "number")
    return null;
  return { lat, lng };
}

export function EventListWithFilters({ events }: { events: EventWithLocation[] }) {
  const [cityQuery, setCityQuery] = useState("");
  const [zipQuery, setZipQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [withinMiles, setWithinMiles] = useState<string>("");
  const [originCoords, setOriginCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const uniqueDates = useMemo(() => {
    const set = new Set(events.map((e) => e.event_date));
    return Array.from(set).sort();
  }, [events]);

  // Resolve origin: zip takes precedence, then city (with state from matching events)
  const resolveOrigin = useCallback(async () => {
    const zipTrimmed = zipQuery.trim().replace(/\D/g, "");
    const cityTrimmed = cityQuery.trim();

    if (zipTrimmed.length >= 5) {
      setGeoLoading(true);
      setGeoError(null);
      const coords = await fetchZipCoords(zipTrimmed);
      setOriginCoords(coords);
      if (!coords) setGeoError("Could not find that zip code.");
      setGeoLoading(false);
      return;
    }

    if (cityTrimmed) {
      // Parse "City, ST" or "City, State" format
      const commaIdx = cityTrimmed.indexOf(",");
      let city = cityTrimmed;
      let state = "";
      if (commaIdx > 0) {
        city = cityTrimmed.slice(0, commaIdx).trim();
        state = cityTrimmed.slice(commaIdx + 1).trim();
      }
      // Fallback: get state from first matching event
      if (!state) {
        const matchingEvent = events.find((e) =>
          citiesMatch(getLocationCity(e), city)
        );
        state = matchingEvent ? getLocationState(matchingEvent) : "";
      }
      if (!state) {
        setOriginCoords(null);
        setGeoError("Add state (e.g. Saint Louis, MO)");
        setGeoLoading(false);
        return;
      }
      setGeoLoading(true);
      setGeoError(null);
      const coords = await fetchCityCoords(city, state);
      setOriginCoords(coords);
      if (!coords) setGeoError("Could not find that city.");
      setGeoLoading(false);
      return;
    }

    setOriginCoords(null);
    setGeoError(null);
  }, [zipQuery, cityQuery, events]);

  useEffect(() => {
    const zipTrimmed = zipQuery.trim().replace(/\D/g, "");
    const cityTrimmed = cityQuery.trim();

    if (!zipTrimmed && !cityTrimmed) {
      setOriginCoords(null);
      setGeoError(null);
      return;
    }

    const t = setTimeout(resolveOrigin, 400);
    return () => clearTimeout(t);
  }, [zipQuery, cityQuery, resolveOrigin]);

  const { filteredAndSortedEvents, distances } = useMemo(() => {
    let list = events;

    // Date filter
    if (dateFilter) {
      list = list.filter((e) => e.event_date === dateFilter);
    }

    const origin = originCoords;
    const withinMilesNum = withinMiles ? parseInt(withinMiles, 10) : null;

    // Compute distances when we have origin
    const distMap = new Map<string, number>();
    if (origin) {
      for (const event of list) {
        const coords = getLocationCoords(event);
        if (coords) {
          const d = haversineMiles(
            origin.lat,
            origin.lng,
            coords.lat,
            coords.lng
          );
          distMap.set(event.id, d);
        } else {
          distMap.set(event.id, Infinity); // no coords = sort last
        }
      }
    }

    // Sort by distance when we have origin
    if (origin) {
      list = [...list].sort((a, b) => {
        const da = distMap.get(a.id) ?? Infinity;
        const db = distMap.get(b.id) ?? Infinity;
        return da - db;
      });
    }

    // Apply within X miles filter
    if (origin && withinMilesNum != null && withinMilesNum > 0) {
      list = list.filter((d) => (distMap.get(d.id) ?? Infinity) <= withinMilesNum);
    }

    return { filteredAndSortedEvents: list, distances: distMap };
  }, [events, dateFilter, originCoords, withinMiles]);

  const hasOrigin = !!zipQuery.trim() || !!cityQuery.trim();

  return (
    <>
      {/* Search and filter bar */}
      <div className="sticky top-0 z-10 border-b border-[#2d5a87] bg-[#16324a] px-4 py-4 shadow-md sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1 sm:min-w-[180px]">
              <label htmlFor="city-search" className="sr-only">
                Search by city
              </label>
              <input
                id="city-search"
                type="search"
                placeholder="City (e.g. Saint Louis)"
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                className="w-full rounded-xl border border-[#2d5a87] bg-white/10 px-4 py-3 text-white placeholder-blue-200/80 focus:border-[#c9a227] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/50 sm:py-2.5"
                aria-label="Search by city name"
              />
            </div>
            <div className="min-w-0 sm:w-[140px]">
              <label htmlFor="zip-search" className="sr-only">
                Search by zip code
              </label>
              <input
                id="zip-search"
                type="text"
                inputMode="numeric"
                placeholder="Zip code"
                value={zipQuery}
                onChange={(e) => setZipQuery(e.target.value.replace(/\D/g, "").slice(0, 5))}
                className="w-full rounded-xl border border-[#2d5a87] bg-white/10 px-4 py-3 text-white placeholder-blue-200/80 focus:border-[#c9a227] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/50 sm:py-2.5"
                aria-label="Search by zip code"
              />
            </div>
            <div className="flex-shrink-0 w-full sm:w-auto">
              <label htmlFor="date-filter" className="sr-only">
                Filter by date
              </label>
              <select
                id="date-filter"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-xl border border-[#2d5a87] bg-white/10 px-4 py-3 text-white focus:border-[#c9a227] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/50 sm:w-[220px] sm:py-2.5 [&>option]:bg-[#16324a] [&>option]:text-white"
                aria-label="Filter by date"
              >
                <option value="">All Upcoming</option>
                {uniqueDates.map((d) => (
                  <option key={d} value={d}>
                    {formatEventDate(d)}
                  </option>
                ))}
              </select>
            </div>
            {hasOrigin && (
              <div className="flex-shrink-0 w-full sm:w-auto">
                <label htmlFor="within-miles" className="sr-only">
                  Within distance
                </label>
                <select
                  id="within-miles"
                  value={withinMiles}
                  onChange={(e) => setWithinMiles(e.target.value)}
                  className="w-full rounded-xl border border-[#2d5a87] bg-white/10 px-4 py-3 text-white focus:border-[#c9a227] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/50 sm:w-[140px] sm:py-2.5 [&>option]:bg-[#16324a] [&>option]:text-white"
                  aria-label="Within distance"
                >
                  {WITHIN_MILES_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {geoLoading && (
            <p className="text-sm text-amber-200/90">Looking up location…</p>
          )}
          {geoError && !geoLoading && (
            <p className="text-sm text-amber-300/90">{geoError}</p>
          )}
          {filteredAndSortedEvents.length !== events.length && !geoError && (
            <p className="text-sm text-amber-200/90">
              Showing {filteredAndSortedEvents.length} of {events.length} events
            </p>
          )}
        </div>
      </div>

      {/* Event cards */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {filteredAndSortedEvents.length === 0 ? (
          <div className="rounded-2xl border border-[#2d5a87] bg-white/5 px-6 py-12 text-center text-blue-100">
            <p className="text-lg">
              {events.length === 0
                ? "No upcoming fish fry events at the moment. Check back soon!"
                : "No events match your filters. Try a different city, zip, or date."}
            </p>
          </div>
        ) : (
          <ul className="space-y-5">
            {filteredAndSortedEvents.map((event) => {
              const loc = event.location;
              const locationName =
                loc && "name" in loc ? loc.name : "Unknown";
              const city = loc && "city" in loc ? loc.city : "";
              const state = loc && "state" in loc ? loc.state : "";
              const cityState = [city, state].filter(Boolean).join(", ");
              const dist = originCoords ? distances.get(event.id) : null;
              const hasCoords = dist != null && dist !== Infinity;

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
                        {hasOrigin && (
                          <p className="mt-2 text-sm font-medium text-[#1e3a5f]">
                            {hasCoords ? (
                              <>{(dist as number).toFixed(1)} miles away</>
                            ) : (
                              <span className="text-gray-500">Distance unavailable</span>
                            )}
                          </p>
                        )}
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
            })}
          </ul>
        )}
      </main>
    </>
  );
}
