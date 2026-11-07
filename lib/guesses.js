// Server-side bookkeeping for guesses, shared by /api/guess and /api/puzzle/reveal.
// The server is the source of truth for "how many guesses has this player used"
// and "have they finished" — the browser's copy in localStorage can be edited,
// so it is only used for display.
import { supabaseFetch } from "@/lib/supabase";
import { MAX_GUESSES } from "@/data/puzzles";

export { MAX_GUESSES };

// IDs get pasted straight into Supabase query strings, so anything that isn't a
// plain UUID is rejected up front. Without this, a "puzzleId" like
// "abc&select=answer" could rewrite the query and pull out the answer.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s) => typeof s === "string" && UUID_RE.test(s);

// Same UTC calendar day the puzzle routes use (puzzle flips at midnight UTC).
export const todayUtc = () => new Date().toISOString().slice(0, 10);

// Every guess this player has made on this puzzle, oldest first.
export async function getGuesses(puzzleId, playerId) {
  const res = await supabaseFetch(
    `guesses?puzzle_id=eq.${puzzleId}&player_id=eq.${playerId}&select=guess_number,correct&order=guess_number`
  );
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

// Finished = solved it, or used every guess.
export const isFinished = (guesses) =>
  guesses.some((g) => g.correct) || guesses.length >= MAX_GUESSES;
