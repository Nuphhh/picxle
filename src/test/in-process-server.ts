// A pretend network for tests. It's a `fetch` function that, instead of going
// over the internet, hands each Request straight to the REAL route handlers,
// running on in-memory repositories.
//
// That lets a test wire the browser's GameApi (or the whole game screen) to the
// actual server logic. If the browser and server ever disagree about a URL or
// a JSON field name, these tests fail — no network, database or browser needed.
import { createHandlers, type Handler } from "@/src/adapters/http/handlers";
import { fakeImages, testDeps } from "./fixtures";

export function inProcessServer(deps = testDeps()) {
  const h = createHandlers({ ...deps, images: fakeImages() });

  // The same URL -> handler table as the files under app/api/.
  const routes: Record<string, { method: "GET" | "POST"; handler: Handler }> = {
    "/api/guess": { method: "POST", handler: h.guess },
    "/api/puzzle/today": { method: "GET", handler: h.today },
    "/api/puzzle/yesterday": { method: "GET", handler: h.yesterday },
    "/api/puzzle/reveal": { method: "GET", handler: h.reveal },
    "/api/puzzle/image": { method: "GET", handler: h.image },
    "/api/stats/record": { method: "POST", handler: h.recordStats },
    "/api/stats/streak": { method: "GET", handler: h.playerStreak },
    "/api/stats/today": { method: "GET", handler: h.puzzleDistribution },
  };

  /** Every request made, as "METHOD /path?query", for assertions. */
  const requests: string[] = [];

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(new URL(String(input), "https://picxle.test"), init);
    const url = new URL(request.url);
    requests.push(`${request.method} ${url.pathname}${url.search}`);
    const route = routes[url.pathname];
    if (!route || route.method !== request.method) return Response.json({ error: "Not found" }, { status: 404 });
    return route.handler(request);
  }) as typeof fetch;

  return { fetch: fetchImpl, deps, requests };
}
