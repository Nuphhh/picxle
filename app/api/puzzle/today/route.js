import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("puzzles")
    .select("id, puzzle_date, image_src, category, license, attribution")
    .eq("puzzle_date", today)
    .single();

  if (error || !data) {
    return Response.json({ error: "No puzzle found for today." }, { status: 404 });
  }

  return Response.json(data);
}
