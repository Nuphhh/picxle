// USE CASE: the image credits page.
// Only puzzles whose day is OVER: source links are image addresses, and those
// usually name the answer. Today's image is credited on the results screen
// instead, and appears here from tomorrow.
import { creditList, type CreditEntry } from "@/src/domain/credits";
import { utcDay } from "@/src/domain/dates";
import type { Clock, PuzzleRepository } from "./ports";

export async function listCredits(deps: { puzzles: PuzzleRepository; clock: Clock }): Promise<CreditEntry[]> {
  const rows = await deps.puzzles.creditsBefore(utcDay(deps.clock.now()));
  return creditList(rows);
}
