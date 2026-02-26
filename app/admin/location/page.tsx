"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchZipCoords } from "@/lib/geo";
import {
  checkIsSuperAdmin,
  getManagedLocations,
  type ManagedLocation,
} from "@/lib/admin-access";

type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  type: string | null;
  description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

type EventRow = {
  id: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  dine_in: boolean;
  pickup: boolean;
  notes: string | null;
};

const LOCATION_TYPES = [
  { value: "church", label: "Church" },
  { value: "vfw", label: "VFW" },
  { value: "knights of columbus", label: "Knights of Columbus" },
  { value: "other", label: "Other" },
];

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(t: string | null) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function AdminLocationPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [locations, setLocations] = useState<ManagedLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [location, setLocation] = useState<LocationRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [checking, setChecking] = useState(true);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [deleteConfirmEventId, setDeleteConfirmEventId] = useState<string | null>(null);
  const [duplicateSourceEvent, setDuplicateSourceEvent] = useState<EventRow | null>(null);
  const [duplicateEventDate, setDuplicateEventDate] = useState("");
  const [duplicatingEvent, setDuplicatingEvent] = useState(false);
  const [duplicateEventMessage, setDuplicateEventMessage] = useState<string | null>(null);
  const [duplicateEventError, setDuplicateEventError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [type, setType] = useState("church");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [newEventDate, setNewEventDate] = useState("");
  const [newEventStart, setNewEventStart] = useState("");
  const [newEventEnd, setNewEventEnd] = useState("");
  const [newEventDineIn, setNewEventDineIn] = useState(true);
  const [newEventPickup, setNewEventPickup] = useState(true);
  const [newEventNotes, setNewEventNotes] = useState("");

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
      setLoadingLocation(false);
      return;
    }
    Promise.all([checkIsSuperAdmin(user.id)]).then(async ([superAdmin]) => {
      const managed = await getManagedLocations(user.id, superAdmin);
      setIsSuperAdmin(superAdmin);
      setLocations(managed);
      setSelectedLocationId((prev) => {
        if (prev && managed.some((loc) => loc.id === prev)) return prev;
        return managed[0]?.id ?? "";
      });
    });
  }, [user?.id]);

  useEffect(() => {
    if (!selectedLocationId) {
      setLocation(null);
      setLoadingLocation(false);
      return;
    }
    setLoadingLocation(true);
    supabase
      .from("locations")
      .select(
        "id, name, address, city, state, zip, lat, lng, type, description, contact_name, contact_email, contact_phone"
      )
      .eq("id", selectedLocationId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setLocation(null);
        } else {
          const loc = data as LocationRow | null;
          setLocation(loc);
          if (loc) {
            setName(loc.name ?? "");
            setAddress(loc.address ?? "");
            setCity(loc.city ?? "");
            setState(loc.state ?? "");
            setZip(loc.zip ?? "");
            setType(loc.type ?? "church");
            setDescription(loc.description ?? "");
            setContactName(loc.contact_name ?? "");
            setContactEmail(loc.contact_email ?? "");
            setContactPhone(loc.contact_phone ?? "");
          }
        }
        setLoadingLocation(false);
      });
  }, [selectedLocationId]);

  useEffect(() => {
    if (!location?.id) {
      setLoadingEvents(false);
      setEvents([]);
      return;
    }
    setLoadingEvents(true);
    supabase
      .from("events")
      .select("id, event_date, start_time, end_time, dine_in, pickup, notes")
      .eq("location_id", location.id)
      .order("event_date", { ascending: false })
      .then(({ data, error }) => {
        if (error) setEvents([]);
        else setEvents((data as EventRow[]) ?? []);
        setLoadingEvents(false);
      });
  }, [location?.id]);

  async function handleSaveLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!location?.id) return;
    setSavingLocation(true);
    const zipTrimmed = zip.trim().replace(/\D/g, "");
    let latLng: { lat: number | null; lng: number | null } = {
      lat: null,
      lng: null,
    };
    if (zipTrimmed.length >= 5) {
      const coords = await fetchZipCoords(zipTrimmed);
      if (coords) latLng = { lat: coords.lat, lng: coords.lng };
    }
    await supabase
      .from("locations")
      .update({
        name: name.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip: zip.trim() || null,
        lat: latLng.lat,
        lng: latLng.lng,
        type: type.trim() || null,
        description: description.trim() || null,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
      })
      .eq("id", location.id);
    setLocation((prev) =>
      prev
        ? {
            ...prev,
            name: name.trim() || "",
            address: address.trim() || null,
            city: city.trim() || null,
            state: state.trim() || null,
            zip: zip.trim() || null,
            lat: latLng.lat,
            lng: latLng.lng,
            type: type.trim() || null,
            description: description.trim() || null,
            contact_name: contactName.trim() || null,
            contact_email: contactEmail.trim() || null,
            contact_phone: contactPhone.trim() || null,
          }
        : null
    );
    setSavingLocation(false);
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!location?.id) return;
    setSavingEvent(true);
    const { data: newEvent, error } = await supabase
      .from("events")
      .insert({
        location_id: location.id,
        event_date: newEventDate,
        start_time: newEventStart || null,
        end_time: newEventEnd || null,
        dine_in: newEventDineIn,
        pickup: newEventPickup,
        notes: newEventNotes.trim() || null,
        active: true,
      })
      .select("id, event_date, start_time, end_time, dine_in, pickup, notes")
      .single();
    if (!error && newEvent) {
      setEvents((prev) => [newEvent as EventRow, ...prev]);
      setNewEventDate("");
      setNewEventStart("");
      setNewEventEnd("");
      setNewEventDineIn(true);
      setNewEventPickup(true);
      setNewEventNotes("");
    }
    setSavingEvent(false);
  }

  async function handleDeleteEvent(eventId: string) {
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (!error) {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setDeleteConfirmEventId(null);
    }
  }

  function openDuplicateEvent(ev: EventRow) {
    setDuplicateSourceEvent(ev);
    setDuplicateEventDate("");
    setDuplicateEventError(null);
  }

  function closeDuplicateEvent() {
    setDuplicateSourceEvent(null);
    setDuplicateEventDate("");
    setDuplicateEventError(null);
  }

  async function handleDuplicateEventSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!duplicateSourceEvent || !location?.id) return;
    if (!duplicateEventDate) {
      setDuplicateEventError("Please choose a date.");
      return;
    }
    setDuplicatingEvent(true);
    setDuplicateEventError(null);
    setDuplicateEventMessage(null);

    const { data: createdEvent, error: eventError } = await supabase
      .from("events")
      .insert({
        location_id: location.id,
        event_date: duplicateEventDate,
        start_time: duplicateSourceEvent.start_time,
        end_time: duplicateSourceEvent.end_time,
        dine_in: duplicateSourceEvent.dine_in,
        pickup: duplicateSourceEvent.pickup,
        notes: duplicateSourceEvent.notes,
        active: true,
      })
      .select("id, event_date, start_time, end_time, dine_in, pickup, notes")
      .single();

    if (eventError || !createdEvent) {
      setDuplicatingEvent(false);
      setDuplicateEventError(eventError?.message || "Could not duplicate event.");
      return;
    }

    const { data: sourceMenuItems } = await supabase
      .from("menu_items")
      .select("name, description, price, category, available, prep_time_minutes, dietary_tags")
      .eq("event_id", duplicateSourceEvent.id);

    if (sourceMenuItems && sourceMenuItems.length > 0) {
      const copiedItems = sourceMenuItems.map((item) => ({
        event_id: createdEvent.id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        available: item.available,
        prep_time_minutes: item.prep_time_minutes,
        dietary_tags: item.dietary_tags,
      }));
      await supabase.from("menu_items").insert(copiedItems);
    }

    setEvents((prev) => [createdEvent as EventRow, ...prev]);
    setDuplicatingEvent(false);
    setDuplicateEventMessage("Event duplicated successfully.");
    closeDuplicateEvent();
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center">
        <p className="text-lg text-amber-200">Loading…</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col">
      <header className="border-b border-[#2d5a87] bg-[#16324a] px-4 py-4 text-white shadow-lg sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="text-sm font-medium text-amber-200 hover:text-amber-100"
            >
              ← Dashboard
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Manage location
            </h1>
          </div>
          {isSuperAdmin && locations.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const section = document.getElementById("add-event-section");
                  section?.scrollIntoView({ behavior: "smooth", block: "start" });
                  setTimeout(() => {
                    const input = document.getElementById("ev-date");
                    if (input instanceof HTMLInputElement) input.focus();
                  }, 250);
                }}
                className="rounded-lg bg-[#c9a227] px-3 py-2 text-sm font-bold text-[#1e3a5f] hover:bg-[#d4af37]"
              >
                Add New Event
              </button>
              <label htmlFor="location-switcher" className="text-sm text-blue-100">
                Location
              </label>
              <select
                id="location-switcher"
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="rounded-lg border border-[#2d5a87] bg-white/10 px-3 py-2 text-sm text-white focus:border-[#c9a227] focus:outline-none"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id} className="bg-[#16324a] text-white">
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {duplicateEventMessage && (
            <p className="rounded-lg bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-800">
              {duplicateEventMessage}
            </p>
          )}
          {loadingLocation ? (
            <p className="text-amber-200 py-4">Loading location…</p>
          ) : !location ? (
            <div className="rounded-2xl border border-[#2d5a87] bg-white p-8">
              <p className="text-amber-800 bg-amber-100 rounded-lg px-4 py-3">
                Your account is not linked to a location yet. Please contact the
                administrator.
              </p>
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-[#2d5a87] bg-white shadow-lg overflow-hidden">
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 sm:px-5">
                  <h2 className="font-bold text-[#1e3a5f]">Location details</h2>
                </div>
                <form onSubmit={handleSaveLocation} className="p-4 sm:p-5 space-y-4">
                  <div>
                    <label htmlFor="loc-name" className="block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <input
                      id="loc-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="loc-address" className="block text-sm font-medium text-gray-700">
                      Address
                    </label>
                    <input
                      id="loc-address"
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor="loc-city" className="block text-sm font-medium text-gray-700">
                        City
                      </label>
                      <input
                        id="loc-city"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="loc-state" className="block text-sm font-medium text-gray-700">
                        State
                      </label>
                      <input
                        id="loc-state"
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="loc-zip" className="block text-sm font-medium text-gray-700">
                        Zip
                      </label>
                      <input
                        id="loc-zip"
                        type="text"
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="loc-type" className="block text-sm font-medium text-gray-700">
                      Type
                    </label>
                    <select
                      id="loc-type"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    >
                      {LOCATION_TYPES.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="loc-desc" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      id="loc-desc"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  </div>
                  <div className="border-t border-gray-100 pt-4">
                    <h3 className="text-sm font-semibold text-[#1e3a5f] mb-3">
                      Contact
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="loc-contact-name" className="block text-sm font-medium text-gray-700">
                          Contact name
                        </label>
                        <input
                          id="loc-contact-name"
                          type="text"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                        />
                      </div>
                      <div>
                        <label htmlFor="loc-contact-email" className="block text-sm font-medium text-gray-700">
                          Contact email
                        </label>
                        <input
                          id="loc-contact-email"
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                        />
                      </div>
                      <div>
                        <label htmlFor="loc-contact-phone" className="block text-sm font-medium text-gray-700">
                          Contact phone
                        </label>
                        <input
                          id="loc-contact-phone"
                          type="tel"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={savingLocation}
                      className="w-full rounded-xl bg-[#c9a227] px-4 py-3 text-base font-bold text-[#1e3a5f] hover:bg-[#d4af37] disabled:opacity-70 sm:w-auto sm:px-6"
                    >
                      {savingLocation ? "Saving…" : "Save location"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="rounded-2xl border border-[#2d5a87] bg-white shadow-lg overflow-hidden">
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 sm:px-5">
                  <h2 className="font-bold text-[#1e3a5f]">Events</h2>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Add and manage fish fry events for this location.
                  </p>
                </div>
                <div className="p-4 sm:p-5 space-y-6">
                  <form
                    id="add-event-section"
                    onSubmit={handleAddEvent}
                    className="rounded-xl border border-[#2d5a87] bg-gray-50/50 p-4 space-y-4"
                  >
                    <h3 className="font-semibold text-[#1e3a5f]">Add event</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="ev-date" className="block text-sm font-medium text-gray-700">
                          Event date
                        </label>
                        <input
                          id="ev-date"
                          type="date"
                          required
                          value={newEventDate}
                          onChange={(e) => setNewEventDate(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="ev-start" className="block text-sm font-medium text-gray-700">
                            Start time
                          </label>
                          <input
                            id="ev-start"
                            type="time"
                            value={newEventStart}
                            onChange={(e) => setNewEventStart(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                          />
                        </div>
                        <div>
                          <label htmlFor="ev-end" className="block text-sm font-medium text-gray-700">
                            End time
                          </label>
                          <input
                            id="ev-end"
                            type="time"
                            value={newEventEnd}
                            onChange={(e) => setNewEventEnd(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newEventDineIn}
                          onChange={(e) => setNewEventDineIn(e.target.checked)}
                          className="rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Dine-in available
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newEventPickup}
                          onChange={(e) => setNewEventPickup(e.target.checked)}
                          className="rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Pickup available
                        </span>
                      </label>
                    </div>
                    <div>
                      <label htmlFor="ev-notes" className="block text-sm font-medium text-gray-700">
                        Notes
                      </label>
                      <textarea
                        id="ev-notes"
                        rows={2}
                        value={newEventNotes}
                        onChange={(e) => setNewEventNotes(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                        placeholder="Optional"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingEvent}
                      className="rounded-xl bg-[#c9a227] px-4 py-2.5 text-sm font-bold text-[#1e3a5f] hover:bg-[#d4af37] disabled:opacity-70"
                    >
                      {savingEvent ? "Adding…" : "Add event"}
                    </button>
                  </form>

                  {loadingEvents ? (
                    <p className="text-gray-500 text-sm py-2">Loading events…</p>
                  ) : events.length === 0 ? (
                    <p className="text-gray-500 text-sm py-2">
                      No events yet. Add one above.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {events.map((ev) => (
                        <li
                          key={ev.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4"
                        >
                          <div>
                            <p className="font-medium text-gray-900">
                              {formatEventDate(ev.event_date)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatTime(ev.start_time)} – {formatTime(ev.end_time)}
                              {ev.dine_in && " · Dine-in"}
                              {ev.pickup && " · Pickup"}
                            </p>
                            {ev.notes && (
                              <p className="text-sm text-gray-500 mt-1">{ev.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {deleteConfirmEventId === ev.id ? (
                              <>
                                <span className="text-xs text-red-600">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEvent(ev.id)}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmEventId(null)}
                                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"
                                >
                                  No
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmEventId(ev.id)}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openDuplicateEvent(ev)}
                              className="rounded-lg border border-[#2d5a87] px-3 py-1.5 text-xs font-medium text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white"
                            >
                              Duplicate Event
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {duplicateSourceEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
              <h3 className="text-lg font-bold text-[#1e3a5f]">Duplicate Event</h3>
              <p className="mt-1 text-sm text-gray-600">
                Choose a new date for the duplicated event.
              </p>
            </div>
            <form onSubmit={handleDuplicateEventSubmit} className="space-y-4 p-5 sm:p-6">
              <div>
                <label htmlFor="duplicate-event-date" className="block text-sm font-medium text-gray-700">
                  New event date
                </label>
                <input
                  id="duplicate-event-date"
                  type="date"
                  required
                  value={duplicateEventDate}
                  onChange={(e) => setDuplicateEventDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                />
              </div>
              {duplicateEventError && (
                <p className="text-sm text-red-600" role="alert">
                  {duplicateEventError}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeDuplicateEvent}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={duplicatingEvent}
                  className="flex-1 rounded-xl bg-[#c9a227] px-4 py-2.5 text-sm font-bold text-[#1e3a5f] hover:bg-[#d4af37] disabled:opacity-70"
                >
                  {duplicatingEvent ? "Duplicating…" : "Duplicate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
