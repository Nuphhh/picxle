import { describe, expect, it } from "vitest";
import { computeStreaks, countScores, difficultyOf, playerStats, puzzleDistribution } from "./stats.ts";

describe("countScores", () => {
  it("tallies 1-6 and ignores anything else", () => {
    expect(countScores([1, 1, 3, 6, 0, 7, 2.5])).toEqual({ 1: 2, 2: 0, 3: 1, 4: 0, 5: 0, 6: 1 });
  });
});

describe("computeStreaks", () => {
  const today = "2026-11-25";

  it("is zero with no games", () => {
    expect(computeStreaks([], today)).toEqual({ current: 0, max: 0 });
  });

  it("counts back from today", () => {
    expect(computeStreaks(["2026-11-23", "2026-11-24", "2026-11-25"], today)).toEqual({ current: 3, max: 3 });
  });

  it("is broken by a missed day", () => {
    expect(computeStreaks(["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-24", "2026-11-25"], today)).toEqual({
      current: 2,
      max: 3,
    });
  });

  it("reads 0 until today's puzzle is played (existing behaviour)", () => {
    expect(computeStreaks(["2026-11-23", "2026-11-24"], today)).toEqual({ current: 0, max: 2 });
  });

  it("ignores duplicates and order, and crosses month ends", () => {
    expect(computeStreaks(["2026-12-01", "2026-11-30", "2026-11-30", "2026-11-29"], "2026-12-01")).toEqual({
      current: 3,
      max: 3,
    });
  });
});

describe("playerStats", () => {
  it("works out win rate and distribution", () => {
    const stats = playerStats(
      [
        { guessesTaken: 2, puzzleDate: "2026-11-24" },
        { guessesTaken: 6, puzzleDate: "2026-11-25" },
        { guessesTaken: 1, puzzleDate: null }, // its puzzle was deleted
      ],
      "2026-11-25",
    );
    expect(stats).toEqual({
      current: 2,
      max: 2,
      played: 3,
      winPct: 67,
      counts: { 1: 1, 2: 1, 3: 0, 4: 0, 5: 0, 6: 1 },
    });
  });

  it("is all zeros for a new player", () => {
    expect(playerStats([], "2026-11-25")).toMatchObject({ played: 0, winPct: 0, current: 0 });
  });
});

describe("difficultyOf", () => {
  it("stays quiet until five people have played", () => {
    expect(difficultyOf(puzzleDistribution([1, 1, 1, 1]))).toBeNull();
  });

  it("labels by average score", () => {
    expect(difficultyOf(puzzleDistribution([1, 2, 2, 3, 2]))).toBe("EASY");
    expect(difficultyOf(puzzleDistribution([3, 3, 3, 3, 3]))).toBe("MEDIUM");
    expect(difficultyOf(puzzleDistribution([4, 4, 4, 4, 3]))).toBe("HARD");
    expect(difficultyOf(puzzleDistribution([6, 6, 5, 4, 6]))).toBe("BRUTAL");
  });
});
