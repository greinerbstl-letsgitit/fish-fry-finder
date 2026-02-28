"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { notifyOrderReady } from "./actions";
import {
  checkIsSuperAdmin,
  getManagedLocations,
  type ManagedLocation,
} from "@/lib/admin-access";

type OrderItemRow = {
  id: string;
  item_name: string;
  item_price: number;
  quantity: number;
};

type OrderRow = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  order_type: string;
  notes: string | null;
  status: string;
  created_at: string;
  events: { event_date: string; locations: { name: string } | { name: string }[] } | null;
  order_items: OrderItemRow[];
};

const STATUS_OPTIONS = ["pending", "confirmed", "ready", "complete"];

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

function getLocationName(order: OrderRow): string {
  const ev = order.events;
  if (!ev) return "—";
  const loc = Array.isArray(ev.locations) ? ev.locations[0] : ev.locations;
  return (loc as { name?: string })?.name ?? "—";
}

function getEventDate(order: OrderRow): string {
  const ev = order.events;
  return ev?.event_date ? formatEventDate(ev.event_date) : "—";
}

type LocationRow = { id: string; name: string };

export default function AdminOrdersPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [locations, setLocations] = useState<ManagedLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [checking, setChecking] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
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
      setLoadingOrders(false);
      setOrders([]);
      return;
    }

    setLoadingOrders(true);
    supabase
      .from("events")
      .select("id")
      .eq("location_id", selectedLocationId)
      .then(({ data: eventRows, error: eventsError }) => {
        if (eventsError || !eventRows?.length) {
          setOrders([]);
          setLoadingOrders(false);
          return;
        }
        const eventIds = eventRows.map((e) => e.id);
        supabase
          .from("orders")
          .select(
            `
            id,
            customer_name,
            customer_phone,
            customer_email,
            order_type,
            notes,
            status,
            created_at,
            events (event_date, locations (name)),
            order_items (id, item_name, item_price, quantity)
          `
          )
          .in("event_id", eventIds)
          .order("created_at", { ascending: false })
          .then(({ data, error }) => {
            if (error) {
              console.error("Orders fetch error:", error);
              setOrders([]);
            } else {
              setOrders((data as unknown as OrderRow[]) ?? []);
            }
            setLoadingOrders(false);
          });
      });
  }, [selectedLocationId]);

  async function setStatus(orderId: string, newStatus: string, order: OrderRow) {
    setUpdatingId(orderId);

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      console.error("Order update error:", error);
      setUpdatingId(null);
      return;
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    if (newStatus === "ready" && order.customer_email?.trim()) {
      await notifyOrderReady(order.customer_email.trim(), getLocationName(order));
    }

    setUpdatingId(null);
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
              Orders
            </h1>
          </div>
          {isSuperAdmin && locations.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="orders-location-switcher" className="text-sm text-blue-100">
                Location
              </label>
              <select
                id="orders-location-switcher"
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
          {loadingOrders ? (
            <p className="text-center text-amber-200 py-8">Loading orders…</p>
          ) : !location ? (
            <div className="rounded-2xl border border-[#2d5a87] bg-white p-8">
              <p className="text-amber-800 bg-amber-100 rounded-lg px-4 py-3">
                Your account is not linked to a location yet. Please contact the administrator.
              </p>
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-[#2d5a87] bg-white p-8 text-center text-gray-600">
              No orders yet.
            </div>
          ) : (
            <ul className="space-y-4">
              {orders.map((order) => {
                const locationName = getLocationName(order);
                const eventDate = getEventDate(order);
                const isUpdating = updatingId === order.id;

                return (
                  <li
                    key={order.id}
                    className="rounded-2xl border border-[#2d5a87] bg-white shadow-lg overflow-hidden"
                  >
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-[#1e3a5f]">
                            {order.customer_name}
                          </h2>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {locationName} · {eventDate}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium capitalize ${
                            order.status === "ready"
                              ? "bg-amber-100 text-amber-800"
                              : order.status === "complete"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>

                      <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                        {order.customer_phone && (
                          <div>
                            <dt className="text-gray-500">Phone</dt>
                            <dd className="font-medium text-gray-900">
                              {order.customer_phone}
                            </dd>
                          </div>
                        )}
                        {order.customer_email && (
                          <div>
                            <dt className="text-gray-500">Email</dt>
                            <dd className="font-medium text-gray-900 break-all">
                              {order.customer_email}
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-gray-500">Order type</dt>
                          <dd className="font-medium text-gray-900 capitalize">
                            {order.order_type.replace("_", "-")}
                          </dd>
                        </div>
                      </dl>

                      {order.notes && (
                        <div className="mt-3">
                          <dt className="text-gray-500 text-sm">Notes</dt>
                          <dd className="text-gray-900 text-sm mt-0.5">
                            {order.notes}
                          </dd>
                        </div>
                      )}

                      {order.order_items?.length > 0 && (
                        <div className="mt-4 border-t border-gray-100 pt-4">
                          <h3 className="text-sm font-semibold text-[#1e3a5f] mb-2">
                            Items
                          </h3>
                          <ul className="space-y-1 text-sm">
                            {order.order_items.map((item) => (
                              <li
                                key={item.id}
                                className="flex justify-between text-gray-700"
                              >
                                <span>
                                  {item.item_name} × {item.quantity}
                                </span>
                                <span className="font-medium">
                                  {formatPrice(item.item_price * item.quantity)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-5 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">
                          Update status
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {STATUS_OPTIONS.map((status) => (
                            <button
                              key={status}
                              type="button"
                              disabled={isUpdating}
                              onClick={() => setStatus(order.id, status, order)}
                              className={`rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
                                order.status === status
                                  ? "bg-[#1e3a5f] text-white"
                                  : "bg-gray-100 text-gray-700 hover:bg-[#2d5a87] hover:text-white"
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
