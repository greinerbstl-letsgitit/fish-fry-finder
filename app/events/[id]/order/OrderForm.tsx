"use client";

import Link from "next/link";
import { useState } from "react";
import { placeOrder } from "./actions";

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
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

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  category: string;
  prep_time_minutes?: number | null;
  dietary_tags?: string[] | null;
  dine_in_only?: boolean;
  pickup_only?: boolean;
};

type EventData = {
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  dine_in: boolean;
  pickup: boolean;
};

type LocationData = {
  name: string;
};

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

type Props = {
  eventId: string;
  locationName: string;
  event: EventData;
  menuItems: MenuItem[];
};

export function OrderForm({ eventId, locationName, event, menuItems }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [orderType, setOrderType] = useState<"dine_in" | "pickup">(
    event.dine_in ? "dine_in" : "pickup"
  );
  const [preferredPickupTime, setPreferredPickupTime] = useState("");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    orderId: string;
    total: number;
    customer_name: string;
    order_type: string;
    pickup_time: string;
    lineItems: { name: string; qty: number; unitPrice: number }[];
    estimatedWaitMinutes?: number;
  } | null>(null);

  const setQuantity = (itemId: string, delta: number) => {
    setQuantities((prev) => {
      const next = (prev[itemId] ?? 0) + delta;
      return { ...prev, [itemId]: Math.max(0, next) };
    });
  };

  const filteredMenuItems = menuItems.filter((item) => {
    const dineIn = item.dine_in_only ?? false;
    const pickup = item.pickup_only ?? false;
    if (orderType === "dine_in") return !pickup;
    return !dineIn;
  });

  const byCategory = filteredMenuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
  const categories = sortCategories(Object.keys(byCategory));

  const getPrice = (item: MenuItem) =>
    typeof item.price === "string" ? parseFloat(item.price) : item.price;

  let total = 0;
  const lineItems: { item: MenuItem; qty: number; unitPrice: number }[] = [];
  filteredMenuItems.forEach((item) => {
    const qty = quantities[item.id] ?? 0;
    if (qty > 0) {
      const unitPrice = getPrice(item);
      total += unitPrice * qty;
      lineItems.push({ item, qty, unitPrice });
    }
  });

  const prepTimes = lineItems
    .map(({ item }) => item.prep_time_minutes)
    .filter((m): m is number => typeof m === "number" && m > 0);
  const estimatedWaitMinutes =
    prepTimes.length > 0 ? Math.max(...prepTimes) : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!name.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }
    if (!email.trim()) {
      setSubmitError("Please enter your email.");
      return;
    }
    setSubmitting(true);
    const items = filteredMenuItems
      .filter((m) => (quantities[m.id] ?? 0) > 0)
      .map((m) => ({
        menu_item_id: m.id,
        quantity: quantities[m.id] ?? 0,
        item_name: m.name,
        item_price: getPrice(m),
      }));

    const result = await placeOrder(
      eventId,
      {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim(),
        order_type: orderType,
        pickup_time: preferredPickupTime.trim(),
        notes: notes.trim(),
        estimatedWaitMinutes,
      },
      items
    );

    setSubmitting(false);
    if (result.success && result.order) {
      setConfirmation({
        orderId: result.order.id,
        total,
        customer_name: result.order.customer_name,
        order_type: orderType,
        pickup_time: preferredPickupTime.trim(),
        lineItems: lineItems.map(({ item, qty, unitPrice }) => ({
          name: item.name,
          qty,
          unitPrice,
        })),
        estimatedWaitMinutes,
      });
    } else {
      setSubmitError(result.error ?? "Something went wrong. Please try again.");
    }
  }

  if (confirmation) {
    return (
      <div className="rounded-2xl border border-[#2d5a87] bg-white p-6 shadow-lg sm:p-8">
        <h2 className="text-2xl font-bold text-[#1e3a5f]">
          Your order has been received!
        </h2>
        <p className="mt-2 text-gray-600">
          Please pay in person when you arrive.
        </p>
        <dl className="mt-6 space-y-2 text-sm">
          <div>
            <dt className="font-medium text-gray-500">Order for</dt>
            <dd className="text-gray-900">{confirmation.customer_name}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Order type</dt>
            <dd className="text-gray-900 capitalize">
              {confirmation.order_type.replace("_", "-")}
            </dd>
          </div>
          {confirmation.pickup_time && (
            <div>
              <dt className="font-medium text-gray-500">Preferred pickup time</dt>
              <dd className="text-gray-900">{confirmation.pickup_time}</dd>
            </div>
          )}
          {confirmation.estimatedWaitMinutes != null && (
            <div>
              <dt className="font-medium text-gray-500">Estimated wait time</dt>
              <dd className="text-gray-900">
                {confirmation.estimatedWaitMinutes} minutes
              </dd>
            </div>
          )}
          {confirmation.lineItems.length > 0 && (
            <div>
              <dt className="font-medium text-gray-500">Items</dt>
              <dd className="mt-1">
                <ul className="space-y-1 text-gray-900">
                  {confirmation.lineItems.map((li, i) => (
                    <li key={i}>
                      {li.name} × {li.qty} — {formatPrice(li.unitPrice * li.qty)}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          <div>
            <dt className="font-medium text-gray-500">Total</dt>
            <dd className="text-lg font-bold text-[#1e3a5f]">
              {formatPrice(confirmation.total)}
            </dd>
          </div>
        </dl>
        <Link
          href="/"
          className="mt-8 inline-block rounded-xl bg-[#1e3a5f] px-6 py-3 font-semibold text-white transition hover:bg-[#16324a]"
        >
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Contact */}
      <section className="rounded-2xl border border-[#2d5a87] bg-white p-5 shadow-lg sm:p-6">
        <h3 className="text-lg font-bold text-[#1e3a5f]">Your information</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name <span className="text-red-600">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
              placeholder="you@example.com"
            />
          </div>
        </div>
      </section>

      {/* Order type & pickup time */}
      <section className="rounded-2xl border border-[#2d5a87] bg-white p-5 shadow-lg sm:p-6">
        <h3 className="text-lg font-bold text-[#1e3a5f]">Order type</h3>
        <div className="mt-4 flex flex-wrap gap-4">
          {event.dine_in && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="orderType"
                value="dine_in"
                checked={orderType === "dine_in"}
                onChange={() => setOrderType("dine_in")}
                className="h-4 w-4 border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]"
              />
              <span className="text-gray-700">Dine-in</span>
            </label>
          )}
          {event.pickup && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="orderType"
                value="pickup"
                checked={orderType === "pickup"}
                onChange={() => setOrderType("pickup")}
                className="h-4 w-4 border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f]"
              />
              <span className="text-gray-700">Pickup</span>
            </label>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Menu options may vary between dine-in and pickup.
        </p>
        {orderType === "pickup" && (
          <div className="mt-4">
            <label
              htmlFor="pickupTime"
              className="block text-sm font-medium text-gray-700"
            >
              Preferred pickup time
            </label>
            <input
              id="pickupTime"
              type="text"
              value={preferredPickupTime}
              onChange={(e) => setPreferredPickupTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
              placeholder="e.g. 5:00 PM"
            />
          </div>
        )}
      </section>

      {/* Menu items with quantity */}
      <section className="rounded-2xl border border-[#2d5a87] bg-white p-5 shadow-lg sm:p-6">
        <h3 className="text-lg font-bold text-[#1e3a5f]">Menu</h3>
        <p className="mt-1 text-sm text-gray-600">
          Use + and − to choose quantities.
        </p>
        <div className="mt-4 space-y-5">
          {categories.map((category) => (
            <div key={category}>
              <h4 className="text-sm font-bold uppercase tracking-wide text-gray-500">
                {category}
              </h4>
              <ul className="mt-2 space-y-3">
                {byCategory[category].map((item) => {
                  const qty = quantities[item.id] ?? 0;
                  const unitPrice = getPrice(item);
                  return (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 border-b border-gray-100 pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-gray-600">{item.description}</p>
                        )}
                        {Array.isArray(item.dietary_tags) &&
                          item.dietary_tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {item.dietary_tags.map((tag) => (
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
                        <p className="text-sm font-semibold text-[#1e3a5f]">
                          {formatPrice(unitPrice)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:shrink-0">
                        <button
                          type="button"
                          onClick={() => setQuantity(item.id, -1)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-medium text-gray-700 transition hover:bg-gray-50"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span
                          className="min-w-[2rem] text-center font-medium text-gray-900"
                          aria-live="polite"
                        >
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(item.id, 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-medium text-gray-700 transition hover:bg-gray-50"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section className="rounded-2xl border border-[#2d5a87] bg-white p-5 shadow-lg sm:p-6">
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-gray-700"
        >
          Special notes
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]"
          placeholder="Allergies, special requests, etc."
        />
      </section>

      {/* Total & Submit */}
      <section className="rounded-2xl border border-[#2d5a87] bg-white p-5 shadow-lg sm:p-6">
        <div className="flex items-center justify-between text-lg font-bold text-[#1e3a5f]">
          <span>Order total</span>
          <span className="text-xl">{formatPrice(total)}</span>
        </div>
        {estimatedWaitMinutes != null && (
          <p className="mt-2 text-gray-600">
            Estimated wait time: {estimatedWaitMinutes} minutes
          </p>
        )}
        {submitError && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {submitError}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded-xl bg-[#c9a227] px-6 py-4 text-lg font-bold uppercase tracking-wide text-[#1e3a5f] shadow-md transition hover:bg-[#d4af37] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed active:bg-[#b8941f]"
        >
          {submitting ? "Placing order…" : "Place Order"}
        </button>
      </section>
    </form>
  );
}
