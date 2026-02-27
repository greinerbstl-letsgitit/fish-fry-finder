"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  checkIsSuperAdmin,
  getManagedLocations,
  type ManagedLocation,
} from "@/lib/admin-access";

type MenuItemRow = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  available: boolean;
  prep_time_minutes: number | null;
  dietary_tags: string[] | null;
  dine_in_only?: boolean;
  pickup_only?: boolean;
};

type EventRow = {
  id: string;
  event_date: string;
  start_time: string | null;
  locations: { name: string } | { name: string }[];
  menu_items: MenuItemRow[];
};

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(price);
}

function getLocationName(ev: EventRow): string {
  const loc = Array.isArray(ev.locations) ? ev.locations[0] : ev.locations;
  return (loc as { name?: string })?.name ?? "—";
}

const CATEGORIES = ["fish", "sides", "drinks", "desserts", "other"];
const DIETARY_TAG_OPTIONS = [
  "Gluten Free",
  "Dairy Free",
  "Nut Free",
  "Vegetarian",
  "Vegan",
  "Spicy",
] as const;

type LocationRow = { id: string; name: string };

export default function AdminMenuPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [locations, setLocations] = useState<ManagedLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemRow | null>(null);
  const [addForEventId, setAddForEventId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copySourceEventId, setCopySourceEventId] = useState<string | null>(null);
  const [copyTargetEventId, setCopyTargetEventId] = useState<string>("");
  const [copyingMenu, setCopyingMenu] = useState(false);
  const [copyMenuMessage, setCopyMenuMessage] = useState<string | null>(null);
  const [copyMenuError, setCopyMenuError] = useState<string | null>(null);

  const formEventId = editingItem ? editingItem.event_id : addForEventId;
  const isEdit = !!editingItem;
  const location =
    locations.find((loc) => loc.id === selectedLocationId) ?? null;

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
    if (!user?.id) return;
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
      setLoading(false);
      setEvents([]);
      return;
    }

    setLoading(true);
    supabase
      .from("events")
      .select(
        `
        id,
        event_date,
        start_time,
        locations (name),
        menu_items (
          id,
          event_id,
          name,
          description,
          price,
          category,
          available,
          prep_time_minutes,
          dietary_tags,
          dine_in_only,
          pickup_only
        )
      `
      )
      .eq("location_id", selectedLocationId)
      .order("event_date", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("Events/menu fetch error:", error);
          setEvents([]);
        } else {
          const rows = (data as EventRow[]) ?? [];
          setEvents(rows.map((e) => ({ ...e, menu_items: e.menu_items ?? [] })));
        }
        setLoading(false);
      });
  }, [selectedLocationId]);

  function openAdd(eventId: string) {
    setEditingItem(null);
    setAddForEventId(eventId);
    setModalOpen(true);
  }

  function openEdit(item: MenuItemRow) {
    setEditingItem(item);
    setAddForEventId(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingItem(null);
    setAddForEventId(null);
  }

  function openCopyMenu(sourceEventId: string) {
    setCopySourceEventId(sourceEventId);
    setCopyTargetEventId("");
    setCopyMenuError(null);
  }

  function closeCopyMenu() {
    setCopySourceEventId(null);
    setCopyTargetEventId("");
    setCopyMenuError(null);
  }

  async function handleCopyMenu() {
    if (!copySourceEventId || !copyTargetEventId) {
      setCopyMenuError("Please choose an event to copy to.");
      return;
    }
    const sourceEvent = events.find((e) => e.id === copySourceEventId);
    if (!sourceEvent) {
      setCopyMenuError("Could not find source event.");
      return;
    }
    if (sourceEvent.menu_items.length === 0) {
      setCopyMenuError("Source event has no menu items to copy.");
      return;
    }

    setCopyingMenu(true);
    setCopyMenuError(null);
    setCopyMenuMessage(null);

    const payload = sourceEvent.menu_items.map((item) => ({
      event_id: copyTargetEventId,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      available: item.available,
      prep_time_minutes: item.prep_time_minutes,
      dietary_tags: item.dietary_tags,
      dine_in_only: item.dine_in_only ?? false,
      pickup_only: item.pickup_only ?? false,
    }));

    const { data, error } = await supabase
      .from("menu_items")
      .insert(payload)
      .select("id, event_id, name, description, price, category, available, prep_time_minutes, dietary_tags, dine_in_only, pickup_only");

    setCopyingMenu(false);

    if (error) {
      setCopyMenuError(error.message || "Could not copy menu items.");
      return;
    }

    const insertedItems = (data as MenuItemRow[]) ?? [];
    setEvents((prev) =>
      prev.map((e) =>
        e.id === copyTargetEventId
          ? { ...e, menu_items: [...insertedItems, ...e.menu_items] }
          : e
      )
    );
    setCopyMenuMessage(`Copied ${insertedItems.length} menu items successfully.`);
    closeCopyMenu();
  }

  async function handleToggleAvailable(item: MenuItemRow) {
    const { error } = await supabase
      .from("menu_items")
      .update({ available: !item.available })
      .eq("id", item.id);
    if (!error) {
      setEvents((prev) =>
        prev.map((e) => ({
          ...e,
          menu_items: e.menu_items.map((m) =>
            m.id === item.id ? { ...m, available: !m.available } : m
          ),
        }))
      );
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (!error) {
      setEvents((prev) =>
        prev.map((e) => ({
          ...e,
          menu_items: e.menu_items.filter((m) => m.id !== id),
        }))
      );
      setDeleteConfirmId(null);
    }
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
              Manage menu
            </h1>
          </div>
          {isSuperAdmin && locations.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="menu-location-switcher" className="text-sm text-blue-100">
                Location
              </label>
              <select
                id="menu-location-switcher"
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
        <div className="mx-auto max-w-4xl">
          {copyMenuMessage && (
            <p className="mb-4 rounded-lg bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-800">
              {copyMenuMessage}
            </p>
          )}
          {loading ? (
            <p className="text-center text-amber-200 py-8">Loading…</p>
          ) : !location ? (
            <div className="rounded-2xl border border-[#2d5a87] bg-white p-8">
              <p className="text-amber-800 bg-amber-100 rounded-lg px-4 py-3">
                Your account is not linked to a location yet. Please contact the administrator.
              </p>
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-2xl border border-[#2d5a87] bg-white p-8 text-center text-gray-600">
              No events found. Create an event first to add menu items.
            </div>
          ) : (
            <ul className="space-y-6">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="rounded-2xl border border-[#2d5a87] bg-white shadow-lg overflow-hidden"
                >
                  <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 sm:px-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-[#1e3a5f]">
                        {getLocationName(event)}
                      </h2>
                      <p className="text-sm text-gray-600">
                        {formatEventDate(event.event_date)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAdd(event.id)}
                      className="rounded-lg bg-[#c9a227] px-4 py-2 text-sm font-bold text-[#1e3a5f] hover:bg-[#d4af37]"
                    >
                      + Add item
                    </button>
                    <button
                      type="button"
                      onClick={() => openCopyMenu(event.id)}
                      className="rounded-lg border border-[#2d5a87] bg-white px-4 py-2 text-sm font-medium text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white"
                    >
                      Copy Menu
                    </button>
                  </div>
                  <div className="p-4 sm:p-5">
                    {event.menu_items.length === 0 ? (
                      <p className="text-sm text-gray-500 py-2">
                        No menu items. Click “Add item” to add one.
                      </p>
                    ) : (
                      <ul className="space-y-4">
                        {event.menu_items.map((item) => (
                          <li
                            key={item.id}
                            className="border border-gray-200 rounded-xl p-4 bg-gray-50/50"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-gray-900">
                                  {item.name}
                                </h3>
                                {item.description && (
                                  <p className="text-sm text-gray-600 mt-0.5">
                                    {item.description}
                                  </p>
                                )}
                                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                                  <span className="font-semibold text-[#1e3a5f]">
                                    {formatPrice(item.price)}
                                  </span>
                                  <span className="text-gray-500">
                                    · {item.category}
                                  </span>
                                  {item.prep_time_minutes != null && (
                                    <span className="text-gray-500">
                                      · {item.prep_time_minutes} min prep
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                      item.available
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {item.available ? "Available" : "Not Available"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleAvailable(item)
                                  }
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  {item.available ? "Mark as Not Available" : "Mark as Available"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEdit(item)}
                                  className="rounded-lg border border-[#2d5a87] bg-white px-3 py-1.5 text-xs font-medium text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white"
                                >
                                  Edit
                                </button>
                                {deleteConfirmId === item.id ? (
                                  <>
                                    <span className="text-xs text-red-600 self-center">
                                      Delete?
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(item.id)}
                                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"
                                    >
                                      No
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(item.id)}
                                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {modalOpen && formEventId && (
        <ItemFormModal
          eventId={formEventId}
          initialItem={editingItem}
          saving={saving}
          onSave={async (payload) => {
            setSaving(true);
            if (isEdit && editingItem) {
              const { error } = await supabase
                .from("menu_items")
                .update({
                  name: payload.name,
                  description: payload.description || null,
                  price: payload.price,
                  category: payload.category,
                  prep_time_minutes: payload.prep_time_minutes || null,
                  dietary_tags: payload.dietary_tags,
                  dine_in_only: payload.dine_in_only,
                  pickup_only: payload.pickup_only,
                })
                .eq("id", editingItem.id);
              if (!error) {
                setEvents((prev) =>
                  prev.map((e) => ({
                    ...e,
                    menu_items: e.menu_items.map((m) =>
                      m.id === editingItem.id
                        ? { ...m, ...payload }
                        : m
                    ),
                  }))
                );
                closeModal();
              }
            } else {
              const { data: newItem, error } = await supabase
                .from("menu_items")
                .insert({
                  event_id: formEventId,
                  name: payload.name,
                  description: payload.description || null,
                  price: payload.price,
                  category: payload.category,
                  prep_time_minutes: payload.prep_time_minutes || null,
                  dietary_tags: payload.dietary_tags,
                  dine_in_only: payload.dine_in_only,
                  pickup_only: payload.pickup_only,
                  available: true,
                })
                .select("id, event_id, name, description, price, category, available, prep_time_minutes, dietary_tags, dine_in_only, pickup_only")
                .single();
              if (!error && newItem) {
                setEvents((prev) =>
                  prev.map((e) =>
                    e.id === formEventId
                      ? {
                          ...e,
                          menu_items: [newItem as MenuItemRow, ...e.menu_items],
                        }
                      : e
                  )
                );
                closeModal();
              }
            }
            setSaving(false);
          }}
          onClose={closeModal}
        />
      )}

      {copySourceEventId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
              <h3 className="text-lg font-bold text-[#1e3a5f]">Copy Menu</h3>
              <p className="mt-1 text-sm text-gray-600">
                Copy all menu items from this event to another event.
              </p>
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              <div>
                <label htmlFor="copy-target-event" className="block text-sm font-medium text-gray-700">
                  Copy to event
                </label>
                <select
                  id="copy-target-event"
                  value={copyTargetEventId}
                  onChange={(e) => setCopyTargetEventId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                >
                  <option value="">Select event…</option>
                  {events
                    .filter((e) => e.id !== copySourceEventId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {formatEventDate(e.event_date)}
                      </option>
                    ))}
                </select>
              </div>
              {copyMenuError && (
                <p className="text-sm text-red-600" role="alert">
                  {copyMenuError}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeCopyMenu}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCopyMenu}
                  disabled={copyingMenu}
                  className="flex-1 rounded-xl bg-[#c9a227] px-4 py-2.5 text-sm font-bold text-[#1e3a5f] hover:bg-[#d4af37] disabled:opacity-70"
                >
                  {copyingMenu ? "Copying…" : "Copy Menu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type FormPayload = {
  name: string;
  description: string;
  price: string;
  category: string;
  prep_time_minutes: string;
  dietary_tags: string[];
};

function ItemFormModal({
  eventId,
  initialItem,
  saving,
  onSave,
  onClose,
}: {
  eventId: string;
  initialItem: MenuItemRow | null;
  saving: boolean;
  onSave: (payload: {
    name: string;
    description: string;
    price: number;
    category: string;
    prep_time_minutes: number | null;
    dietary_tags: string[];
    dine_in_only: boolean;
    pickup_only: boolean;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialItem?.name ?? "");
  const [description, setDescription] = useState(
    initialItem?.description ?? ""
  );
  const [price, setPrice] = useState(
    initialItem != null ? String(initialItem.price) : ""
  );
  const [category, setCategory] = useState(initialItem?.category ?? "fish");
  const [prepTime, setPrepTime] = useState(
    initialItem?.prep_time_minutes != null
      ? String(initialItem.prep_time_minutes)
      : ""
  );
  const [dietaryTags, setDietaryTags] = useState<string[]>(
    initialItem?.dietary_tags ?? []
  );
  const [dineInOnly, setDineInOnly] = useState(
    initialItem?.dine_in_only ?? false
  );
  const [pickupOnly, setPickupOnly] = useState(
    initialItem?.pickup_only ?? false
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numPrice = parseFloat(price);
    if (Number.isNaN(numPrice) || numPrice < 0) return;
    const numPrep = prepTime.trim() ? parseInt(prepTime, 10) : null;
    if (prepTime.trim() && (Number.isNaN(numPrep!) || numPrep! < 0)) return;
    onSave({
      name: name.trim(),
      description: description.trim() || "",
      price: numPrice,
      category: category.trim() || "other",
      prep_time_minutes: numPrep ?? null,
      dietary_tags: dietaryTags,
      dine_in_only: dineInOnly,
      pickup_only: pickupOnly,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5 sm:p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-[#1e3a5f]">
            {initialItem ? "Edit menu item" : "Add menu item"}
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <div>
            <label htmlFor="item-name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="item-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>
          <div>
            <label htmlFor="item-desc" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="item-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>
          <div>
            <label htmlFor="item-price" className="block text-sm font-medium text-gray-700">
              Price
            </label>
            <input
              id="item-price"
              type="number"
              step="0.01"
              min="0"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>
          <div>
            <label htmlFor="item-category" className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="item-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="item-prep" className="block text-sm font-medium text-gray-700">
              Prep time (minutes)
            </label>
            <input
              id="item-prep"
              type="number"
              min="0"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700">
              Availability
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Only one can be selected. If neither is selected, the item is available for both dine-in and pickup.
            </p>
            <div className="mt-2 flex gap-4">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={dineInOnly}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDineInOnly(checked);
                    if (checked) setPickupOnly(false);
                  }}
                  className="rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                />
                <span className="text-sm text-gray-700">Dine-in only</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pickupOnly}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setPickupOnly(checked);
                    if (checked) setDineInOnly(false);
                  }}
                  className="rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                />
                <span className="text-sm text-gray-700">Pickup only</span>
              </label>
            </div>
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700">Dietary tags</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DIETARY_TAG_OPTIONS.map((tag) => {
                const checked = dietaryTags.includes(tag);
                return (
                  <label
                    key={tag}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setDietaryTags((prev) =>
                          e.target.checked
                            ? [...prev, tag]
                            : prev.filter((t) => t !== tag)
                        );
                      }}
                      className="rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                    />
                    <span>{tag}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[#c9a227] py-2.5 text-sm font-bold text-[#1e3a5f] hover:bg-[#d4af37] disabled:opacity-70"
            >
              {saving ? "Saving…" : initialItem ? "Save" : "Add item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
