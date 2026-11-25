// PORTS — the "sockets" the application core plugs into.
//
// Hexagonal architecture in one sentence: the core (domain + use cases) says
// WHAT it needs from the outside world as interfaces, and ADAPTERS
// (src/adapters/...) say HOW — Supabase, fetch(), sharp, localStorage.
//
// Why bother? Two reasons you'll feel straight away:
//   1. Tests swap in fake adapters (src/adapters/memory) — no database, no
//      network, and every test runs in milliseconds.
//   2. Swapping Supabase for something else later only touches one folder.
//
// Rule of thumb: nothing in src/domain or src/application imports from
// src/adapters, next/*, react, or a database library. Dependencies point inward.
import type { IsoDay } from "@/src/domain/dates";
import type { GuessRecord } from "@/src/domain/guess";
import type { CreditEntry } from "@/src/domain/credits";
import type { PuzzleImage, PuzzleReveal, PuzzleSummary } from "@/src/domain/puzzle";
import type { PlayerCompletion } from "@/src/domain/stats";

// ── Driven ports (the core calls out through these) ─────────────────────────

/**
 * Reads puzzles. Each method fetches only the columns its use case needs, so
 * the answer is never loaded by code that has no business seeing it.
 */
export interface PuzzleRepository {
  summaryByDate(day: IsoDay): Promise<PuzzleSummary | null>;
  idByDate(day: IsoDay): Promise<string | null>;
  acceptedAnswers(puzzleId: string): Promise<string[] | null>;
  reveal(puzzleId: string): Promise<PuzzleReveal | null>;
  image(puzzleId: string): Promise<PuzzleImage | null>;
  imageByDate(day: IsoDay): Promise<PuzzleImage | null>;
  creditsBefore(day: IsoDay): Promise<CreditEntry[]>;
}

export interface NewGuess {
  puzzleId: string;
  playerId: string;
  guessNumber: number;
  guess: string | null; // null = skipped
  correct: boolean;
}

/** The server's guess log — the source of truth for "has this player finished". */
export interface GuessRepository {
  forPlayer(puzzleId: string, playerId: string): Promise<GuessRecord[]>;
  /** false if it wasn't stored (e.g. a duplicate guess number from a race). */
  add(guess: NewGuess): Promise<boolean>;
}

export interface NewCompletion {
  puzzleId: string;
  guessesTaken: number;
  playerId: string | null;
}

export interface CompletionRepository {
  add(completion: NewCompletion): Promise<void>;
  scoresForPuzzle(puzzleId: string): Promise<number[]>;
  forPlayer(playerId: string): Promise<PlayerCompletion[]>;
}

/** An image fetched from somewhere else on the internet. */
export interface RemoteImage {
  ok: boolean;
  contentType: string;
  body: ReadableStream<Uint8Array> | null;
  bytes(): Promise<Uint8Array>;
}

export interface ImageFetcher {
  /** null when the address couldn't be reached at all. */
  fetch(url: string): Promise<RemoteImage | null>;
}

/** Precomputed 8×8 share teasers (raw RGB), keyed by puzzle day. */
export interface TeaserStore {
  get(day: IsoDay): Uint8Array | null;
}

/** Turns pixels into the 1200×1200 PNG used as a link preview. */
export interface ShareImageRenderer {
  fromTeaser(rawRgb: Uint8Array): Promise<Uint8Array>;
  fromImage(bytes: Uint8Array, fit: "contain" | "cover"): Promise<Uint8Array>;
  blank(): Promise<Uint8Array>;
}

/** "What time is it?" — a port so tests can freeze time. */
export interface Clock {
  now(): Date;
}

/** Everything the server-side use cases might need, in one bag. */
export interface ServerDeps {
  puzzles: PuzzleRepository;
  guesses: GuessRepository;
  completions: CompletionRepository;
  clock: Clock;
}
