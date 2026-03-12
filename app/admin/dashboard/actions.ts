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
