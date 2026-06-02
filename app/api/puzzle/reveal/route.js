import { supabaseFetch } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const puzzleId = searchParams.get("puzzleId");

  // If a specific puzzle ID is provided use it, otherwise fall back to today's puzzle
  const query = puzzleId
    ? `puzzles?id=eq.${puzzleId}&select=answer`
    : `puzzles?puzzle_date=eq.${new Date().toISOString().slice(0, 10)}&select=answer`;

  const res = await supabaseFetch(query);
  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  return Response.json({ answer: rows[0].answer });
}
