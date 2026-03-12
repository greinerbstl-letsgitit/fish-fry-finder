import "server-only";
import { createClient } from "@supabase/supabase-js";

console.log(
  "supabase-admin loading, SUPABASE_SERVICE_ROLE_KEY present:",
  !!process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Admin client with service role key. Server-only - bypasses RLS. */
export const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
