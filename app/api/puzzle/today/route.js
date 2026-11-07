import { supabaseFetch } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  // Puzzle date is UTC — the puzzle flips at midnight UTC (same for all players globally).
  // This matches Wordle's approach: one shared puzzle per calendar day worldwide.
  const today = new Date().toISOString().slice(0, 10);

  // image_src and attribution are deliberately NOT sent: image filenames usually
  // ARE the answer ("Axolotl.jpg"), and a few attributions name the subject.
  // The browser loads the picture via /api/puzzle/image instead, and gets the
  // attribution from /api/puzzle/reveal once the player has finished.
  const res = await supabaseFetch(
    `puzzles?puzzle_date=eq.${today}&select=id,puzzle_date,category,license`
  );
  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: "No puzzle found for today." }, { status: 404 });
  }

  return Response.json(rows[0]);
}
