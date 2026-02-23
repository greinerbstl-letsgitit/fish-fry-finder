"use server";

import { sendOrderReady } from "@/lib/email";

export async function notifyOrderReady(customerEmail: string, locationName: string) {
  if (!customerEmail?.trim()) {
    return { ok: false as const, error: "No customer email" };
  }
  return sendOrderReady(customerEmail.trim(), locationName);
}
