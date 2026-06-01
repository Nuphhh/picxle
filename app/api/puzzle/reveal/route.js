import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Called by the client only after the game ends (won or lost).
// Returns today's answer so it can be shown in the end-game panel.
// Restricts to today's date so future answers can't be harvested.
export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("puzzles")
    .select("answer")
    .eq("puzzle_date", today)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ answer: data.answer });
}
