import { supabaseFetch } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  // Puzzle date is UTC — the puzzle flips at midnight UTC (same for all players globally).
  // This matches Wordle's approach: one shared puzzle per calendar day worldwide.
  const today = new Date().toISOString().slice(0, 10);

  const res = await supabaseFetch(
    `puzzles?puzzle_date=eq.${today}&select=id,puzzle_date,image_src,category,license,attribution`
  );
  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: "No puzzle found for today." }, { status: 404 });
  }

  return Response.json(rows[0]);
}
