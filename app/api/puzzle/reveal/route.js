import { supabaseFetch } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const res = await supabaseFetch(`puzzles?puzzle_date=eq.${today}&select=answer`);
  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  return Response.json({ answer: rows[0].answer });
}
