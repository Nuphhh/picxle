// CLIENT PORTS — what the game screen needs from the outside world.
//
// Same idea as ./ports.ts, but for the browser half. The React component
// (components/PicxleGame.tsx) only knows these interfaces. The real versions
// live in src/adapters/browser (fetch + localStorage); tests hand the component
// fakes instead, so it can be played in a test without a server or a browser.
import type { Clock } from "./ports";
import type { GameProgress } from "@/src/domain/game";
import type { PuzzleSummary } from "@/src/domain/puzzle";
import type { PlayerStats, PuzzleDistribution } from "@/src/domain/stats";

/** What the server said about one guess. */
export interface GuessResult {
  correct: boolean;
  guessNumber: number;
}

/** A guess is either some text or a skip. */
export type GuessInput = { guess: string } | { skip: true };

/** The answer and its image credit, once the server allows it. */
export interface Reveal {
  answer: string | null;
  attribution: string | null;
}

/**
 * Talks to the Picxle API. Methods that can fail in a way the screen cares
 * about say so in their return type (null). Anything else throws, and the
 * screen simply carries on without that bit of information.
 */
export interface GameApi {
  /** Today's puzzle, or null when there isn't one. Throws if offline. */
  todayPuzzle(): Promise<PuzzleSummary | null>;
  /** Yesterday's puzzle, or null for any failure (it's only ever a bonus). */
  yesterdayPuzzle(): Promise<PuzzleSummary | null>;
  /** null = the server didn't record it, so the guess must not be used up. */
  submitGuess(puzzleId: string, playerId: string, input: GuessInput): Promise<GuessResult | null>;
  reveal(puzzleId: string, playerId: string): Promise<Reveal>;
  puzzleStats(puzzleId: string): Promise<PuzzleDistribution>;
  playerStats(playerId: string): Promise<PlayerStats>;
  /** Resolves once the server has answered (whatever it said); throws if offline. */
  recordCompletion(c: { puzzleId: string; guessesTaken: number; playerId: string | null }): Promise<void>;
  /** Where to load a puzzle's image from (by ID — never the real file address). */
  imageUrl(puzzleId: string): string;
}

/** What the device remembers about each puzzle between visits. */
export interface ProgressStore {
  load(puzzleId: string): GameProgress | null;
  save(puzzleId: string, progress: GameProgress): void;
  /** Has this result already been sent to the stats table? (Never count twice.) */
  isRecorded(puzzleId: string): boolean;
  markRecorded(puzzleId: string): void;
  /** Did the player say "no thanks" to this (yesterday's) puzzle? */
  isDeclined(puzzleId: string): boolean;
  markDeclined(puzzleId: string): void;
}

/** How a share went: the OS sheet opened, it was copied instead, or the player backed out. */
export type ShareOutcome = "shared" | "copied" | "cancelled";

export type TrackFn = (event: string, props?: Record<string, unknown>) => void;

/** Everything PicxleGame needs, in one bundle. */
export interface GameDeps {
  api: GameApi;
  progress: ProgressStore;
  clock: Clock;
  /** This device's anonymous player ID. */
  playerId: () => string;
  track: TrackFn;
  share: (text: string) => Promise<ShareOutcome>;
  /** Called once when a game is won (counts wins, may ask for an app review). */
  onWin: () => void;
}
