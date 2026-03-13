"use client";

import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Navbar } from "@/app/components/Navbar";
import { submitClaimRequest } from "./actions";

const ROLE_OPTIONS = [
  { value: "pastor", label: "Pastor" },
  { value: "fish_fry_coordinator", label: "Fish Fry Coordinator" },
  { value: "parish_staff", label: "Parish Staff" },
  { value: "volunteer", label: "Volunteer" },
  { value: "other", label: "Other" },
];

export default function ClaimFormPage() {
  const router = useRouter();
  const params = useParams();
  const locationId = params.locationId as string;
  const [locationName, setLocationName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "other",
    message: "",
  });

  useEffect(() => {
    supabase
      .from("locations")
      .select("name")
      .eq("id", locationId)
      .single()
      .then(({ data, error: err }) => {
        setLoading(false);
        if (err || !data) {
          setError("Location not found");
          return;
        }
        setLocationName((data as { name?: string }).name ?? "Unknown");
      });
  }, [locationId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();

    if (!name || !email || !phone) {
      setError("Please fill in full name, email, and phone number.");
      return;
    }

    setSubmitting(true);
    const result = await submitClaimRequest({
      locationId,
      name,
      email,
      phone,
      role: form.role,
      message: form.message.trim(),
      locationName,
    });
    setSubmitting(false);

    if (result.ok) {
      setSubmitted(true);
    } else {
      setError(result.error ?? "Something went wrong. Please try again.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1e3a5f]">
        <header className="border-b border-[#2d5a87] bg-[#16324a] text-white shadow-lg">
          <Navbar />
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
            <Link href="/claim" className="text-sm font-medium text-amber-200 hover:text-amber-100">
              ← Back to search
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-center text-amber-200">Loading…</p>
        </main>
      </div>
    );
  }

  if (error && !locationName) {
    return (
      <div className="min-h-screen bg-[#1e3a5f]">
        <header className="border-b border-[#2d5a87] bg-[#16324a] text-white shadow-lg">
          <Navbar />
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
            <Link href="/claim" className="text-sm font-medium text-amber-200 hover:text-amber-100">
              ← Back to search
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-center text-red-200">{error}</p>
        </main>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#1e3a5f]">
        <header className="border-b border-[#2d5a87] bg-[#16324a] text-white shadow-lg">
          <Navbar />
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
            <Link href="/claim" className="text-sm font-medium text-amber-200 hover:text-amber-100">
              ← Back to search
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[#2d5a87] bg-white p-6 shadow-lg sm:p-8">
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Request submitted</h1>
            <p className="mt-4 text-gray-700">
              Your claim request has been submitted. Brett Greiner will review it and contact you within 24 hours.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-[#c9a227] px-6 py-3 font-bold text-[#1e3a5f] transition hover:bg-[#d4af37]"
            >
              Back to home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1e3a5f]">
      <header className="border-b border-[#2d5a87] bg-[#16324a] text-white shadow-lg">
        <Navbar />
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/claim" className="text-sm font-medium text-amber-200 hover:text-amber-100">
            ← Back to search
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
            Claim: {locationName}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[#2d5a87] bg-white p-6 shadow-lg sm:p-8"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full name *
              </label>
              <input
                id="name"
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-[#c9a227] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/50"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email *
              </label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-[#c9a227] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/50"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone number *
              </label>
              <input
                id="phone"
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-[#c9a227] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/50"
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role at the church *
              </label>
              <select
                id="role"
                required
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-[#c9a227] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/50"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                Why are you the right person to manage this listing?
              </label>
              <textarea
                id="message"
                rows={4}
                value={form.message}
                onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-[#c9a227] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/50"
                placeholder="e.g. I'm the fish fry coordinator and have been running it for 5 years."
              />
            </div>
          </div>
          {error && (
            <p className="mt-4 text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="mt-6 flex gap-3">
            <Link
              href="/claim"
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-center font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-[#c9a227] px-4 py-3 font-bold text-[#1e3a5f] transition hover:bg-[#d4af37] disabled:opacity-70"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
