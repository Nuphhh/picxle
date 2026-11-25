// The browser's API client, tested against the real server handlers (via the
// in-process "network" in src/test). These are CONTRACT tests: they prove the
// two halves of the app agree on URLs and JSON field names.
import { describe, expect, it } from "vitest";
import { inProcessServer } from "@/src/test/in-process-server";
import { NOW, PLAYER, TODAY, YESTERDAY, testDeps } from "@/src/test/fixtures";
import { memoryServerDeps } from "@/src/adapters/memory";
import { httpGameApi } from "./http-game-api";

function setup(deps = testDeps()) {
  const server = inProcessServer(deps);
  return { ...server, api: httpGameApi("", server.fetch) };
}

/** A fetch that always fails the way a phone with no signal does. */
const offline = (async () => {
  throw new TypeError("Failed to fetch");
}) as typeof fetch;

/** A fetch that always answers with an error status. */
const failing = (status: number) => (async () => Response.json({ error: "boom" }, { status })) as typeof fetch;

describe("httpGameApi against the real handlers", () => {
  it("loads today's and yesterday's puzzles, renaming puzzle_date to date", async () => {
    const { api } = setup();
    expect(await api.todayPuzzle()).toEqual({ id: TODAY.id, date: "2026-11-25", category: "Flag", license: "PD" });
    expect((await api.yesterdayPuzzle())?.date).toBe("2026-11-24");
  });

  it("plays a whole game: wrong, skip, right, then reveal and record", async () => {
    const { api, deps } = setup();
    expect(await api.submitGuess(TODAY.id, PLAYER, { guess: "france" })).toEqual({ correct: false, guessNumber: 1 });
    expect(await api.submitGuess(TODAY.id, PLAYER, { skip: true })).toEqual({ correct: false, guessNumber: 2 });
    expect(await api.submitGuess(TODAY.id, PLAYER, { guess: "nippon" })).toEqual({ correct: true, guessNumber: 3 });

    // Picxle's own image: the credit is hidden from players.
    expect(await api.reveal(TODAY.id, PLAYER)).toEqual({ answer: "Japan", attribution: null });

    await api.recordCompletion({ puzzleId: TODAY.id, guessesTaken: 3, playerId: PLAYER });
    expect(deps.completions.rows).toHaveLength(1);

    const dist = await api.puzzleStats(TODAY.id);
    expect(dist.total).toBe(1);
    expect(dist.counts[3]).toBe(1);

    const me = await api.playerStats(PLAYER);
    expect(me).toMatchObject({ played: 1, winPct: 100, current: 1 });
  });

  it("refuses to reveal while the player is still guessing — and says so by throwing", async () => {
    const { api } = setup();
    await expect(api.reveal(TODAY.id, PLAYER)).rejects.toThrow();
  });

  it("shows the image credit for someone else's photo", async () => {
    const { api } = setup();
    for (const g of ["paris", "rome", "oslo", "lima", "cairo"]) {
      await api.submitGuess(YESTERDAY.id, PLAYER, { guess: g });
    }
    expect(await api.reveal(YESTERDAY.id, PLAYER)).toEqual({ answer: "Big Ben", attribution: "Jane Doe, CC BY 4.0" });
  });

  it("builds image URLs by puzzle ID only, with the API base in front", () => {
    const api = httpGameApi("https://picxle.vercel.app", offline);
    expect(api.imageUrl(TODAY.id)).toBe(`https://picxle.vercel.app/api/puzzle/image?puzzleId=${TODAY.id}`);
  });
});

describe("httpGameApi when things go wrong", () => {
  it("todayPuzzle: no puzzle -> null, but offline -> throws", async () => {
    // A server with no puzzles at all answers 404.
    const { api } = setup(memoryServerDeps([], NOW));
    expect(await api.todayPuzzle()).toBeNull();
    await expect(httpGameApi("", offline).todayPuzzle()).rejects.toThrow();
  });

  it("yesterdayPuzzle never throws (it's only a bonus)", async () => {
    expect(await httpGameApi("", offline).yesterdayPuzzle()).toBeNull();
    expect(await httpGameApi("", failing(500)).yesterdayPuzzle()).toBeNull();
  });

  it("submitGuess returns null rather than burning a guess", async () => {
    expect(await httpGameApi("", offline).submitGuess(TODAY.id, PLAYER, { guess: "japan" })).toBeNull();
    expect(await httpGameApi("", failing(409)).submitGuess(TODAY.id, PLAYER, { guess: "japan" })).toBeNull();
  });

  it("stats calls throw on an error status, so error JSON never reaches the screen", async () => {
    // The old JS version did `setStats(await res.json())` even on a 500, which
    // put {"error": ...} where the distribution should be.
    await expect(httpGameApi("", failing(500)).puzzleStats(TODAY.id)).rejects.toThrow();
    await expect(httpGameApi("", failing(400)).playerStats(PLAYER)).rejects.toThrow();
  });

  it("recordCompletion resolves on any answer, throws only when offline", async () => {
    await expect(httpGameApi("", failing(400)).recordCompletion({ puzzleId: TODAY.id, guessesTaken: 1, playerId: null })).resolves.toBeUndefined();
    await expect(httpGameApi("", offline).recordCompletion({ puzzleId: TODAY.id, guessesTaken: 1, playerId: null })).rejects.toThrow();
  });
});
