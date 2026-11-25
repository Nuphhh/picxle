// ADAPTER: GuessRepository backed by the Supabase `guesses` table
// (see sql/2026-11-07-guesses.sql).
import type { GuessRepository } from "@/src/application/ports";
import { q, rows, type RestFetch } from "./rest";

export function supabaseGuessRepository(rest: RestFetch): GuessRepository {
  return {
    async forPlayer(puzzleId, playerId) {
      const res = await rest(
        `guesses?puzzle_id=eq.${q(puzzleId)}&player_id=eq.${q(playerId)}&select=guess_number,correct&order=guess_number`,
      );
      const list = await rows<{ guess_number: number; correct: boolean }>(res);
      return list.map((r) => ({ guessNumber: r.guess_number, correct: r.correct }));
    },

    async add(g) {
      const res = await rest("guesses", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          puzzle_id: g.puzzleId,
          player_id: g.playerId,
          guess_number: g.guessNumber,
          guess: g.guess,
          correct: g.correct,
        }),
      });
      return res.ok;
    },
  };
}
