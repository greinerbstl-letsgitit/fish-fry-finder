import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export type OrderConfirmationData = {
  locationName: string;
  eventDate: string;
  items: { name: string; quantity: number; item_price: number }[];
  total: number;
  estimatedWaitMinutes?: number;
  pickupTime?: string | null;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(price);
}

export async function sendOrderConfirmation(
  to: string,
  data: OrderConfirmationData
) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set; skipping order confirmation email");
    return { ok: false as const, error: "Email not configured" };
  }

  const itemsHtml = data.items
    .map(
      (item) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(item.name)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${formatPrice(item.item_price * item.quantity)}</td></tr>`
    )
    .join("");

  const totalHtml = `<tr><td colspan="2" style="padding:12px;font-weight:bold">Total</td><td style="padding:12px;text-align:right;font-weight:bold">${formatPrice(data.total)}</td></tr>`;

  const waitTimeHtml =
    data.estimatedWaitMinutes != null
      ? `<p style="margin:16px 0;color:#333">Estimated wait time: <strong>${data.estimatedWaitMinutes} minutes</strong></p>`
      : "";

  const pickupTimeHtml =
    data.pickupTime
      ? `<p style="margin:16px 0;color:#333">Preferred pickup time: <strong>${escapeHtml(data.pickupTime)}</strong></p>`
      : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333;line-height:1.5">
  <h1 style="font-size:1.5rem;color:#1e3a5f;margin-bottom:8px">Order confirmed</h1>
  <p style="margin:0 0 24px;color:#555">Thanks for your order!</p>
  <p style="margin:0 0 8px"><strong>${escapeHtml(data.locationName)}</strong></p>
  <p style="margin:0 0 24px;color:#555">${escapeHtml(data.eventDate)}</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="padding:10px 12px;text-align:left;font-size:0.875rem">Item</th>
        <th style="padding:10px 12px;text-align:center;font-size:0.875rem">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-size:0.875rem">Price</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
      ${totalHtml}
    </tbody>
  </table>
  ${waitTimeHtml}
  ${pickupTimeHtml}
  <p style="margin:24px 0 0;padding:16px;background:#f8f9fa;border-radius:8px;color:#333">Payment is due in person when you pick up or dine in. Please have your payment ready.</p>
</body>
</html>
`.trim();

  const { data: result, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [to],
    subject: `Order confirmed — ${data.locationName}`,
    html,
  });

  if (error) {
    console.error("Resend sendOrderConfirmation error:", error);
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const, id: result?.id };
}

export async function sendOrderReady(to: string, locationName: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set; skipping order ready email");
    return { ok: false as const, error: "Email not configured" };
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333;line-height:1.5">
  <h1 style="font-size:1.5rem;color:#1e3a5f;margin-bottom:16px">Your order is ready!</h1>
  <p style="margin:0 0 16px">Your order from <strong>${escapeHtml(locationName)}</strong> is ready for pickup!</p>
  <p style="margin:0;padding:16px;background:#f0fdf4;border-radius:8px;color:#166534">Please proceed to the pickup area and have your payment ready.</p>
</body>
</html>
`.trim();

  const { data: result, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [to],
    subject: `Your order from ${locationName} is ready for pickup`,
    html,
  });

  if (error) {
    console.error("Resend sendOrderReady error:", error);
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const, id: result?.id };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
