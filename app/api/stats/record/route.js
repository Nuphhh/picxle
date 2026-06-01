import { supabaseFetch } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const { puzzleId, guessesTaken } = await request.json();

  if (!puzzleId || !guessesTaken) {
    return Response.json({ error: "Missing fields." }, { status: 400 });
  }

  await supabaseFetch("completions", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ puzzle_id: puzzleId, guesses_taken: guessesTaken }),
  });

  return Response.json({ ok: true });
}
