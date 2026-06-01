import { createClient } from "@supabase/supabase-js";

// Create the client per-request so it reads env vars at runtime, not build time.
export function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
