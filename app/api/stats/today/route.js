import { supabaseFetch } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const puzzleRes = await supabaseFetch(`puzzles?puzzle_date=eq.${today}&select=id`);
  const puzzles = await puzzleRes.json();

  if (!Array.isArray(puzzles) || puzzles.length === 0) {
    return Response.json({ error: "No puzzle today." }, { status: 404 });
  }

  const puzzleId = puzzles[0].id;

  const completionsRes = await supabaseFetch(
    `completions?puzzle_id=eq.${puzzleId}&select=guesses_taken`
  );
  const completions = await completionsRes.json();

  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  if (Array.isArray(completions)) {
    for (const c of completions) {
      const g = c.guesses_taken;
      if (g >= 1 && g <= 6) counts[g]++;
    }
  }

  return Response.json({ counts, total: Array.isArray(completions) ? completions.length : 0 });
}
