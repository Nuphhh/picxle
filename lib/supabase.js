// Query Supabase via its REST API using plain fetch().
// This avoids importing @supabase/supabase-js at build time,
// which crashes Vercel when sensitive env vars aren't available during the build step.

export function supabaseFetch(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}
