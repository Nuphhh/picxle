// Serves a puzzle's image without ever telling the browser where it came from.
//
// WHY: image addresses give the answer away. Today's was
// ".../commons/d/df/Axolotl.jpg" — anyone who opened the browser's network tab
// could read the answer before guessing. So the browser only ever asks for
// /api/puzzle/image?puzzleId=<uuid>, and this route fetches the real file on the
// server and passes the bytes straight through.
//
// The bytes are passed through UNCHANGED (no resizing). The game's pixelation
// comes from Chrome downscaling the original file, and the share images in
// app/api/og/teasers.json were built from those exact originals — resizing here
// would make the first stage subtly different from the share image.
import { supabaseFetch } from "@/lib/supabase";
import { isUuid, todayUtc } from "@/lib/guesses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Wikimedia rate-limits (HTTP 429) requests that don't say who they are.
const UA = "PicxleGame/1.0 (image proxy; picxlebypenrose@gmail.com)";

export async function GET(request) {
  const puzzleId = new URL(request.url).searchParams.get("puzzleId");
  if (!isUuid(puzzleId)) {
    return Response.json({ error: "Missing or invalid puzzleId." }, { status: 400 });
  }

  const rows = await (await supabaseFetch(`puzzles?id=eq.${puzzleId}&select=image_src,puzzle_date`)).json();
  const row = Array.isArray(rows) && rows[0];
  // Future puzzles are never served — not even pixelated, since this is the
  // full-resolution file.
  if (!row?.image_src || row.puzzle_date > todayUtc()) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const upstream = await fetch(row.image_src, { headers: { "User-Agent": UA } }).catch(() => null);
  const type = upstream?.headers.get("content-type") || "";
  if (!upstream?.ok || !type.startsWith("image/")) {
    return Response.json({ error: "Image unavailable." }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": type,
      // A puzzle's image never changes, so let Vercel's CDN keep it for a week
      // (s-maxage) and browsers for a day. After the first player in a region,
      // nobody else's request reaches this function or Wikimedia at all.
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      // The mobile app loads from a different origin and draws the image onto a
      // canvas; without this header the canvas is "tainted" and pixelation fails.
      "Access-Control-Allow-Origin": "*",
      // Some flags are SVGs. If someone opened this URL directly, an SVG could run
      // script on our domain — this header stops that. <img> is unaffected.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
