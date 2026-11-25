// ADAPTER: CompletionRepository backed by the Supabase `completions` table.
import type { CompletionRepository } from "@/src/application/ports";
import { q, rows, type RestFetch } from "./rest";

export function supabaseCompletionRepository(rest: RestFetch): CompletionRepository {
  return {
    async add(c) {
      await rest("completions", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          puzzle_id: c.puzzleId,
          guesses_taken: c.guessesTaken,
          player_id: c.playerId,
        }),
      });
    },

    async scoresForPuzzle(puzzleId) {
      const res = await rest(`completions?puzzle_id=eq.${q(puzzleId)}&select=guesses_taken`);
      return (await rows<{ guesses_taken: number }>(res)).map((r) => r.guesses_taken);
    },

    async forPlayer(playerId) {
      // puzzles(puzzle_date) asks PostgREST to join each completion to its puzzle's date.
      const res = await rest(`completions?player_id=eq.${q(playerId)}&select=guesses_taken,puzzles(puzzle_date)`);
      const list = await rows<{ guesses_taken: number; puzzles: { puzzle_date: string } | null }>(res);
      return list.map((r) => ({ guessesTaken: r.guesses_taken, puzzleDate: r.puzzles?.puzzle_date ?? null }));
    },
  };
}
