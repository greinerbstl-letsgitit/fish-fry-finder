"use server";

import { supabase } from "@/lib/supabase";
import { sendOrderConfirmation } from "@/lib/email";

type OrderData = {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  order_type: "dine_in" | "pickup";
  pickup_time: string;
  notes: string;
  estimatedWaitMinutes?: number;
};

type OrderItemInput = {
  menu_item_id: string;
  quantity: number;
  item_name: string;
  item_price: number;
};

export async function placeOrder(
  eventId: string,
  orderData: OrderData,
  items: OrderItemInput[]
) {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      event_id: eventId,
      customer_name: orderData.customer_name.trim(),
      customer_phone: orderData.customer_phone.trim() || null,
      customer_email: orderData.customer_email.trim() || null,
      order_type: orderData.order_type,
      pickup_time: orderData.pickup_time.trim() || null,
      notes: orderData.notes.trim() || null,
      status: "pending",
    })
    .select("id, customer_name")
    .single();

  if (orderError || !order) {
    console.error("Order insert error:", orderError);
    return { success: false as const, error: orderError?.message ?? "Failed to create order" };
  }

  const orderItems = items
    .filter((i) => i.quantity > 0)
    .map((i) => ({
      order_id: order.id,
      menu_item_id: i.menu_item_id,
      quantity: i.quantity,
      item_name: i.item_name,
      item_price: i.item_price,
    }));

  if (orderItems.length > 0) {
    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Order items insert error:", itemsError);
      return { success: false as const, error: itemsError.message };
    }
  }

  const customerEmail = orderData.customer_email.trim();
  if (customerEmail) {
    const { data: eventRow } = await supabase
      .from("events")
      .select("event_date, locations (name)")
      .eq("id", eventId)
      .single();

    const location = eventRow?.locations
      ? (Array.isArray(eventRow.locations) ? eventRow.locations[0] : eventRow.locations)
      : null;
    const locationName = (location as { name?: string } | null)?.name ?? "Fish Fry";
    const eventDate = eventRow?.event_date
      ? new Date(eventRow.event_date + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "";

    const orderItemsForEmail = items.filter((i) => i.quantity > 0);
    const total = orderItemsForEmail.reduce(
      (sum, i) => sum + i.quantity * i.item_price,
      0
    );

    await sendOrderConfirmation(customerEmail, {
      locationName,
      eventDate,
      items: orderItemsForEmail.map((i) => ({
        name: i.item_name,
        quantity: i.quantity,
        item_price: i.item_price,
      })),
      total,
      estimatedWaitMinutes: orderData.estimatedWaitMinutes,
      pickupTime: orderData.pickup_time.trim() || null,
    });
  }

  return {
    success: true as const,
    order: {
      id: order.id,
      customer_name: order.customer_name,
    },
  };
}
