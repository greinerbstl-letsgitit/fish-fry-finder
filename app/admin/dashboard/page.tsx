"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchZipCoords } from "@/lib/geo";
import { checkIsSuperAdmin, getManagedLocations } from "@/lib/admin-access";
import { approveLocation, rejectLocation, approveClaimRequest, rejectClaimRequest, getClaimRequests, type ClaimRequestRow } from "./actions";

type LocationRow = { id: string; name: string } | null;
type ManagedLocation = { id: string; name: string };
type PendingLocation = {
  id: string;
  name: string;
  city: string;
  state: string;
  type: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  user_id: string | null;
};
type NewLocationFormState = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: string;
  description: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

const LOCATION_TYPES = [
  { value: "church", label: "Church" },
  { value: "vfw", label: "VFW" },
  { value: "knights of columbus", label: "Knights of Columbus" },
  { value: "other", label: "Other" },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [location, setLocation] = useState<LocationRow>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [managedLocations, setManagedLocations] = useState<ManagedLocation[]>([]);
  const [locationLoading, setLocationLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingLocations, setPendingLocations] = useState<PendingLocation[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [actionLocationId, setActionLocationId] = useState<string | null>(null);
  const [claimRequests, setClaimRequests] = useState<ClaimRequestRow[]>([]);
  const [claimRequestsLoading, setClaimRequestsLoading] = useState(false);
  const [actionClaimId, setActionClaimId] = useState<string | null>(null);
  const [claimErrorById, setClaimErrorById] = useState<Record<string, string>>({});
  const [newLocation, setNewLocation] = useState<NewLocationFormState>({
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    type: "church",
    description: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  });

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
    Promise.all([checkIsSuperAdmin(user.id)]).then(async ([superAdmin]) => {
      const managed = await getManagedLocations(user.id, superAdmin);
      setIsSuperAdmin(superAdmin);
      setManagedLocations(managed);
      if (superAdmin) {
        setLocation(managed[0] ?? null);
      } else {
        setLocation(managed[0] ?? null);
      }
      setLocationLoading(false);
    });
  }, [user?.id]);

  useEffect(() => {
    if (!isSuperAdmin || !user?.id) return;
    setPendingLoading(true);
    supabase
      .from("locations")
      .select("id, name, city, state, type, contact_name, contact_phone, contact_email, user_id")
      .eq("approved", false)
      .then(({ data }) => {
        setPendingLocations((data as PendingLocation[]) ?? []);
        setPendingLoading(false);
      });
  }, [isSuperAdmin, user?.id]);

  useEffect(() => {
    if (!isSuperAdmin || !user?.id) return;
    setClaimRequestsLoading(true);
    getClaimRequests(user.id).then((data) => {
      setClaimRequests(data);
      setClaimRequestsLoading(false);
    });
  }, [isSuperAdmin, user?.id]);

  async function handleApproveClaim(cr: ClaimRequestRow) {
    if (!user?.id) return;
    const locationName = (cr.locations as { name?: string } | null)?.name ?? "Unknown";
    setActionClaimId(cr.id);
    setClaimErrorById((prev) => ({ ...prev, [cr.id]: "" }));
    const result = await approveClaimRequest(cr.id, cr.location_id, cr.email, locationName, user.id);
    setActionClaimId(null);
    if (result.ok) {
      const removedIds = claimRequests
        .filter((c) => c.location_id === cr.location_id)
        .map((c) => c.id);
      setClaimRequests((prev) =>
        prev.filter((c) => c.location_id !== cr.location_id)
      );
      setClaimErrorById((prev) => {
        const next = { ...prev };
        removedIds.forEach((id) => delete next[id]);
        return next;
      });
      setSuccessMessage(`Claim for "${locationName}" has been approved.`);
    } else {
      setSuccessMessage(null);
      setFormError(null);
      setClaimErrorById((prev) => ({ ...prev, [cr.id]: result.error ?? "Could not approve." }));
    }
  }

  async function handleRejectClaim(cr: ClaimRequestRow) {
    if (!user?.id) return;
    if (!confirm("Reject this claim request?")) return;
    setActionClaimId(cr.id);
    const result = await rejectClaimRequest(cr.id, user.id);
    setActionClaimId(null);
    if (result.ok) {
      setClaimRequests((prev) => prev.filter((c) => c.location_id !== cr.location_id));
      setSuccessMessage("Claim request has been rejected.");
    } else {
      setSuccessMessage(null);
      setFormError(result.error ?? "Could not reject.");
    }
  }

  async function handleApprove(loc: PendingLocation) {
    if (!user?.id) return;
    setActionLocationId(loc.id);
    const result = await approveLocation(loc.id, loc.contact_email, loc.name, user.id);
    setActionLocationId(null);
    if (result.ok) {
      setPendingLocations((prev) => prev.filter((p) => p.id !== loc.id));
      setSuccessMessage(`"${loc.name}" has been approved.`);
    } else {
      setSuccessMessage(null);
      setFormError(result.error ?? "Could not approve.");
    }
  }

  async function handleReject(loc: PendingLocation) {
    if (!user?.id) return;
    if (!confirm(`Reject "${loc.name}"? This will delete the location and the associated user account.`)) return;
    setActionLocationId(loc.id);
    const result = await rejectLocation(loc.id, user.id);
    setActionLocationId(null);
    if (result.ok) {
      setPendingLocations((prev) => prev.filter((p) => p.id !== loc.id));
      setSuccessMessage(`"${loc.name}" has been rejected.`);
    } else {
      setSuccessMessage(null);
      setFormError(result.error ?? "Could not reject.");
    }
  }

  async function handleCreateLocation(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const name = newLocation.name.trim();
    const address = newLocation.address.trim();
    const city = newLocation.city.trim();
    const state = newLocation.state.trim();
    const zip = newLocation.zip.trim().replace(/\D/g, "").slice(0, 5);
    const contactName = newLocation.contactName.trim();
    const contactPhone = newLocation.contactPhone.trim();

    if (!name || !address || !city || !state || !zip || !contactName || !contactPhone) {
      setFormError("Please fill in all required fields.");
      return;
    }

    setSavingLocation(true);
    let lat: number | null = null;
    let lng: number | null = null;
    const coords = await fetchZipCoords(zip);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }

    const { data, error } = await supabase
      .from("locations")
      .insert({
        user_id: null,
        name,
        address,
        city,
        state,
        zip,
        lat,
        lng,
        type: newLocation.type,
        description: newLocation.description.trim() || null,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: newLocation.contactEmail.trim() || null,
        approved: true,
      })
      .select("id, name")
      .single();

    setSavingLocation(false);

    if (error || !data) {
      setFormError(error?.message || "Could not create location.");
      return;
    }

    const added = data as ManagedLocation;
    setManagedLocations((prev) => {
      const next = [...prev, added].sort((a, b) => a.name.localeCompare(b.name));
      return next;
    });
    setLocation((prev) => prev ?? added);
    setShowAddLocationModal(false);
    setSuccessMessage(`Location "${added.name}" created successfully.`);
    setNewLocation({
      name: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      type: "church",
      description: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
    });
  }

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
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-[#1e3a5f]">
                    Welcome, {location.name}
                  </h2>
                  {isSuperAdmin && (
                    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      Super Admin
                    </span>
                  )}
                </div>
                <p className="mt-2 text-gray-600">
                  Use the links below to manage your location, menu, and view orders.
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-[#1e3a5f]">
                    Welcome to the admin dashboard
                  </h2>
                  {isSuperAdmin && (
                    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      Super Admin
                    </span>
                  )}
                </div>
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

            {isSuperAdmin && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setShowAddLocationModal(true);
                  }}
                  className="w-full rounded-xl bg-[#c9a227] px-5 py-3 text-base font-bold text-[#1e3a5f] transition hover:bg-[#d4af37] sm:w-auto"
                >
                  Add New Location
                </button>
              </div>
            )}
          </div>
          {successMessage && (
            <p className="mt-4 rounded-lg bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-800">
              {successMessage}
            </p>
          )}
          {formError && (
            <p className="mt-4 rounded-lg bg-red-100 px-4 py-3 text-sm font-medium text-red-800">
              {formError}
            </p>
          )}
          {isSuperAdmin && (
            <div className="mt-8 rounded-2xl border border-[#2d5a87] bg-white p-6 shadow-lg sm:p-8">
              <h2 className="text-xl font-bold text-[#1e3a5f]">Pending Approvals</h2>
              <p className="mt-1 text-gray-600">Review and approve or reject new organization signups.</p>
              {pendingLoading ? (
                <p className="mt-4 text-gray-600">Loading…</p>
              ) : pendingLocations.length === 0 ? (
                <p className="mt-4 text-gray-500">No pending approvals.</p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {pendingLocations.map((loc) => (
                    <div
                      key={loc.id}
                      className="rounded-xl border border-[#2d5a87]/50 bg-gray-50/50 p-4"
                    >
                      <h3 className="font-bold text-[#1e3a5f]">{loc.name}</h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {loc.city}, {loc.state}
                        {loc.type && ` · ${loc.type}`}
                      </p>
                      <p className="mt-2 text-sm text-gray-700">
                        <span className="font-medium">Contact:</span> {loc.contact_name ?? "—"}
                      </p>
                      {loc.contact_phone && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Phone:</span> {loc.contact_phone}
                        </p>
                      )}
                      {loc.contact_email && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Email:</span> {loc.contact_email}
                        </p>
                      )}
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(loc)}
                          disabled={actionLocationId === loc.id}
                          className="rounded-lg bg-[#c9a227] px-4 py-2 text-sm font-bold text-[#1e3a5f] transition hover:bg-[#d4af37] disabled:opacity-70"
                        >
                          {actionLocationId === loc.id ? "Processing…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(loc)}
                          disabled={actionLocationId === loc.id}
                          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-70"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {isSuperAdmin && (
            <div className="mt-8 rounded-2xl border border-[#2d5a87] bg-white p-6 shadow-lg sm:p-8">
              <h2 className="text-xl font-bold text-[#1e3a5f]">Claim Requests</h2>
              <p className="mt-1 text-gray-600">
                Review and approve or reject location claim requests.
              </p>
              {claimRequestsLoading ? (
                <p className="mt-4 text-gray-600">Loading…</p>
              ) : claimRequests.length === 0 ? (
                <p className="mt-4 text-gray-500">No pending claim requests.</p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {claimRequests.map((cr) => {
                    const locationName =
                      (cr.locations as { name?: string } | null)?.name ?? "Unknown";
                    return (
                      <div
                        key={cr.id}
                        className="rounded-xl border border-[#2d5a87]/50 bg-gray-50/50 p-4"
                      >
                        <h3 className="font-bold text-[#1e3a5f]">{locationName}</h3>
                        {claimErrorById[cr.id] && (
                          <div
                            className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
                            role="alert"
                          >
                            {claimErrorById[cr.id]}
                          </div>
                        )}
                        <p className="mt-2 text-sm text-gray-700">
                          <span className="font-medium">Claimant:</span> {cr.name}
                        </p>
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Email:</span> {cr.email}
                        </p>
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Phone:</span> {cr.phone}
                        </p>
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Role:</span> {cr.role}
                        </p>
                        {cr.message && (
                          <p className="mt-2 text-sm text-gray-700">
                            <span className="font-medium">Message:</span> {cr.message}
                          </p>
                        )}
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleApproveClaim(cr)}
                            disabled={actionClaimId === cr.id}
                            className="rounded-lg bg-[#c9a227] px-4 py-2 text-sm font-bold text-[#1e3a5f] transition hover:bg-[#d4af37] disabled:opacity-70"
                          >
                            {actionClaimId === cr.id ? "Processing…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectClaim(cr)}
                            disabled={actionClaimId === cr.id}
                            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-70"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {showAddLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-[#1e3a5f]">Add New Location</h2>
            </div>
            <form onSubmit={handleCreateLocation} className="space-y-4 p-5 sm:p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization name *</label>
                <input
                  type="text"
                  required
                  value={newLocation.name}
                  onChange={(e) => setNewLocation((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Address *</label>
                <input
                  type="text"
                  required
                  value={newLocation.address}
                  onChange={(e) => setNewLocation((prev) => ({ ...prev, address: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">City *</label>
                  <input
                    type="text"
                    required
                    value={newLocation.city}
                    onChange={(e) => setNewLocation((prev) => ({ ...prev, city: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">State *</label>
                  <input
                    type="text"
                    required
                    value={newLocation.state}
                    onChange={(e) => setNewLocation((prev) => ({ ...prev, state: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Zip *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={newLocation.zip}
                    onChange={(e) =>
                      setNewLocation((prev) => ({
                        ...prev,
                        zip: e.target.value.replace(/\D/g, "").slice(0, 5),
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={newLocation.type}
                  onChange={(e) => setNewLocation((prev) => ({ ...prev, type: e.target.value }))}
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
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  rows={2}
                  value={newLocation.description}
                  onChange={(e) => setNewLocation((prev) => ({ ...prev, description: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contact name *</label>
                  <input
                    type="text"
                    required
                    value={newLocation.contactName}
                    onChange={(e) => setNewLocation((prev) => ({ ...prev, contactName: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contact phone *</label>
                  <input
                    type="tel"
                    required
                    value={newLocation.contactPhone}
                    onChange={(e) => setNewLocation((prev) => ({ ...prev, contactPhone: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contact email</label>
                  <input
                    type="email"
                    value={newLocation.contactEmail}
                    onChange={(e) => setNewLocation((prev) => ({ ...prev, contactEmail: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                  />
                </div>
              </div>
              {formError && (
                <p className="text-sm text-red-600" role="alert">
                  {formError}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLocationModal(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLocation}
                  className="flex-1 rounded-xl bg-[#c9a227] px-4 py-2.5 text-sm font-bold text-[#1e3a5f] hover:bg-[#d4af37] disabled:opacity-70"
                >
                  {savingLocation ? "Saving…" : "Save Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
