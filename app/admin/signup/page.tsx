"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchZipCoords } from "@/lib/geo";

const LOCATION_TYPES = [
  { value: "church", label: "Church" },
  { value: "vfw", label: "VFW" },
  { value: "knights of columbus", label: "Knights of Columbus" },
  { value: "other", label: "Other" },
];

export default function AdminSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [type, setType] = useState("church");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    const { data: authData, error: signUpError } =
      await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

    if (signUpError) {
      setSubmitting(false);
      if (
        signUpError.message?.toLowerCase().includes("already registered") ||
        signUpError.message?.toLowerCase().includes("already exists") ||
        signUpError.code === "user_already_exists"
      ) {
        setError("This email is already registered. Try signing in instead.");
      } else {
        setError(signUpError.message || "Could not create account.");
      }
      return;
    }

    const user = authData?.user;
    // When email confirmation is on, Supabase returns fake user for existing emails
    if (user && (user as { identities?: unknown[] }).identities?.length === 0) {
      setSubmitting(false);
      setError("This email is already registered. Try signing in instead.");
      return;
    }
    if (!user?.id) {
      setSubmitting(false);
      setError("Account was created but we could not complete setup. Please sign in and contact support.");
      return;
    }

    // Geocode zip for lat/lng if provided
    let lat: number | null = null;
    let lng: number | null = null;
    const zipTrimmed = zip.trim().replace(/\D/g, "");
    if (zipTrimmed.length >= 5) {
      const coords = await fetchZipCoords(zipTrimmed);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
    }

    const { error: insertError } = await supabase.from("locations").insert({
      user_id: user.id,
      name: orgName.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      zip: zip.trim() || null,
      lat,
      lng,
      type: type.trim() || null,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message || "Could not save location. Please contact support.");
      return;
    }

    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col">
      <header className="border-b border-[#2d5a87] bg-[#16324a] px-4 py-6 text-white shadow-lg sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <Link
            href="/"
            className="inline-flex text-sm font-medium text-amber-200 hover:text-amber-100"
          >
            ← Back to home
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Register your fish fry
          </h1>
          <p className="mt-2 text-blue-100">
            Create an account and add your location to start accepting orders.
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[#2d5a87] bg-white p-6 shadow-lg sm:p-8"
          >
            {/* Section 1: Account */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-[#1e3a5f] border-b border-[#2d5a87]/30 pb-2">
                Account
              </h2>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email <span className="text-red-600">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password <span className="text-red-600">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
                  minLength={6}
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm password <span className="text-red-600">*</span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
                  minLength={6}
                />
              </div>
            </section>

            {/* Section 2: Location */}
            <section className="mt-8 space-y-4">
              <h2 className="text-lg font-bold text-[#1e3a5f] border-b border-[#2d5a87]/30 pb-2">
                Location
              </h2>
              <div>
                <label htmlFor="orgName" className="block text-sm font-medium text-gray-700">
                  Organization name <span className="text-red-600">*</span>
                </label>
                <input
                  id="orgName"
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
                  placeholder="e.g. St. Mary's Parish"
                />
              </div>
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <input
                  id="address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                    City
                  </label>
                  <input
                    id="city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                    State
                  </label>
                  <input
                    id="state"
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
                    placeholder="ST"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="zip" className="block text-sm font-medium text-gray-700">
                  Zip
                </label>
                <input
                  id="zip"
                  type="text"
                  inputMode="numeric"
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
                  placeholder="12345"
                />
              </div>
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                  Type
                </label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
                >
                  {LOCATION_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="contactName" className="block text-sm font-medium text-gray-700">
                  Contact name
                </label>
                <input
                  id="contactName"
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700">
                  Contact email
                </label>
                <input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
                  placeholder="contact@example.com"
                />
              </div>
              <div>
                <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700">
                  Contact phone
                </label>
                <input
                  id="contactPhone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
                  placeholder="(555) 123-4567"
                />
              </div>
            </section>

            {error && (
              <p className="mt-6 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-8 w-full rounded-xl bg-[#c9a227] px-4 py-3 text-base font-bold uppercase tracking-wide text-[#1e3a5f] shadow-md transition hover:bg-[#d4af37] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed active:bg-[#b8941f]"
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>

            <p className="mt-6 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link
                href="/admin/login"
                className="font-medium text-[#1e3a5f] underline decoration-[#2d5a87]/50 underline-offset-2 hover:text-[#2d5a87]"
              >
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
