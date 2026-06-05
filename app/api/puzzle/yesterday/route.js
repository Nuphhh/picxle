import { supabaseFetch } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  // UTC date arithmetic — consistent with today/route.js (midnight UTC flip).
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  const yesterday = d.toISOString().slice(0, 10);

  const res = await supabaseFetch(
    `puzzles?puzzle_date=eq.${yesterday}&select=id,puzzle_date,image_src,category,license,attribution`
  );
  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: "No puzzle found." }, { status: 404 });
  }

  return Response.json(rows[0]);
}
