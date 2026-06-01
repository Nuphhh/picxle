import { createClient } from "@supabase/supabase-js";

// Server-only client — uses the service_role key so it bypasses Row Level Security.
// Never import this in a "use client" component; only use it in API routes and
// server components where the key stays on the server.
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
