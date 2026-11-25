// Streaks, win rate and guess distributions — computed from completion records.
import { addDays, daysBetween, type IsoDay } from "./dates.ts";
import { LOSS_SCORE } from "./rules.ts";

/** A completion score: 1-5 = won in that many guesses, 6 = lost. */
export type Score = 1 | 2 | 3 | 4 | 5 | 6;
export const SCORES: readonly Score[] = [1, 2, 3, 4, 5, 6];

/** How many completions landed on each score. Serialises as {"1":0,...,"6":0}. */
export type GuessCounts = Record<Score, number>;

export const emptyCounts = (): GuessCounts => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });

const isScore = (n: number): n is Score => Number.isInteger(n) && n >= 1 && n <= 6;

/** Tally scores into counts. Anything outside 1-6 is ignored. */
export function countScores(scores: readonly number[]): GuessCounts {
  const counts = emptyCounts();
  for (const s of scores) if (isScore(s)) counts[s]++;
  return counts;
}

/** Everyone's results on one puzzle. */
export interface PuzzleDistribution {
  counts: GuessCounts;
  total: number;
}

export const puzzleDistribution = (scores: readonly number[]): PuzzleDistribution => ({
  counts: countScores(scores),
  total: scores.length,
});

/**
 * Current and best run of consecutive days played.
 * The current streak counts back from `today`, so it reads 0 until today's
 * puzzle has been finished.
 */
export function computeStreaks(dates: readonly IsoDay[], today: IsoDay): { current: number; max: number } {
  const unique = [...new Set(dates)].sort(); // ascending
  if (!unique.length) return { current: 0, max: 0 };

  let max = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    run = daysBetween(unique[i - 1], unique[i]) === 1 ? run + 1 : 1;
    if (run > max) max = run;
  }

  const played = new Set(unique);
  let current = 0;
  for (let day = today; played.has(day); day = addDays(day, -1)) current++;

  return { current, max };
}

/** One of this player's finished puzzles. */
export interface PlayerCompletion {
  guessesTaken: number;
  puzzleDate: IsoDay | null;
}

export interface PlayerStats {
  current: number;
  max: number;
  played: number;
  winPct: number;
  counts: GuessCounts;
}

export function playerStats(rows: readonly PlayerCompletion[], today: IsoDay): PlayerStats {
  const played = rows.length;
  const won = rows.filter((r) => r.guessesTaken < LOSS_SCORE).length;
  const dates = rows.map((r) => r.puzzleDate).filter((d): d is IsoDay => !!d);
  return {
    ...computeStreaks(dates, today),
    played,
    winPct: played > 0 ? Math.round((won / played) * 100) : 0,
    counts: countScores(rows.map((r) => r.guessesTaken)),
  };
}

export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "BRUTAL";

/** Label a puzzle by its average score — but only once 5+ people have played. */
export function difficultyOf(d: PuzzleDistribution): Difficulty | null {
  if (d.total < 5) return null;
  const sum = SCORES.reduce((acc, n) => acc + n * (d.counts[n] ?? 0), 0);
  const avg = sum / d.total;
  if (avg <= 2) return "EASY";
  if (avg <= 3) return "MEDIUM";
  if (avg <= 4) return "HARD";
  return "BRUTAL";
}
