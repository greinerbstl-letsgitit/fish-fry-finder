"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendApprovalConfirmation } from "@/lib/email";
import { checkIsSuperAdmin } from "@/lib/admin-access";

export async function approveLocation(
  locationId: string,
  contactEmail: string | null,
  locationName: string,
  userId: string
) {
  console.log("[approveLocation] called", { locationId, contactEmail, locationName, userId });

  const isSuperAdmin = await checkIsSuperAdmin(userId);
  if (!isSuperAdmin) {
    console.log("[approveLocation] denied: not super admin");
    return { ok: false as const, error: "Unauthorized" };
  }

  if (!supabaseAdmin) {
    console.error("[approveLocation] supabaseAdmin is null - SUPABASE_SERVICE_ROLE_KEY not set");
    return { ok: false as const, error: "Server misconfigured: admin client unavailable" };
  }

  const { data, error } = await supabaseAdmin
    .from("locations")
    .update({ approved: true })
    .eq("id", locationId)
    .select("id");

  console.log("[approveLocation] Supabase update response", { data, error, rowsAffected: data?.length });

  if (error) {
    console.error("[approveLocation] Supabase error:", error);
    return { ok: false as const, error: error.message };
  }

  if (!data || data.length === 0) {
    console.warn("[approveLocation] No rows updated - location may not exist or RLS blocked");
    return { ok: false as const, error: "Location not found or update failed" };
  }

  if (contactEmail?.trim()) {
    await sendApprovalConfirmation(contactEmail.trim(), locationName);
  }

  console.log("[approveLocation] success");
  return { ok: true as const };
}

export async function rejectLocation(
  locationId: string,
  userId: string
) {
  console.log("[rejectLocation] called", { locationId, userId });

  const isSuperAdmin = await checkIsSuperAdmin(userId);
  if (!isSuperAdmin) {
    console.log("[rejectLocation] denied: not super admin");
    return { ok: false as const, error: "Unauthorized" };
  }

  if (!supabaseAdmin) {
    console.error("[rejectLocation] supabaseAdmin is null - SUPABASE_SERVICE_ROLE_KEY not set");
    return { ok: false as const, error: "Server misconfigured: admin client unavailable" };
  }

  const { data: location, error: fetchError } = await supabaseAdmin
    .from("locations")
    .select("user_id")
    .eq("id", locationId)
    .single();

  console.log("[rejectLocation] fetch location for user_id", { location, fetchError });

  if (fetchError) {
    console.error("[rejectLocation] Supabase fetch error:", fetchError);
    return { ok: false as const, error: fetchError.message };
  }

  const { data: deletedData, error: deleteError } = await supabaseAdmin
    .from("locations")
    .delete()
    .eq("id", locationId)
    .select("id");

  console.log("[rejectLocation] Supabase delete response", { deletedData, deleteError });

  if (deleteError) {
    console.error("[rejectLocation] Supabase delete error:", deleteError);
    return { ok: false as const, error: deleteError.message };
  }

  if (!deletedData || deletedData.length === 0) {
    console.warn("[rejectLocation] No rows deleted - location may not exist");
    return { ok: false as const, error: "Location not found or delete failed" };
  }

  const uid = (location as { user_id?: string } | null)?.user_id;
  if (uid) {
    const { error: userDeleteError } = await supabaseAdmin.auth.admin.deleteUser(uid);
    console.log("[rejectLocation] auth.admin.deleteUser", { uid, userDeleteError });
    if (userDeleteError) {
      console.warn("[rejectLocation] User delete failed (location already removed):", userDeleteError);
      // Don't fail the whole operation - location is already deleted
    }
  }

  console.log("[rejectLocation] success");
  return { ok: true as const };
}

export type ClaimRequestRow = {
  id: string;
  location_id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  message: string | null;
  status: string;
  locations?: { name: string } | null;
};

export async function getClaimRequests(userId: string): Promise<ClaimRequestRow[]> {
  const isSuperAdmin = await checkIsSuperAdmin(userId);
  if (!isSuperAdmin) return [];
  if (!supabaseAdmin) return [];

  const { data } = await supabaseAdmin
    .from("claim_requests")
    .select("id, location_id, name, email, phone, role, message, status, locations(name)")
    .eq("status", "pending");
  return (data as unknown as ClaimRequestRow[]) ?? [];
}

export async function approveClaimRequest(
  claimId: string,
  locationId: string,
  claimantEmail: string,
  locationName: string,
  userId: string
) {
  const isSuperAdmin = await checkIsSuperAdmin(userId);
  if (!isSuperAdmin) return { ok: false as const, error: "Unauthorized" };
  if (!supabaseAdmin) return { ok: false as const, error: "Server misconfigured" };

  const email = claimantEmail.trim();
  if (!email) return { ok: false as const, error: "Invalid email" };

  // Check if claimant already has an auth account
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existingUser = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  let userIdToAssign: string;

  if (existingUser) {
    // User exists - check if they already manage a location
    const { data: existingLocations } = await supabaseAdmin
      .from("locations")
      .select("id")
      .eq("user_id", existingUser.id);
    if (existingLocations && existingLocations.length > 0) {
      return {
        ok: false as const,
        error: "This user already manages a location and cannot claim another.",
      };
    }
    userIdToAssign = existingUser.id;
  } else {
    // Create new account
    const password = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !userData.user) {
      console.error("[approveClaimRequest] createUser error:", createError);
      return { ok: false as const, error: createError?.message ?? "Could not create user" };
    }
    userIdToAssign = userData.user.id;
  }

  const { error: locError } = await supabaseAdmin
    .from("locations")
    .update({ user_id: userIdToAssign, approved: true })
    .eq("id", locationId);
  if (locError) {
    console.error("[approveClaimRequest] location update error:", locError);
    return { ok: false as const, error: locError.message };
  }

  await supabaseAdmin
    .from("claim_requests")
    .update({ status: "approved" })
    .eq("id", claimId);

  // Auto-reject any other pending claims for this location
  await supabaseAdmin
    .from("claim_requests")
    .update({ status: "rejected" })
    .eq("location_id", locationId)
    .eq("status", "pending")
    .neq("id", claimId);

  await sendApprovalConfirmation(email, locationName);
  return { ok: true as const };
}

export async function rejectClaimRequest(claimId: string, userId: string) {
  const isSuperAdmin = await checkIsSuperAdmin(userId);
  if (!isSuperAdmin) return { ok: false as const, error: "Unauthorized" };
  if (!supabaseAdmin) return { ok: false as const, error: "Server misconfigured" };

  const { error } = await supabaseAdmin
    .from("claim_requests")
    .update({ status: "rejected" })
    .eq("id", claimId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
