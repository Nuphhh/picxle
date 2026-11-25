// USE CASE: grade a guess (or record a skip) and log it.
//
// Logging is what stops brute-forcing: once a player has solved the puzzle or
// used all 5 guesses, every further guess is refused, so a script can't fire
// the whole dictionary at the endpoint until one comes back correct.
import { isCorrectGuess, isFinished, normaliseGuess } from "@/src/domain/guess";
import { isUuid } from "@/src/domain/ids";
import type { GuessRepository, PuzzleRepository } from "./ports";

export interface SubmitGuessInput {
  puzzleId?: unknown; // `unknown` + optional: it arrives straight from a request body
  playerId?: unknown;
  guess?: unknown;
  skip?: unknown;
}

// A "discriminated union": every result has a `kind`, and TypeScript knows
// which other fields exist for each kind. The HTTP adapter turns each kind into
// a status code; the use case never thinks about HTTP.
export type SubmitGuessResult =
  | { kind: "graded"; correct: boolean; guessNumber: number }
  | { kind: "invalid" }
  | { kind: "not-found" }
  | { kind: "already-finished" }
  | { kind: "not-recorded" };

export async function submitGuess(
  deps: { puzzles: PuzzleRepository; guesses: GuessRepository },
  input: SubmitGuessInput,
): Promise<SubmitGuessResult> {
  const { puzzleId, playerId } = input;
  const skip = !!input.skip;
  const guess = typeof input.guess === "string" ? input.guess : "";
  if (!isUuid(puzzleId) || !isUuid(playerId) || (!skip && !guess)) return { kind: "invalid" };

  const accepts = await deps.puzzles.acceptedAnswers(puzzleId);
  if (!accepts) return { kind: "not-found" };

  const previous = await deps.guesses.forPlayer(puzzleId, playerId);
  if (isFinished(previous)) return { kind: "already-finished" };

  const correct = !skip && isCorrectGuess(accepts, guess);
  const guessNumber = previous.length + 1;

  // If two requests race, both compute the same guessNumber; the table's
  // UNIQUE(puzzle_id, player_id, guess_number) rejects the second one.
  const stored = await deps.guesses.add({
    puzzleId,
    playerId,
    guessNumber,
    guess: skip ? null : normaliseGuess(guess),
    correct,
  });
  if (!stored) return { kind: "not-recorded" };

  return { kind: "graded", correct, guessNumber };
}
