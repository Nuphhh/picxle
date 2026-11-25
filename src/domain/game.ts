// The state of one player's game on one puzzle, and the rules for moving it
// forward. The React component holds this state; these functions decide what
// the next state is. Keeping the decisions here (not inside the component)
// means they can be tested without a browser.
import { FULL_RES, LOSS_SCORE, MAX_GUESSES, RES_STEPS } from "./rules.ts";

// A "union of string literals": status can only ever be one of these three.
// TypeScript will flag a typo like "lose" at compile time.
export type GameStatus = "playing" | "won" | "lost";

/** One filled-in guess row as the player sees it. */
export interface GuessRow {
  text: string | null; // what they typed (null for a skip)
  correct: boolean;
  skipped: boolean;
}

/** Everything needed to redraw a game — this is what gets saved per puzzle. */
export interface GameProgress {
  guesses: GuessRow[];
  status: GameStatus;
}

export const NEW_GAME: GameProgress = { guesses: [], status: "playing" };

/**
 * Add a graded guess and work out the new status. Returns a NEW object rather
 * than changing the old one — React only re-renders when it sees a new object.
 */
export function addGuess(progress: GameProgress, row: GuessRow): GameProgress {
  if (progress.status !== "playing") return progress;
  const guesses = [...progress.guesses, row];
  const status: GameStatus = row.correct
    ? "won"
    : guesses.length >= MAX_GUESSES
      ? "lost"
      : "playing";
  return { guesses, status };
}

export const guessRow = (text: string, correct: boolean): GuessRow => ({
  text,
  correct,
  skipped: false,
});

export const SKIP_ROW: GuessRow = { text: null, correct: false, skipped: true };

export const isRevealed = (p: GameProgress): boolean => p.status !== "playing";

/**
 * The pixel grid to draw right now: one step sharper per guess made, and the
 * full picture once the game is over. This IS the signature mechanic.
 */
export function resolutionFor(p: GameProgress): number {
  if (isRevealed(p)) return FULL_RES;
  return RES_STEPS[Math.min(p.guesses.length, RES_STEPS.length - 1)];
}

/** The number stored in the completions table: guesses used, or 6 for a loss. */
export const completionScore = (p: GameProgress): number =>
  p.status === "won" ? p.guesses.length : LOSS_SCORE;

/**
 * The headline on the results screen. `tone` names a theme colour rather than
 * holding one, so the domain doesn't know about CSS.
 */
export type Tone = "blue" | "green" | "cream" | "dim" | "coral";

const WIN_MESSAGES: { text: string; tone: Tone }[] = [
  { text: "Absolutely unreal.", tone: "blue" },
  { text: "Sharp eye.", tone: "green" },
  { text: "Solid.", tone: "green" },
  { text: "Got there in the end.", tone: "cream" },
  { text: "That was close.", tone: "dim" },
];

export function resultMessage(p: GameProgress): { text: string; tone: Tone } {
  if (p.status === "won") {
    const i = Math.min(Math.max(p.guesses.length, 1), WIN_MESSAGES.length) - 1;
    return WIN_MESSAGES[i];
  }
  return { text: "Better luck tomorrow.", tone: "coral" };
}

/**
 * Saved progress comes back from localStorage as untyped JSON that anyone can
 * edit. Check its shape before trusting it; anything odd counts as "no save".
 */
export function parseProgress(value: unknown): GameProgress | null {
  if (!value || typeof value !== "object") return null;
  const { guesses, status } = value as Record<string, unknown>;
  if (status !== "playing" && status !== "won" && status !== "lost") return null;
  if (!Array.isArray(guesses)) return null;
  const rows: GuessRow[] = [];
  for (const g of guesses) {
    if (!g || typeof g !== "object") return null;
    const { text, correct, skipped } = g as Record<string, unknown>;
    rows.push({
      text: typeof text === "string" ? text : null,
      correct: correct === true,
      skipped: skipped === true,
    });
  }
  return { guesses: rows, status };
}
