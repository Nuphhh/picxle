// The fixed rules of a Picxle game. Everything else in the app reads these
// numbers from here, so changing the difficulty is a one-line edit.

export const MAX_GUESSES = 5;

// Pixel grid size at each stage: index 0 = before any guess, index 4 = after
// the 4th wrong guess. Each wrong guess moves one step sharper.
export const RES_STEPS: readonly number[] = [8, 12, 19, 29, 45];

// Resolution used once the game is over and the whole picture is revealed.
export const FULL_RES = 220;

// A loss is stored as "6 guesses" in the completions table — one more than the
// maximum — so wins (1-5) and losses (6) share one number in the stats.
export const LOSS_SCORE = MAX_GUESSES + 1;
