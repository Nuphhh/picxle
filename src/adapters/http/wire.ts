// The JSON shapes that travel between browser and server — the API "contract".
//
// Both sides import these types: the route handlers (server) when they build a
// response, and the browser's GameApi when it reads one. If either side drifts,
// TypeScript fails the build instead of a player hitting a bug.
//
// The names (puzzle_date, guessesTaken, ...) are kept EXACTLY as they were in
// the JavaScript version, so already-installed app builds keep working.
import type { GuessCounts } from "@/src/domain/stats";

export interface PuzzleSummaryJson {
  id: string;
  puzzle_date: string;
  category: string;
  license: string | null;
}

export interface GuessRequestJson {
  puzzleId: string;
  playerId: string;
  guess?: string;
  skip?: boolean;
}

export interface GuessResponseJson {
  correct: boolean;
  guessNumber: number;
}

export interface RevealResponseJson {
  answer: string;
  license: string | null;
  attribution: string | null;
}

export interface RecordRequestJson {
  puzzleId: string;
  guessesTaken: number;
  playerId: string | null;
}

export interface DistributionJson {
  counts: GuessCounts;
  total: number;
}

export interface PlayerStatsJson {
  current: number;
  max: number;
  played: number;
  winPct: number;
  counts: GuessCounts;
}

export interface ErrorJson {
  error: string;
}
