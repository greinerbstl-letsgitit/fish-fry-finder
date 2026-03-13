"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendClaimRequestAlert } from "@/lib/email";

const ROLE_LABELS: Record<string, string> = {
  pastor: "Pastor",
  fish_fry_coordinator: "Fish Fry Coordinator",
  parish_staff: "Parish Staff",
  volunteer: "Volunteer",
  other: "Other",
};

export async function submitClaimRequest(data: {
  locationId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  message: string;
  locationName: string;
}) {
  if (!supabaseAdmin) {
    console.error("[submitClaimRequest] supabaseAdmin not configured");
    return { ok: false as const, error: "Server misconfigured" };
  }
  const { error } = await supabaseAdmin.from("claim_requests").insert({
    location_id: data.locationId,
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    message: data.message || null,
    status: "pending",
  });

  if (error) {
    console.error("[submitClaimRequest] Supabase error:", error);
    return { ok: false as const, error: error.message };
  }

  const roleLabel = ROLE_LABELS[data.role] ?? data.role;
  await sendClaimRequestAlert({
    locationName: data.locationName,
    claimantName: data.name,
    claimantEmail: data.email,
    claimantPhone: data.phone,
    role: roleLabel,
    message: data.message,
  });

  return { ok: true as const };
}
