// HTTP adapter tests: real Request objects in, real Response objects out.
// These pin down the API contract the browser (and installed app builds)
// depend on — status codes, error messages, JSON field names and headers.
import { describe, expect, it } from "vitest";
import { fakeImages, fakeRenderer, PLAYER, teasersFor, testDeps, TODAY, TOMORROW } from "@/src/test/fixtures";
import { createHandlers, createShareImageHandler } from "./handlers";

const BASE = "https://picxle.test";
const get = (path: string) => new Request(BASE + path);
const post = (path: string, body: unknown) =>
  new Request(BASE + path, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

function setup() {
  const deps = testDeps();
  return { deps, h: createHandlers({ ...deps, images: fakeImages("image/svg+xml") }) };
}

/** Status + parsed JSON body, for compact assertions. */
async function call(res: Promise<Response>) {
  const r = await res;
  return { status: r.status, body: await r.json() };
}

describe("POST /api/guess", () => {
  it("grades a guess", async () => {
    const { h } = setup();
    expect(await call(h.guess(post("/api/guess", { puzzleId: TODAY.id, playerId: PLAYER, guess: "japan" })))).toEqual({
      status: 200,
      body: { correct: true, guessNumber: 1 },
    });
  });

  it("maps every failure to the same status and message as before", async () => {
    const { h, deps } = setup();
    expect(await call(h.guess(post("/api/guess", { puzzleId: TODAY.id })))).toEqual({
      status: 400,
      body: { error: "Missing or invalid fields." },
    });
    expect(await call(h.guess(post("/api/guess", "{not json")))).toMatchObject({ status: 400 });
    expect(
      await call(h.guess(post("/api/guess", { puzzleId: TOMORROW.id.replace("3", "9"), playerId: PLAYER, guess: "a" }))),
    ).toEqual({ status: 404, body: { error: "Puzzle not found." } });

    await h.guess(post("/api/guess", { puzzleId: TODAY.id, playerId: PLAYER, guess: "japan" }));
    expect(await call(h.guess(post("/api/guess", { puzzleId: TODAY.id, playerId: PLAYER, guess: "x" })))).toEqual({
      status: 409,
      body: { error: "Puzzle already finished." },
    });

    deps.guesses.add = async () => false;
    expect(
      await call(h.guess(post("/api/guess", { puzzleId: TODAY.id, playerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", guess: "x" }))),
    ).toEqual({ status: 409, body: { error: "Guess not recorded, try again." } });
  });
});

describe("GET /api/puzzle/reveal", () => {
  it("is 403 until finished, then 200", async () => {
    const { h } = setup();
    const url = `/api/puzzle/reveal?puzzleId=${TODAY.id}&playerId=${PLAYER}`;
    expect(await call(h.reveal(get(url)))).toEqual({ status: 403, body: { error: "Finish the puzzle first." } });
    await h.guess(post("/api/guess", { puzzleId: TODAY.id, playerId: PLAYER, guess: "japan" }));
    expect(await call(h.reveal(get(url)))).toEqual({
      status: 200,
      body: { answer: "Japan", license: "PD", attribution: null },
    });
  });

  it("is 400 for a bad ID", async () => {
    expect(await call(setup().h.reveal(get("/api/puzzle/reveal")))).toEqual({
      status: 400,
      body: { error: "Missing or invalid puzzleId." },
    });
  });
});

describe("GET /api/puzzle/today and /yesterday", () => {
  it("sends the summary with the original snake_case field names", async () => {
    expect(await call(setup().h.today(get("/api/puzzle/today")))).toEqual({
      status: 200,
      body: { id: TODAY.id, puzzle_date: "2026-11-25", category: "Flag", license: "PD" },
    });
  });

  it("is 404 when there's no puzzle", async () => {
    const { h, deps } = setup();
    deps.clock.set("2030-06-01T00:00:00Z");
    expect(await call(h.today(get("/")))).toEqual({ status: 404, body: { error: "No puzzle found for today." } });
    expect(await call(h.yesterday(get("/")))).toEqual({ status: 404, body: { error: "No puzzle found." } });
  });
});

describe("GET /api/puzzle/image", () => {
  it("streams the image with locked-down, cacheable headers", async () => {
    const res = await setup().h.image(get(`/api/puzzle/image?puzzleId=${TODAY.id}`));
    expect(res.status).toBe(200);
    expect(Object.fromEntries(res.headers)).toMatchObject({
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=86400, s-maxage=604800",
      "access-control-allow-origin": "*",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "x-content-type-options": "nosniff",
    });
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("is 404 for tomorrow's puzzle and 400 for junk", async () => {
    const { h } = setup();
    expect(await call(h.image(get(`/api/puzzle/image?puzzleId=${TOMORROW.id}`)))).toEqual({
      status: 404,
      body: { error: "Not found." },
    });
    expect((await h.image(get("/api/puzzle/image?puzzleId=junk"))).status).toBe(400);
  });

  it("is 502 when the source isn't an image", async () => {
    const deps = testDeps();
    const h = createHandlers({ ...deps, images: fakeImages("text/html") });
    expect(await call(h.image(get(`/api/puzzle/image?puzzleId=${TODAY.id}`)))).toEqual({
      status: 502,
      body: { error: "Image unavailable." },
    });
  });
});

describe("stats routes", () => {
  it("records, then reports, a completion", async () => {
    const { h } = setup();
    expect(await call(h.recordStats(post("/api/stats/record", { puzzleId: TODAY.id, guessesTaken: 2, playerId: PLAYER })))).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(await call(h.puzzleDistribution(get(`/api/stats/today?puzzleId=${TODAY.id}`)))).toEqual({
      status: 200,
      body: { counts: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0 }, total: 1 },
    });
    expect(await call(h.playerStreak(get(`/api/stats/streak?playerId=${PLAYER}`)))).toEqual({
      status: 200,
      body: { current: 1, max: 1, played: 1, winPct: 100, counts: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0 } },
    });
  });

  it("rejects bad input", async () => {
    const { h } = setup();
    expect(await call(h.recordStats(post("/api/stats/record", { puzzleId: TODAY.id })))).toEqual({
      status: 400,
      body: { error: "Missing fields." },
    });
    expect(await call(h.playerStreak(get("/api/stats/streak")))).toEqual({
      status: 400,
      body: { error: "Missing playerId." },
    });
    expect((await h.puzzleDistribution(get("/api/stats/today?puzzleId=junk"))).status).toBe(400);
  });
});

describe("GET /api/og", () => {
  it("returns a cacheable PNG", async () => {
    const deps = testDeps();
    const handler = createShareImageHandler({
      ...deps,
      images: fakeImages(),
      renderer: fakeRenderer,
      teasers: teasersFor(TODAY.date),
    });
    const res = await handler(get("/api/og"));
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=86400");
    expect(await res.text()).toBe("teaser");
  });
});
