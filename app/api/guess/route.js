import { supabaseFetch } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const norm = (s) =>
  s.trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

export async function POST(request) {
  const { puzzleId, guess } = await request.json();

  if (!puzzleId || !guess) {
    return Response.json({ error: "Missing puzzleId or guess." }, { status: 400 });
  }

  const res = await supabaseFetch(`puzzles?id=eq.${puzzleId}&select=accepts`);
  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: "Puzzle not found." }, { status: 404 });
  }

  const correct = rows[0].accepts.some((a) => norm(a) === norm(guess));

  return Response.json({ correct });
}
