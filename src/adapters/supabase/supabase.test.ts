// Supabase adapter tests. Instead of a real database, `fetch` is replaced by a
// fake that records each request and replies with canned rows. That checks the
// two things these adapters are responsible for: asking for the right thing
// (URL, columns, headers) and translating snake_case rows into app objects.
import { describe, expect, it } from "vitest";
import { supabaseCompletionRepository } from "./completion-repository";
import { supabaseGuessRepository } from "./guess-repository";
import { supabasePuzzleRepository } from "./puzzle-repository";
import { supabaseRest } from "./rest";

const ENV = { SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "secret" };

function fakeSupabase(reply: unknown = [], status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Response.json(reply, { status });
  }) as typeof fetch;
  const rest = supabaseRest(ENV, fetchImpl);
  // Just the bit after /rest/v1/, decoded, for readable assertions.
  const paths = () => calls.map((c) => decodeURIComponent(c.url.replace("https://db.test/rest/v1/", "")));
  return { rest, calls, paths };
}

describe("supabaseRest", () => {
  it("adds the auth headers and never caches", async () => {
    const { rest, calls } = fakeSupabase();
    await rest("puzzles?x=1", { headers: { Prefer: "return=minimal" } });
    expect(calls[0].url).toBe("https://db.test/rest/v1/puzzles?x=1");
    expect(calls[0].init.cache).toBe("no-store");
    expect(calls[0].init.headers).toEqual({
      apikey: "secret",
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    });
  });

  it("reads env vars on each call, not when created (Vercel builds have none)", async () => {
    const env: Record<string, string | undefined> = {};
    const urls: string[] = [];
    const rest = supabaseRest(env, (async (u: string) => {
      urls.push(u);
      return Response.json([]);
    }) as typeof fetch);
    env.SUPABASE_URL = "https://late.test";
    await rest("x");
    expect(urls).toEqual(["https://late.test/rest/v1/x"]);
  });
});

describe("supabasePuzzleRepository", () => {
  const row = {
    id: "p1",
    puzzle_date: "2026-11-25",
    category: "Flag",
    license: "PD",
    answer: "Japan",
    attribution: "A",
    image_src: "https://x/y.jpg",
    accepts: ["Japan"],
  };

  it("asks only for summary columns and renames them", async () => {
    const { rest, paths } = fakeSupabase([row]);
    expect(await supabasePuzzleRepository(rest).summaryByDate("2026-11-25")).toEqual({
      id: "p1",
      date: "2026-11-25",
      category: "Flag",
      license: "PD",
    });
    expect(paths()).toEqual(["puzzles?puzzle_date=eq.2026-11-25&select=id,puzzle_date,category,license"]);
  });

  it("returns null when there's no row — or Supabase sends an error object", async () => {
    expect(await supabasePuzzleRepository(fakeSupabase([]).rest).reveal("p1")).toBeNull();
    expect(await supabasePuzzleRepository(fakeSupabase({ message: "boom" }, 500).rest).reveal("p1")).toBeNull();
  });

  it("treats a missing accepts list as empty, but a missing puzzle as null", async () => {
    expect(await supabasePuzzleRepository(fakeSupabase([{ accepts: null }]).rest).acceptedAnswers("p1")).toEqual([]);
    expect(await supabasePuzzleRepository(fakeSupabase([]).rest).acceptedAnswers("p1")).toBeNull();
  });

  it("escapes values put into the query string", async () => {
    const { rest, calls } = fakeSupabase([]);
    await supabasePuzzleRepository(rest).reveal("a&select=answer");
    expect(calls[0].url).toContain("id=eq.a%26select%3Danswer&select=");
  });

  it("maps image rows and skips puzzles without an image", async () => {
    expect(await supabasePuzzleRepository(fakeSupabase([row]).rest).image("p1")).toEqual({
      imageSrc: "https://x/y.jpg",
      date: "2026-11-25",
      category: "Flag",
    });
    expect(await supabasePuzzleRepository(fakeSupabase([{ ...row, image_src: null }]).rest).image("p1")).toBeNull();
  });

  it("lists credits before a day, and nothing on error", async () => {
    const { rest, paths } = fakeSupabase([row]);
    expect(await supabasePuzzleRepository(rest).creditsBefore("2026-11-25")).toEqual([
      { imageSrc: "https://x/y.jpg", license: "PD", attribution: "A" },
    ]);
    expect(paths()).toEqual(["puzzles?puzzle_date=lt.2026-11-25&select=image_src,license,attribution"]);
    expect(await supabasePuzzleRepository(fakeSupabase([row], 500).rest).creditsBefore("2026-11-25")).toEqual([]);
  });
});

describe("supabaseGuessRepository", () => {
  it("reads a player's guesses in order", async () => {
    const { rest, paths } = fakeSupabase([{ guess_number: 1, correct: false }]);
    expect(await supabaseGuessRepository(rest).forPlayer("p1", "u1")).toEqual([{ guessNumber: 1, correct: false }]);
    expect(paths()).toEqual(["guesses?puzzle_id=eq.p1&player_id=eq.u1&select=guess_number,correct&order=guess_number"]);
  });

  it("inserts snake_case and reports whether it stuck", async () => {
    const ok = fakeSupabase(null, 201);
    const guess = { puzzleId: "p1", playerId: "u1", guessNumber: 2, guess: "japan", correct: true };
    expect(await supabaseGuessRepository(ok.rest).add(guess)).toBe(true);
    expect(JSON.parse(ok.calls[0].init.body as string)).toEqual({
      puzzle_id: "p1",
      player_id: "u1",
      guess_number: 2,
      guess: "japan",
      correct: true,
    });
    expect(ok.calls[0].init.method).toBe("POST");
    // 409 = the UNIQUE constraint rejected a duplicate guess number.
    expect(await supabaseGuessRepository(fakeSupabase(null, 409).rest).add(guess)).toBe(false);
  });
});

describe("supabaseCompletionRepository", () => {
  it("joins completions to their puzzle's date", async () => {
    const { rest, paths } = fakeSupabase([
      { guesses_taken: 3, puzzles: { puzzle_date: "2026-11-25" } },
      { guesses_taken: 6, puzzles: null },
    ]);
    expect(await supabaseCompletionRepository(rest).forPlayer("u1")).toEqual([
      { guessesTaken: 3, puzzleDate: "2026-11-25" },
      { guessesTaken: 6, puzzleDate: null },
    ]);
    expect(paths()).toEqual(["completions?player_id=eq.u1&select=guesses_taken,puzzles(puzzle_date)"]);
  });

  it("reads scores and inserts completions", async () => {
    const { rest, calls } = fakeSupabase([{ guesses_taken: 2 }, { guesses_taken: 6 }]);
    const repo = supabaseCompletionRepository(rest);
    expect(await repo.scoresForPuzzle("p1")).toEqual([2, 6]);
    await repo.add({ puzzleId: "p1", guessesTaken: 2, playerId: null });
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ puzzle_id: "p1", guesses_taken: 2, player_id: null });
  });
});
