import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("puzzles")
    .select("answer")
    .eq("puzzle_date", today)
    .single();

  if (error || !data) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  return Response.json({ answer: data.answer });
}
