"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { placeOrder } from "./actions";
import type { EntreeSideRow } from "./types";

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
  purchasable_individually?: boolean;
};

type EventData = {
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  dine_in: boolean;
  pickup: boolean;
};

type CartItem = {
  id: string;
  menu_item_id: string;
  item_name: string;
  item_price: number;
  selected_side_ids?: string[];
};

const CATEGORY_ORDER = ["entree", "sides", "drinks", "desserts"];

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

function generateId() {
  return crypto.randomUUID?.() ?? `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type Props = {
  eventId: string;
  locationName: string;
  event: EventData;
  menuItems: MenuItem[];
  entreeSides?: EntreeSideRow[];
};

export function OrderForm({ eventId, locationName, event, menuItems, entreeSides = [] }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [orderType, setOrderType] = useState<"dine_in" | "pickup">(
    event.dine_in ? "dine_in" : "pickup"
  );
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [entreeSideModal, setEntreeSideModal] = useState<{
    entreeItem: MenuItem;
    pendingCartId: string | null;
    editingCartId: string | null;
    selectedSideCounts: Record<string, number>;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    orderId: string;
    total: number;
    customer_name: string;
    order_type: string;
    lineItems: { name: string; qty: number; unitPrice: number; sideNames?: string[] }[];
    estimatedWaitMinutes?: number;
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  function showToast(message: string) {
    setToast(message);
  }

  const filteredMenuItems = menuItems.filter((item) => {
    const dineIn = item.dine_in_only ?? false;
    const pickup = item.pickup_only ?? false;
    if (orderType === "dine_in") return !pickup;
    return !dineIn;
  });

  const sideItemIds = new Set(entreeSides.map((r) => r.side_item_id));

  const entreeSidesByEntree = (() => {
    const map = new Map<
      string,
      { maxSides: number; sides: { id: string; name: string; extraCharge: number }[] }
    >();
    const menuById = new Map(menuItems.map((m) => [m.id, m]));
    entreeSides.forEach((row) => {
      const sideItem = menuById.get(row.side_item_id);
      if (!sideItem) return;
      const existing = map.get(row.entree_item_id);
      const side = {
        id: row.side_item_id,
        name: sideItem.name,
        extraCharge: Number(row.extra_charge) || 0,
      };
      if (existing) {
        if (!existing.sides.some((s) => s.id === side.id)) existing.sides.push(side);
      } else {
        map.set(row.entree_item_id, {
          maxSides: Math.min(2, Math.max(0, row.max_sides ?? 0)),
          sides: [side],
        });
      }
    });
    return map;
  })();

  const getPrice = (item: MenuItem) =>
    typeof item.price === "string" ? parseFloat(item.price) : item.price;

  const isSideItem = (item: MenuItem) => sideItemIds.has(item.id);
  const canAddDirectly = (item: MenuItem) => {
    if (item.category === "entree") return true;
    if (isSideItem(item)) return item.purchasable_individually ?? false;
    return true;
  };

  const byCategory = filteredMenuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
  const categories = sortCategories(Object.keys(byCategory));

  const cartTotal = cart.reduce((sum, ci) => {
    let itemTotal = ci.item_price;
    if (ci.selected_side_ids && ci.selected_side_ids.length > 0) {
      const config = entreeSidesByEntree.get(ci.menu_item_id);
      if (config) {
        ci.selected_side_ids.forEach((sid) => {
          const side = config.sides.find((s) => s.id === sid);
          if (side) itemTotal += side.extraCharge;
        });
      }
    }
    return sum + itemTotal;
  }, 0);

  const prepTimes = cart.flatMap((ci) => {
    const m = menuItems.find((x) => x.id === ci.menu_item_id);
    return m?.prep_time_minutes ?? 0;
  }).filter((m): m is number => typeof m === "number" && m > 0);
  const estimatedWaitMinutes = prepTimes.length > 0 ? Math.max(...prepTimes) : undefined;

  function handleAddItem(item: MenuItem) {
    const config = entreeSidesByEntree.get(item.id);
    if (config && config.maxSides > 0) {
      setEntreeSideModal({
        entreeItem: item,
        pendingCartId: generateId(),
        editingCartId: null,
        selectedSideCounts: {},
      });
    } else {
      setCart((prev) => [
        ...prev,
        {
          id: generateId(),
          menu_item_id: item.id,
          item_name: item.name,
          item_price: getPrice(item),
        },
      ]);
      showToast(`Added to order: ${item.name}`);
    }
  }

  function getEntreeModalSides(entreeId: string) {
    const filteredRows = entreeSides.filter((r) => r.entree_item_id === entreeId);
    const menuById = new Map(menuItems.map((m) => [m.id, m]));
    const sides = filteredRows
      .map((row) => {
        const sideMenuItem = menuById.get(row.side_item_id);
        return sideMenuItem
          ? { id: row.side_item_id, name: sideMenuItem.name, extraCharge: Number(row.extra_charge) || 0 }
          : null;
      })
      .filter((s): s is { id: string; name: string; extraCharge: number } => s != null);
    console.log("[getEntreeModalSides] Final resolved sides array:", sides);
    const maxSides = filteredRows[0] ? Math.min(2, Math.max(0, filteredRows[0].max_sides ?? 0)) : 0;
    return { sides, maxSides };
  }

  function handleConfirmEntreeSides() {
    if (!entreeSideModal) return;
    const { entreeItem, pendingCartId, editingCartId, selectedSideCounts } = entreeSideModal;
    const { maxSides } = getEntreeModalSides(entreeItem.id);
    const totalSelected = Object.values(selectedSideCounts).reduce((sum, n) => sum + n, 0);
    if (totalSelected !== maxSides) return;

    const selectedSideIds = Object.entries(selectedSideCounts).flatMap(([id, count]) =>
      Array(count).fill(id)
    );

    if (editingCartId) {
      setCart((prev) =>
        prev.map((c) =>
          c.id === editingCartId
            ? { ...c, selected_side_ids: selectedSideIds }
            : c
        )
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          id: pendingCartId!,
          menu_item_id: entreeItem.id,
          item_name: entreeItem.name,
          item_price: getPrice(entreeItem),
          selected_side_ids: selectedSideIds,
        },
      ]);
      showToast(`Added to order: ${entreeItem.name}`);
    }
    setEntreeSideModal(null);
  }

  function handleEditSides(cartItem: CartItem) {
    const entreeItem = menuItems.find((m) => m.id === cartItem.menu_item_id);
    if (!entreeItem) return;
    const counts: Record<string, number> = {};
    (cartItem.selected_side_ids ?? []).forEach((sid) => {
      counts[sid] = (counts[sid] ?? 0) + 1;
    });
    setEntreeSideModal({
      entreeItem,
      pendingCartId: null,
      editingCartId: cartItem.id,
      selectedSideCounts: counts,
    });
  }

  function handleRemoveFromCart(cartId: string) {
    setCart((prev) => prev.filter((c) => c.id !== cartId));
  }

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
    if (cart.length === 0) {
      setSubmitError("Your cart is empty. Add items before placing your order.");
      return;
    }
    setSubmitting(true);

    const items: { menu_item_id: string; quantity: number; item_name: string; item_price: number }[] = [];
    cart.forEach((ci) => {
      items.push({
        menu_item_id: ci.menu_item_id,
        quantity: 1,
        item_name: ci.item_name,
        item_price: ci.item_price,
      });
      if (ci.selected_side_ids && ci.selected_side_ids.length > 0) {
        const config = entreeSidesByEntree.get(ci.menu_item_id);
        if (config) {
          ci.selected_side_ids.forEach((sideId) => {
            const side = config.sides.find((s) => s.id === sideId);
            if (side) {
              items.push({
                menu_item_id: sideId,
                quantity: 1,
                item_name: side.name,
                item_price: side.extraCharge,
              });
            }
          });
        }
      }
    });

    const result = await placeOrder(
      eventId,
      {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim(),
        order_type: orderType,
        notes: notes.trim(),
        estimatedWaitMinutes,
      },
      items
    );

    setSubmitting(false);
    if (result.success && result.order) {
      const lineItems = cart.flatMap((ci) => {
        const rows: { name: string; qty: number; unitPrice: number }[] = [
          { name: ci.item_name, qty: 1, unitPrice: ci.item_price },
        ];
        if (ci.selected_side_ids && ci.selected_side_ids.length > 0) {
          const config = entreeSidesByEntree.get(ci.menu_item_id);
          if (config) {
            ci.selected_side_ids.forEach((sid) => {
              const side = config.sides.find((s) => s.id === sid);
              if (side) rows.push({ name: side.name, qty: 1, unitPrice: side.extraCharge });
            });
          }
        }
        return rows;
      });
      setConfirmation({
        orderId: result.order.id,
        total: cartTotal,
        customer_name: result.order.customer_name,
        order_type: orderType,
        lineItems,
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
          <div>
            <p className="text-gray-600">
              You will receive an email notification when your order is ready. Estimated wait time is based on your selected items.
            </p>
          </div>
          {confirmation.estimatedWaitMinutes != null && (
            <div className="mt-3 p-3 rounded-lg bg-[#1e3a5f]/10">
              <dt className="font-medium text-gray-500">Estimated wait time</dt>
              <dd className="text-lg font-bold text-[#1e3a5f]">
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
                      {li.sideNames && li.sideNames.length > 0 && (
                        <span className="block text-xs text-gray-500 mt-0.5">
                          {li.sideNames.join(", ")}
                        </span>
                      )}
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
    <>
      {toast && (
        <div
          className="fixed bottom-6 left-4 right-4 z-40 mx-auto max-w-md rounded-xl bg-[#1e3a5f] px-4 py-3 text-center font-medium text-[#c9a227] shadow-lg animate-[slideUp_0.3s_ease-out]"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
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

      {/* Order type */}
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
      </section>

      {/* Menu */}
      <section className="rounded-2xl border border-[#2d5a87] bg-white p-5 shadow-lg sm:p-6">
        <h3 className="text-lg font-bold text-[#1e3a5f]">Menu</h3>
        <p className="mt-1 text-sm text-gray-600">
          Click + to add items to your order.
        </p>
        <div className="mt-4 space-y-5">
          {categories.map((category) => (
            <div key={category}>
              <h4 className="text-sm font-bold uppercase tracking-wide text-gray-500">
                {category}
              </h4>
              <ul className="mt-2 space-y-3">
                {byCategory[category].map((item) => {
                  const unitPrice = getPrice(item);
                  const showPlusButton = canAddDirectly(item);
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
                      {showPlusButton && (
                        <div className="sm:shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAddItem(item)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-medium text-gray-700 transition hover:bg-gray-50"
                            aria-label="Add to order"
                          >
                            +
                          </button>
                        </div>
                      )}
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

      {/* Your Order - Cart */}
      <section className="rounded-2xl border border-[#2d5a87] bg-white p-5 shadow-lg sm:p-6">
        <h3 className="text-lg font-bold text-[#1e3a5f]">Your Order</h3>
        {cart.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Your cart is empty. Add items from the menu above.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {cart.map((ci) => {
              const config = entreeSidesByEntree.get(ci.menu_item_id);
              const hasSides = config && (ci.selected_side_ids?.length ?? 0) > 0;
              const sideNames = hasSides
                ? (ci.selected_side_ids ?? [])
                    .map((sid) => config!.sides.find((s) => s.id === sid)?.name)
                    .filter(Boolean)
                : [];
              const itemTotal = ci.item_price + (hasSides
                ? (ci.selected_side_ids ?? []).reduce((sum, sid) => {
                    const side = config!.sides.find((s) => s.id === sid);
                    return sum + (side?.extraCharge ?? 0);
                  }, 0)
                : 0);
              return (
                <li
                  key={ci.id}
                  className="flex flex-col gap-1 rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{ci.item_name}</p>
                      {sideNames.length > 0 && (
                        <p className="mt-0.5 text-xs text-gray-600">
                          {sideNames.join(", ")}
                        </p>
                      )}
                      <p className="text-sm font-semibold text-[#1e3a5f]">
                        {formatPrice(itemTotal)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {config && config.maxSides > 0 && (
                        <button
                          type="button"
                          onClick={() => handleEditSides(ci)}
                          className="rounded-lg border border-[#2d5a87] px-2 py-1 text-xs font-medium text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white"
                        >
                          Edit Sides
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(ci.id)}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between text-lg font-bold text-[#1e3a5f]">
            <span>Total</span>
            <span className="text-xl">{formatPrice(cartTotal)}</span>
          </div>
        </div>
        {estimatedWaitMinutes != null && (
          <p className="mt-2 text-lg font-semibold text-[#1e3a5f]">
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
          disabled={submitting || cart.length === 0}
          className="mt-4 w-full rounded-xl bg-[#c9a227] px-6 py-4 text-lg font-bold uppercase tracking-wide text-[#1e3a5f] shadow-md transition hover:bg-[#d4af37] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed active:bg-[#b8941f]"
        >
          {submitting ? "Placing order…" : "Place Order"}
        </button>
      </section>
    </form>

      {/* Entree sides modal */}
      {entreeSideModal && (() => {
        const { maxSides, sides } = getEntreeModalSides(entreeSideModal.entreeItem.id);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-5">
            <h3 className="text-lg font-bold text-[#1e3a5f]">
              {entreeSideModal.editingCartId ? "Edit sides" : entreeSideModal.entreeItem.name}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {maxSides === 1
                ? "Choose 1 side"
                : `Choose ${maxSides} sides`}
            </p>
            {(() => {
              const totalSelected = Object.values(entreeSideModal.selectedSideCounts).reduce((sum, n) => sum + n, 0);
              return (
                <p className="mt-1 text-sm font-medium text-[#1e3a5f]">
                  {totalSelected} of {maxSides} side{maxSides !== 1 ? "s" : ""} selected
                </p>
              );
            })()}
            <div className="mt-4 space-y-2">
              {sides.map((side) => {
                const count = entreeSideModal.selectedSideCounts[side.id] ?? 0;
                const totalSelected = Object.values(entreeSideModal.selectedSideCounts).reduce((sum, n) => sum + n, 0);
                const canAdd = totalSelected < maxSides;
                return (
                  <div
                    key={side.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1">{side.name}</span>
                    {side.extraCharge > 0 && (
                      <span className="shrink-0 font-semibold text-[#b8941f]">
                        +{formatPrice(side.extraCharge)}
                      </span>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (!canAdd) return;
                          setEntreeSideModal((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  selectedSideCounts: {
                                    ...prev.selectedSideCounts,
                                    [side.id]: (prev.selectedSideCounts[side.id] ?? 0) + 1,
                                  },
                                }
                              : null
                          );
                        }}
                        disabled={!canAdd}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Add ${side.name}`}
                      >
                        +
                      </button>
                      {count > 0 && (
                        <>
                          <span className="min-w-[1.25rem] text-center font-medium text-[#1e3a5f]">
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEntreeSideModal((prev) => {
                                if (!prev) return null;
                                const current = prev.selectedSideCounts[side.id] ?? 0;
                                if (current <= 1) {
                                  const next = { ...prev.selectedSideCounts };
                                  delete next[side.id];
                                  return { ...prev, selectedSideCounts: next };
                                }
                                return {
                                  ...prev,
                                  selectedSideCounts: {
                                    ...prev.selectedSideCounts,
                                    [side.id]: current - 1,
                                  },
                                };
                              });
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-medium text-gray-700 transition hover:bg-gray-50"
                            aria-label={`Remove ${side.name}`}
                          >
                            −
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setEntreeSideModal(null)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEntreeSides}
                disabled={
                  Object.values(entreeSideModal.selectedSideCounts).reduce((sum, n) => sum + n, 0) !== maxSides
                }
                className="flex-1 rounded-xl bg-[#c9a227] px-4 py-2.5 text-sm font-bold text-[#1e3a5f] hover:bg-[#d4af37] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </>
  );
}
