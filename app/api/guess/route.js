import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Normalise a guess the same way the frontend does, so matching is consistent.
const norm = (s) =>
  s.trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

export async function POST(request) {
  const { puzzleId, guess } = await request.json();

  if (!puzzleId || !guess) {
    return NextResponse.json({ error: "Missing puzzleId or guess." }, { status: 400 });
  }

  // Fetch only the fields needed for validation — answer never leaves this route.
  const { data, error } = await supabase
    .from("puzzles")
    .select("accepts")
    .eq("id", puzzleId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Puzzle not found." }, { status: 404 });
  }

  const correct = data.accepts.some((a) => norm(a) === norm(guess));

  return NextResponse.json({ correct });
}
