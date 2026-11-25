// ADAPTER: ImageFetcher using fetch().
import type { ImageFetcher } from "@/src/application/ports";

// Wikimedia rate-limits (HTTP 429) requests that don't say who they are, so
// every fetch carries a User-Agent naming the app and a contact address.
export function httpImageFetcher(userAgent: string, fetchImpl: typeof fetch = fetch): ImageFetcher {
  return {
    async fetch(url) {
      const res = await fetchImpl(url, { headers: { "User-Agent": userAgent } }).catch(() => null);
      if (!res) return null;
      return {
        ok: res.ok,
        contentType: res.headers.get("content-type") ?? "",
        body: res.body,
        bytes: async () => new Uint8Array(await res.arrayBuffer()),
      };
    },
  };
}
