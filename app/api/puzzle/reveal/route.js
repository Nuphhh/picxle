import { supabaseFetch } from "@/lib/supabase";
import { isUuid, todayUtc, getGuesses, isFinished } from "@/lib/guesses";

export const dynamic = "force-dynamic";

// Hands out a puzzle's answer, but only when the player is allowed to see it:
//   - the puzzle's day is over (yesterday and earlier are no longer secret), or
//   - this player has finished it, per the server's own guess log.
// The guess log is written by /api/guess, not by the browser, so a player
// can't just claim to be finished.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const puzzleId = searchParams.get("puzzleId");
  const playerId = searchParams.get("playerId");

  if (!isUuid(puzzleId)) {
    return Response.json({ error: "Missing or invalid puzzleId." }, { status: 400 });
  }

  const res = await supabaseFetch(`puzzles?id=eq.${puzzleId}&select=answer,puzzle_date`);
  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const { answer, puzzle_date } = rows[0];
  const dayIsOver = puzzle_date < todayUtc(); // "YYYY-MM-DD" strings compare correctly

  if (!dayIsOver) {
    const finished = isUuid(playerId) && isFinished(await getGuesses(puzzleId, playerId));
    if (!finished) {
      return Response.json({ error: "Finish the puzzle first." }, { status: 403 });
    }
  }

  return Response.json({ answer });
}
