import { supabase } from "@/lib/supabase";

export type ManagedLocation = {
  id: string;
  name: string;
};

export async function checkIsSuperAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function getManagedLocations(
  userId: string,
  isSuperAdmin: boolean
): Promise<ManagedLocation[]> {
  let query = supabase.from("locations").select("id, name").order("name");
  if (!isSuperAdmin) {
    query = query.eq("user_id", userId);
  }
  const { data } = await query;
  return (data as ManagedLocation[]) ?? [];
}

