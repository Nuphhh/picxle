// USE CASES: record a finished game, and read back stats.
import { utcDay } from "@/src/domain/dates";
import { isUuid } from "@/src/domain/ids";
import {
  playerStats,
  puzzleDistribution,
  SCORES,
  type PlayerStats,
  type PuzzleDistribution,
  type Score,
} from "@/src/domain/stats";
import type { Clock, CompletionRepository, PuzzleRepository } from "./ports";

export type RecordResult = { kind: "recorded" } | { kind: "invalid" };

export async function recordCompletion(
  deps: { completions: CompletionRepository },
  input: { puzzleId?: unknown; guessesTaken?: unknown; playerId?: unknown },
): Promise<RecordResult> {
  const { puzzleId, guessesTaken, playerId } = input;
  if (!isUuid(puzzleId) || !SCORES.includes(guessesTaken as Score)) return { kind: "invalid" };
  if (playerId != null && !isUuid(playerId)) return { kind: "invalid" };

  await deps.completions.add({
    puzzleId,
    guessesTaken: guessesTaken as Score,
    playerId: playerId ?? null,
  });
  return { kind: "recorded" };
}

export type DistributionResult =
  | ({ kind: "distribution" } & PuzzleDistribution)
  | { kind: "invalid" }
  | { kind: "no-puzzle" };

/** Everyone's guess distribution for a puzzle (today's if no ID is given). */
export async function puzzleStats(
  deps: { puzzles: PuzzleRepository; completions: CompletionRepository; clock: Clock },
  puzzleIdParam: string | null,
): Promise<DistributionResult> {
  let puzzleId = puzzleIdParam;
  if (puzzleId) {
    if (!isUuid(puzzleId)) return { kind: "invalid" };
  } else {
    puzzleId = await deps.puzzles.idByDate(utcDay(deps.clock.now()));
    if (!puzzleId) return { kind: "no-puzzle" };
  }
  const scores = await deps.completions.scoresForPuzzle(puzzleId);
  return { kind: "distribution", ...puzzleDistribution(scores) };
}

export type PlayerStatsResult = ({ kind: "stats" } & PlayerStats) | { kind: "invalid" };

export async function playerStatsFor(
  deps: { completions: CompletionRepository; clock: Clock },
  playerId: unknown,
): Promise<PlayerStatsResult> {
  if (!isUuid(playerId)) return { kind: "invalid" };
  const rows = await deps.completions.forPlayer(playerId);
  return { kind: "stats", ...playerStats(rows, utcDay(deps.clock.now())) };
}
