import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Never cache — puzzle must reflect today's actual date on every request.
export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" in UTC

  const { data, error } = await supabase
    .from("puzzles")
    .select("id, puzzle_date, image_src, category, license, attribution")
    // answer and accepts are intentionally excluded — they stay server-side only
    .eq("puzzle_date", today)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "No puzzle found for today." },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
