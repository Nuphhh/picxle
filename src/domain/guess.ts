// Everything about judging a guess. Pure functions only — no database, no
// browser — so the server, the browser and the ops scripts all share it.
import { MAX_GUESSES } from "./rules.ts";

/**
 * Normalise a guess for comparison.
 *
 * SHARED by the client and the server on purpose: the client uses it to decide
 * whether a word is typeable at all (it blocks anything not in the dictionary),
 * and the server uses it to decide whether a guess is correct. If the two ever
 * disagreed, a player could type a word the server would accept and be told it
 * is not a word.
 *
 * Folds accents rather than deleting them: NFD splits "í" into "i" + a
 * combining accent, so dropping the combining marks leaves a clean "i"
 * ("família" -> "familia", not "famlia").
 */
export function normaliseGuess(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining accents: é->e, í->i, ç->c, ã->a
    .toLowerCase()
    .replace(/['’`]/g, "") // basil's -> basils (apostrophe joins the word)
    .replace(/[^a-z0-9]+/g, " ") // hyphens etc SEPARATE: mont-saint-michel -> mont saint michel
    .replace(/\s+/g, " ")
    .trim();
}

/** Is `guess` one of the puzzle's accepted answers (after normalising both)? */
export function isCorrectGuess(accepts: readonly string[], guess: string): boolean {
  const g = normaliseGuess(guess);
  if (!g) return false;
  return accepts.some((a) => normaliseGuess(a) === g);
}

/** One row of the server's guess log. */
export interface GuessRecord {
  guessNumber: number;
  correct: boolean;
}

/** Finished = solved it, or used every guess. */
export const isFinished = (log: readonly GuessRecord[]): boolean =>
  log.some((g) => g.correct) || log.length >= MAX_GUESSES;
