"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type LocationRow = { id: string; name: string } | null;

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [location, setLocation] = useState<LocationRow>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/admin/login");
        return;
      }
      setUser(session.user ?? null);
      setChecking(false);
    });
  }, [router]);

  useEffect(() => {
    if (!user?.id) {
      setLocationLoading(false);
      return;
    }
    setLocationLoading(true);
    supabase
      .from("locations")
      .select("id, name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setLocation(data ?? null);
        setLocationLoading(false);
      });
  }, [user?.id]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center">
        <p className="text-lg text-amber-200">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const navLinks = [
    { href: "/admin/location", label: "Manage Location" },
    { href: "/admin/menu", label: "Manage Menu" },
    { href: "/admin/orders", label: "View Orders" },
  ];

  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col">
      <header className="border-b border-[#2d5a87] bg-[#16324a] px-4 py-6 text-white shadow-lg sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Admin dashboard
            </h1>
            {user.email && (
              <p className="mt-1 text-sm text-blue-100">{user.email}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="self-start rounded-lg border border-amber-200/60 bg-transparent px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-200/10 sm:self-auto"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-[#2d5a87] bg-white p-6 shadow-lg sm:p-8">
            {locationLoading ? (
              <p className="text-gray-600">Loading…</p>
            ) : location ? (
              <>
                <h2 className="text-xl font-bold text-[#1e3a5f]">
                  Welcome, {location.name}
                </h2>
                <p className="mt-2 text-gray-600">
                  Use the links below to manage your location, menu, and view orders.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-[#1e3a5f]">
                  Welcome to the admin dashboard
                </h2>
                <p className="mt-2 text-amber-800 bg-amber-100 rounded-lg px-4 py-3">
                  Your account is not linked to a location yet. Please contact the administrator.
                </p>
              </>
            )}

            <nav className="mt-8" aria-label="Admin navigation">
              <ul className="space-y-3">
                {navLinks.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="flex items-center justify-between rounded-xl border border-[#2d5a87] bg-gray-50/50 px-5 py-4 text-left font-medium text-[#1e3a5f] transition hover:bg-[#1e3a5f] hover:text-white hover:border-[#1e3a5f]"
                    >
                      <span>{label}</span>
                      <span className="text-inherit" aria-hidden>
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </main>
    </div>
  );
}
