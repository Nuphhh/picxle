import { supabaseFetch } from "@/lib/supabase";
import { normaliseGuess as norm } from "@/lib/normalise";
import { isUuid, getGuesses, isFinished } from "@/lib/guesses";

export const dynamic = "force-dynamic";

// Grades a guess (or records a skip) and logs it in the `guesses` table.
// Logging is what stops brute-forcing: once a player has solved the puzzle or
// used all 5 guesses, every further guess is refused, so a script can't just
// fire the whole dictionary at this endpoint until one comes back correct.
export async function POST(request) {
  const { puzzleId, playerId, guess, skip } = await request.json();

  if (!isUuid(puzzleId) || !isUuid(playerId) || (!skip && !guess)) {
    return Response.json({ error: "Missing or invalid fields." }, { status: 400 });
  }

  const res = await supabaseFetch(`puzzles?id=eq.${puzzleId}&select=accepts`);
  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: "Puzzle not found." }, { status: 404 });
  }

  const previous = await getGuesses(puzzleId, playerId);
  if (isFinished(previous)) {
    return Response.json({ error: "Puzzle already finished." }, { status: 409 });
  }

  const correct = !skip && rows[0].accepts.some((a) => norm(a) === norm(guess));
  const guessNumber = previous.length + 1;

  // If two requests race, both compute the same guessNumber; the table's
  // UNIQUE(puzzle_id, player_id, guess_number) rejects the second one.
  const insert = await supabaseFetch("guesses", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      puzzle_id: puzzleId,
      player_id: playerId,
      guess_number: guessNumber,
      guess: skip ? null : norm(guess),
      correct,
    }),
  });
  if (!insert.ok) {
    return Response.json({ error: "Guess not recorded, try again." }, { status: 409 });
  }

  return Response.json({ correct, guessNumber });
}
