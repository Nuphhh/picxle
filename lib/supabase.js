// Dynamic import pattern — call this inside route handlers only.
// Never import this at module level; it must run at request time so the
// environment variables are available (Vercel hides sensitive vars from the build step).
export async function getSupabase() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
