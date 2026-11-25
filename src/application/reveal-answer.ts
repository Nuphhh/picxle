// USE CASE: hand out a puzzle's answer — but only when the player may see it:
//   - the puzzle's day is over (yesterday and earlier are no longer secret), or
//   - this player has finished it, per the server's own guess log.
// The guess log is written by submitGuess, not by the browser, so a player
// can't just claim to be finished.
import { utcDay } from "@/src/domain/dates";
import { publicAttribution } from "@/src/domain/credits";
import { isFinished } from "@/src/domain/guess";
import { isUuid } from "@/src/domain/ids";
import type { Clock, GuessRepository, PuzzleRepository } from "./ports";

export type RevealResult =
  | { kind: "revealed"; answer: string; license: string | null; attribution: string | null }
  | { kind: "invalid" }
  | { kind: "not-found" }
  | { kind: "forbidden" };

export async function revealAnswer(
  deps: { puzzles: PuzzleRepository; guesses: GuessRepository; clock: Clock },
  input: { puzzleId: unknown; playerId: unknown },
): Promise<RevealResult> {
  const { puzzleId, playerId } = input;
  if (!isUuid(puzzleId)) return { kind: "invalid" };

  const puzzle = await deps.puzzles.reveal(puzzleId);
  if (!puzzle) return { kind: "not-found" };

  const dayIsOver = puzzle.date < utcDay(deps.clock.now());
  if (!dayIsOver) {
    const finished = isUuid(playerId) && isFinished(await deps.guesses.forPlayer(puzzleId, playerId));
    if (!finished) return { kind: "forbidden" };
  }

  // The image credit travels with the answer: a few attributions name the
  // subject, and CC-BY needs the credit shown where the image is shown — the
  // results screen.
  return {
    kind: "revealed",
    answer: puzzle.answer,
    license: puzzle.license,
    attribution: publicAttribution(puzzle.attribution),
  };
}
