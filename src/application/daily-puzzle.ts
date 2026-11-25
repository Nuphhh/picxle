// USE CASE: which puzzle is on today (or yesterday)?
// Only the summary goes out — no answer, no image address, no attribution.
// The browser loads the picture through getPuzzleImage instead.
import { addDays, utcDay } from "@/src/domain/dates";
import type { PuzzleSummary } from "@/src/domain/puzzle";
import type { Clock, PuzzleRepository } from "./ports";

type Deps = { puzzles: PuzzleRepository; clock: Clock };

export const todaysPuzzle = (deps: Deps): Promise<PuzzleSummary | null> =>
  deps.puzzles.summaryByDate(utcDay(deps.clock.now()));

export const yesterdaysPuzzle = (deps: Deps): Promise<PuzzleSummary | null> =>
  deps.puzzles.summaryByDate(addDays(utcDay(deps.clock.now()), -1));
