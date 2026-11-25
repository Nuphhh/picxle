// ADAPTERS: in-memory versions of every server port, backed by plain arrays.
//
// They behave like the Supabase ones (including the UNIQUE rule on guesses),
// but live entirely in memory. Tests build a fresh set per test, so each test
// starts from a known state and nothing touches the real database.
import type {
  Clock,
  CompletionRepository,
  GuessRepository,
  NewCompletion,
  NewGuess,
  PuzzleRepository,
  ServerDeps,
} from "@/src/application/ports";
import type { IsoDay } from "@/src/domain/dates";

/** Every column of a puzzle — only the server's storage ever holds all of this. */
export interface PuzzleRecord {
  id: string;
  date: IsoDay;
  category: string;
  license: string | null;
  attribution: string | null;
  imageSrc: string | null;
  answer: string;
  accepts: string[];
}

export function memoryPuzzleRepository(puzzles: PuzzleRecord[]): PuzzleRepository {
  const byId = (id: string) => puzzles.find((p) => p.id === id) ?? null;
  const byDate = (day: IsoDay) => puzzles.find((p) => p.date === day) ?? null;
  const imageOf = (p: PuzzleRecord | null) =>
    p?.imageSrc ? { imageSrc: p.imageSrc, date: p.date, category: p.category } : null;

  return {
    async summaryByDate(day) {
      const p = byDate(day);
      return p && { id: p.id, date: p.date, category: p.category, license: p.license };
    },
    async idByDate(day) {
      return byDate(day)?.id ?? null;
    },
    async acceptedAnswers(id) {
      return byId(id)?.accepts ?? null;
    },
    async reveal(id) {
      const p = byId(id);
      return p && { answer: p.answer, date: p.date, license: p.license, attribution: p.attribution };
    },
    async image(id) {
      return imageOf(byId(id));
    },
    async imageByDate(day) {
      return imageOf(byDate(day));
    },
    async creditsBefore(day) {
      return puzzles
        .filter((p) => p.date < day)
        .map((p) => ({ imageSrc: p.imageSrc ?? "", license: p.license, attribution: p.attribution }));
    },
  };
}

export function memoryGuessRepository(log: NewGuess[] = []): GuessRepository & { log: NewGuess[] } {
  return {
    log,
    async forPlayer(puzzleId, playerId) {
      return log
        .filter((g) => g.puzzleId === puzzleId && g.playerId === playerId)
        .sort((a, b) => a.guessNumber - b.guessNumber)
        .map((g) => ({ guessNumber: g.guessNumber, correct: g.correct }));
    },
    async add(g) {
      // Mirrors UNIQUE(puzzle_id, player_id, guess_number) in the real table.
      const clash = log.some(
        (x) => x.puzzleId === g.puzzleId && x.playerId === g.playerId && x.guessNumber === g.guessNumber,
      );
      if (clash) return false;
      log.push(g);
      return true;
    },
  };
}

export function memoryCompletionRepository(
  puzzles: PuzzleRecord[],
  rows: NewCompletion[] = [],
): CompletionRepository & { rows: NewCompletion[] } {
  return {
    rows,
    async add(c) {
      rows.push(c);
    },
    async scoresForPuzzle(puzzleId) {
      return rows.filter((r) => r.puzzleId === puzzleId).map((r) => r.guessesTaken);
    },
    async forPlayer(playerId) {
      return rows
        .filter((r) => r.playerId === playerId)
        .map((r) => ({
          guessesTaken: r.guessesTaken,
          puzzleDate: puzzles.find((p) => p.id === r.puzzleId)?.date ?? null,
        }));
    },
  };
}

/** A clock stuck at one moment. `set` moves it, e.g. to "tomorrow". */
export function fixedClock(iso: string): Clock & { set(iso: string): void } {
  let now = new Date(iso);
  return {
    now: () => new Date(now),
    set(next) {
      now = new Date(next);
    },
  };
}

/** A complete set of in-memory server dependencies. */
export function memoryServerDeps(puzzles: PuzzleRecord[], nowIso: string) {
  const guesses = memoryGuessRepository();
  const completions = memoryCompletionRepository(puzzles);
  const deps = {
    puzzles: memoryPuzzleRepository(puzzles),
    guesses,
    completions,
    clock: fixedClock(nowIso),
  } satisfies ServerDeps;
  return deps;
}
