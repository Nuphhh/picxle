// Talks to Supabase's REST API (PostgREST) with plain fetch().
// Deliberately NOT @supabase/supabase-js: importing it at build time crashed
// Vercel when the secret env vars weren't available during the build step.
// The env vars are read on every call, never at import time, for the same reason.

/** Like fetch(), but `path` is relative to /rest/v1/ and auth is added for you. */
export type RestFetch = (path: string, init?: RequestInit) => Promise<Response>;

/** Environment variables (we read SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).
 *  Typed as a string map so both process.env and a test's `{ ... }` fit. */
type Env = Readonly<Record<string, string | undefined>>;

export function supabaseRest(env: Env = process.env, fetchImpl: typeof fetch = fetch): RestFetch {
  return (path, init = {}) => {
    const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    return fetchImpl(`${env.SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  };
}

/**
 * Read a response as a list of rows. PostgREST answers errors with an object
 * instead of a list, so anything that isn't a list counts as "no rows".
 */
export async function rows<T>(res: Response): Promise<T[]> {
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as T[]) : [];
}

/** Escape a value before it goes into a query string (defence in depth — the
 *  use cases already reject anything that isn't a UUID or a date). */
export const q = encodeURIComponent;
