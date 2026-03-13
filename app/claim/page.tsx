"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { matchesWithVariants } from "@/lib/search-variants";
import { Navbar } from "@/app/components/Navbar";

type Location = {
  id: string;
  name: string | null;
  city: string | null;
  state: string | null;
};

export default function ClaimPage() {
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("locations")
      .select("id, name, city, state")
      .eq("approved", true)
      .then(({ data }) => {
        if (!cancelled) setLocations((data as Location[]) ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q || q.length < 2) return locations;
    return locations.filter((loc) => {
      const name = (loc.name ?? "").trim();
      const city = (loc.city ?? "").trim();
      if (name && matchesWithVariants(query, name)) return true;
      if (city && matchesWithVariants(query, city)) return true;
      return false;
    });
  }, [locations, query]);

  return (
    <div className="min-h-screen bg-[#1e3a5f]">
      <header className="border-b border-[#2d5a87] bg-[#16324a] text-white shadow-lg">
        <Navbar />
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex text-sm font-medium text-amber-200 hover:text-amber-100"
          >
            ← Back to home
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            List or Claim Your Fish Fry
          </h1>
          <p className="mt-2 text-blue-100">
            Claim an existing listing or add a new fish fry to the finder.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#2d5a87] bg-white p-6 shadow-lg">
          <label htmlFor="claim-search" className="block text-sm font-medium text-gray-700">
            Search for your church or organization
          </label>
          <input
            id="claim-search"
            type="search"
            placeholder="e.g. St. Mary, Immacolata, Holy Redeemer"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-2 w-full rounded-xl border border-[#2d5a87] px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#c9a227] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/50"
            autoComplete="off"
          />
        </div>

        <div className="mt-6 space-y-4">
          {loading ? (
            <p className="text-center text-amber-200">Loading locations…</p>
          ) : query.trim().length < 2 ? (
            <p className="rounded-2xl border border-[#2d5a87] bg-white/5 px-6 py-8 text-center text-blue-100">
              Type at least 2 characters to search for your church or organization.
            </p>
          ) : filtered.length === 0 ? (
              <p className="rounded-2xl border border-[#2d5a87] bg-white/5 px-6 py-8 text-center text-blue-100">
                {query.trim().length < 2
                  ? "Enter at least 2 characters to search."
                  : "No matching locations found."}
              </p>
            ) : (
              <ul className="space-y-4">
                {filtered.map((loc) => (
                  <li
                    key={loc.id}
                    className="overflow-hidden rounded-2xl border border-[#2d5a87] bg-white shadow-lg"
                  >
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                      <div>
                        <h2 className="text-xl font-bold text-[#1e3a5f]">
                          {loc.name ?? "Unknown"}
                        </h2>
                        {(loc.city || loc.state) && (
                          <p className="mt-1 text-[#2d5a87]">
                            {[loc.city, loc.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/claim/${loc.id}`}
                        className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#c9a227] px-6 py-3 font-bold text-[#1e3a5f] shadow-md transition hover:bg-[#d4af37]"
                      >
                        Claim this listing
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/admin/signup"
            className="inline-flex items-center justify-center rounded-xl border-2 border-[#c9a227] bg-transparent px-8 py-4 font-bold text-[#c9a227] transition hover:bg-[#c9a227]/10"
          >
            Don&apos;t see yours? List a new fish fry
          </Link>
        </div>
      </main>
    </div>
  );
}
