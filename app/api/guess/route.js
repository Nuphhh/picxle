import { getSupabase } from "@/lib/supabase";

const norm = (s) =>
  s.trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

export async function POST(request) {
  const { puzzleId, guess } = await request.json();

  if (!puzzleId || !guess) {
    return Response.json({ error: "Missing puzzleId or guess." }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("puzzles")
    .select("accepts")
    .eq("id", puzzleId)
    .single();

  if (error || !data) {
    return Response.json({ error: "Puzzle not found." }, { status: 404 });
  }

  const correct = data.accepts.some((a) => norm(a) === norm(guess));

  return Response.json({ correct });
}
