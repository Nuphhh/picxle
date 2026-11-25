// Use-case tests. They run the real game rules against in-memory adapters, so
// they check the actual behaviour (and the anti-cheat rules) without a database.
import { describe, expect, it } from "vitest";
import {
  fakeImages,
  fakeRenderer,
  MISSING_ID,
  OTHER_PLAYER,
  PLAYER,
  teasersFor,
  testDeps,
  TODAY,
  TOMORROW,
  YESTERDAY,
} from "@/src/test/fixtures";
import { listCredits } from "./credits";
import type { ImageFetcher } from "./ports";
import { todaysPuzzle, yesterdaysPuzzle } from "./daily-puzzle";
import { getPuzzleImage } from "./puzzle-image";
import { revealAnswer } from "./reveal-answer";
import { getShareImage } from "./share-image";
import { playerStatsFor, puzzleStats, recordCompletion } from "./stats";
import { submitGuess } from "./submit-guess";

const guessToday = (deps: ReturnType<typeof testDeps>, guess: string, playerId = PLAYER) =>
  submitGuess(deps, { puzzleId: TODAY.id, playerId, guess });

describe("submitGuess", () => {
  it("grades a correct guess, however it's typed", async () => {
    const deps = testDeps();
    expect(await guessToday(deps, "  NIPPON ")).toEqual({ kind: "graded", correct: true, guessNumber: 1 });
  });

  it("numbers guesses and logs them normalised", async () => {
    const deps = testDeps();
    await guessToday(deps, "China");
    expect(await guessToday(deps, "Korea")).toEqual({ kind: "graded", correct: false, guessNumber: 2 });
    expect(deps.guesses.log.map((g) => g.guess)).toEqual(["china", "korea"]);
  });

  it("records a skip as a wrong guess with no text", async () => {
    const deps = testDeps();
    const r = await submitGuess(deps, { puzzleId: TODAY.id, playerId: PLAYER, skip: true });
    expect(r).toEqual({ kind: "graded", correct: false, guessNumber: 1 });
    expect(deps.guesses.log[0]).toMatchObject({ guess: null, correct: false });
  });

  it("refuses more guesses once solved — stops brute-forcing", async () => {
    const deps = testDeps();
    await guessToday(deps, "Japan");
    expect(await guessToday(deps, "Japan")).toEqual({ kind: "already-finished" });
  });

  it("refuses a sixth guess", async () => {
    const deps = testDeps();
    for (const g of ["a", "b", "c", "d", "e"]) await guessToday(deps, g);
    expect(await guessToday(deps, "Japan")).toEqual({ kind: "already-finished" });
  });

  it("keeps each player's guesses separate", async () => {
    const deps = testDeps();
    await guessToday(deps, "Japan");
    expect(await guessToday(deps, "Japan", OTHER_PLAYER)).toMatchObject({ kind: "graded", guessNumber: 1 });
  });

  it("rejects bad input before touching storage", async () => {
    const deps = testDeps();
    expect(await submitGuess(deps, { puzzleId: "x", playerId: PLAYER, guess: "a" })).toEqual({ kind: "invalid" });
    expect(await submitGuess(deps, { puzzleId: TODAY.id, playerId: "x", guess: "a" })).toEqual({ kind: "invalid" });
    expect(await submitGuess(deps, { puzzleId: TODAY.id, playerId: PLAYER })).toEqual({ kind: "invalid" });
    expect(await submitGuess(deps, { puzzleId: TODAY.id, playerId: PLAYER, guess: 42 })).toEqual({ kind: "invalid" });
    expect(deps.guesses.log).toHaveLength(0);
  });

  it("reports an unknown puzzle", async () => {
    expect(await submitGuess(testDeps(), { puzzleId: MISSING_ID, playerId: PLAYER, guess: "a" })).toEqual({
      kind: "not-found",
    });
  });

  it("reports a guess the store refused (e.g. two tabs racing)", async () => {
    const deps = testDeps();
    deps.guesses.add = async () => false;
    expect(await guessToday(deps, "China")).toEqual({ kind: "not-recorded" });
  });
});

describe("revealAnswer", () => {
  it("won't reveal today's answer to someone still playing", async () => {
    const deps = testDeps();
    await guessToday(deps, "China");
    expect(await revealAnswer(deps, { puzzleId: TODAY.id, playerId: PLAYER })).toEqual({ kind: "forbidden" });
  });

  it("won't reveal it to someone who merely claims a player ID", async () => {
    const deps = testDeps();
    expect(await revealAnswer(deps, { puzzleId: TODAY.id, playerId: null })).toEqual({ kind: "forbidden" });
  });

  it("reveals once the player has finished, hiding a Picxle-original credit", async () => {
    const deps = testDeps();
    await guessToday(deps, "Japan");
    expect(await revealAnswer(deps, { puzzleId: TODAY.id, playerId: PLAYER })).toEqual({
      kind: "revealed",
      answer: "Japan",
      license: "PD",
      attribution: null,
    });
  });

  it("reveals any past puzzle to anyone", async () => {
    expect(await revealAnswer(testDeps(), { puzzleId: YESTERDAY.id, playerId: null })).toEqual({
      kind: "revealed",
      answer: "Big Ben",
      license: "CC-BY",
      attribution: "Jane Doe, CC BY 4.0",
    });
  });

  it("opens today's answer to everyone once the clock passes midnight", async () => {
    const deps = testDeps();
    deps.clock.set("2026-11-26T00:00:01Z");
    expect(await revealAnswer(deps, { puzzleId: TODAY.id, playerId: null })).toMatchObject({ kind: "revealed" });
  });

  it("validates and reports missing puzzles", async () => {
    expect(await revealAnswer(testDeps(), { puzzleId: "nope", playerId: PLAYER })).toEqual({ kind: "invalid" });
    expect(await revealAnswer(testDeps(), { puzzleId: MISSING_ID, playerId: PLAYER })).toEqual({ kind: "not-found" });
  });
});

describe("daily puzzle", () => {
  it("finds today's and yesterday's by the UTC date", async () => {
    const deps = testDeps();
    expect(await todaysPuzzle(deps)).toEqual({ id: TODAY.id, date: TODAY.date, category: "Flag", license: "PD" });
    expect((await yesterdaysPuzzle(deps))?.id).toBe(YESTERDAY.id);
  });

  it("never includes the answer or the image address", async () => {
    const summary = await todaysPuzzle(testDeps());
    expect(JSON.stringify(summary)).not.toMatch(/japan|nippon|upload\.wikimedia/i);
  });

  it("returns null on a day with no puzzle", async () => {
    const deps = testDeps();
    deps.clock.set("2030-01-01T00:00:00Z");
    expect(await todaysPuzzle(deps)).toBeNull();
  });
});

describe("getPuzzleImage", () => {
  it("proxies today's image", async () => {
    const images = fakeImages();
    const r = await getPuzzleImage({ ...testDeps(), images }, TODAY.id);
    expect(r).toMatchObject({ kind: "image", contentType: "image/jpeg" });
    expect(images.requested).toEqual([TODAY.imageSrc]);
  });

  it("never serves a future puzzle's image", async () => {
    const images = fakeImages();
    expect(await getPuzzleImage({ ...testDeps(), images }, TOMORROW.id)).toEqual({ kind: "not-found" });
    expect(images.requested).toEqual([]);
  });

  it("refuses non-images (e.g. an HTML error page) and failed fetches", async () => {
    expect(await getPuzzleImage({ ...testDeps(), images: fakeImages("text/html") }, TODAY.id)).toEqual({
      kind: "unavailable",
    });
    expect(await getPuzzleImage({ ...testDeps(), images: fakeImages("image/png", false) }, TODAY.id)).toEqual({
      kind: "unavailable",
    });
    expect(await getPuzzleImage({ ...testDeps(), images: { fetch: async () => null } }, TODAY.id)).toEqual({
      kind: "unavailable",
    });
  });

  it("validates the ID", async () => {
    expect(await getPuzzleImage({ ...testDeps(), images: fakeImages() }, "../etc")).toEqual({ kind: "invalid" });
  });
});

describe("stats", () => {
  it("records a completion and counts it in the puzzle's distribution", async () => {
    const deps = testDeps();
    expect(await recordCompletion(deps, { puzzleId: TODAY.id, guessesTaken: 3, playerId: PLAYER })).toEqual({
      kind: "recorded",
    });
    await recordCompletion(deps, { puzzleId: TODAY.id, guessesTaken: 6, playerId: null });
    expect(await puzzleStats(deps, TODAY.id)).toEqual({
      kind: "distribution",
      counts: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0, 6: 1 },
      total: 2,
    });
  });

  it("uses today's puzzle when no ID is given", async () => {
    const deps = testDeps();
    await recordCompletion(deps, { puzzleId: TODAY.id, guessesTaken: 1 });
    expect(await puzzleStats(deps, null)).toMatchObject({ total: 1 });
    deps.clock.set("2030-01-01T00:00:00Z");
    expect(await puzzleStats(deps, null)).toEqual({ kind: "no-puzzle" });
  });

  it("rejects scores outside 1-6 and IDs that aren't UUIDs", async () => {
    const deps = testDeps();
    for (const bad of [
      { puzzleId: TODAY.id, guessesTaken: 0 },
      { puzzleId: TODAY.id, guessesTaken: 7 },
      { puzzleId: TODAY.id, guessesTaken: "3" },
      { puzzleId: "x", guessesTaken: 3 },
      { puzzleId: TODAY.id, guessesTaken: 3, playerId: "x" },
    ]) {
      expect(await recordCompletion(deps, bad)).toEqual({ kind: "invalid" });
    }
    expect(deps.completions.rows).toHaveLength(0);
    expect(await puzzleStats(deps, "x")).toEqual({ kind: "invalid" });
  });

  it("builds a player's streak from their completions", async () => {
    const deps = testDeps();
    await recordCompletion(deps, { puzzleId: YESTERDAY.id, guessesTaken: 2, playerId: PLAYER });
    await recordCompletion(deps, { puzzleId: TODAY.id, guessesTaken: 6, playerId: PLAYER });
    await recordCompletion(deps, { puzzleId: TODAY.id, guessesTaken: 1, playerId: OTHER_PLAYER });
    expect(await playerStatsFor(deps, PLAYER)).toEqual({
      kind: "stats",
      current: 2,
      max: 2,
      played: 2,
      winPct: 50,
      counts: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0, 6: 1 },
    });
    expect(await playerStatsFor(deps, "x")).toEqual({ kind: "invalid" });
  });
});

describe("listCredits", () => {
  it("only credits puzzles whose day is over (sources name the answer)", async () => {
    const credits = await listCredits(testDeps());
    expect(credits.map((c) => c.imageSrc)).toEqual([YESTERDAY.imageSrc]);
  });
});

describe("getShareImage", () => {
  const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  const shareDeps = (teaserDays: string[] = [], images: ImageFetcher = fakeImages()) => ({
    ...testDeps(),
    images,
    renderer: fakeRenderer,
    teasers: teasersFor(...teaserDays),
  });

  it("uses the precomputed teaser when there is one (today by default)", async () => {
    expect(text(await getShareImage(shareDeps([TODAY.date]), null))).toBe("teaser");
  });

  it("falls back to pixelating the image, keeping flags whole", async () => {
    expect(text(await getShareImage(shareDeps(), TODAY.date))).toBe("image:contain");
    expect(text(await getShareImage(shareDeps(), YESTERDAY.date))).toBe("image:cover");
  });

  it("draws a blank tile for nonsense dates, missing puzzles and errors", async () => {
    expect(text(await getShareImage(shareDeps(), "not-a-date"))).toBe("blank");
    expect(text(await getShareImage(shareDeps(), "2030-01-01"))).toBe("blank");
    const broken: ImageFetcher = { fetch: () => Promise.reject(new Error("network down")) };
    expect(text(await getShareImage(shareDeps([], broken), TODAY.date))).toBe("blank");
  });
});
