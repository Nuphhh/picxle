import { supabaseFetch } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Compute current and best streak from a sorted list of unique date strings (YYYY-MM-DD).
function computeStreaks(dates) {
  const unique = [...new Set(dates)].sort(); // ascending
  if (!unique.length) return { current: 0, max: 0 };

  // Best streak: longest run of consecutive calendar days
  let max = 1, run = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1] + "T00:00:00Z");
    const curr = new Date(unique[i] + "T00:00:00Z");
    const gap = Math.round((curr - prev) / 86_400_000);
    if (gap === 1) { run++; if (run > max) max = run; }
    else run = 1;
  }

  // Current streak: walk backward from today
  const today = new Date().toISOString().slice(0, 10);
  const dateSet = new Set(unique);
  let current = 0;
  let check = today;
  while (dateSet.has(check)) {
    current++;
    const d = new Date(check + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    check = d.toISOString().slice(0, 10);
  }

  return { current, max };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get("playerId");

  if (!playerId) return Response.json({ error: "Missing playerId." }, { status: 400 });

  // Fetch all completions for this player, joining to get each puzzle's date
  const res = await supabaseFetch(
    `completions?player_id=eq.${playerId}&select=guesses_taken,puzzles(puzzle_date)`
  );
  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ current: 0, max: 0, played: 0, winPct: 0 });
  }

  const dates = rows.map((r) => r.puzzles?.puzzle_date).filter(Boolean);
  const played = rows.length;
  const won = rows.filter((r) => r.guesses_taken < 6).length;
  const winPct = played > 0 ? Math.round((won / played) * 100) : 0;
  const { current, max } = computeStreaks(dates);

  return Response.json({ current, max, played, winPct });
}
