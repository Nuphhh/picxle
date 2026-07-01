// Social-share image = the puzzle's FIRST stage (8x8), rendered exactly like the
// game: hard-edged nearest-neighbour blocks, no branding, full-bleed. Safe to
// show publicly because 8x8 is unrecognisable and never reveals the answer.
//
//   /api/og              -> today's puzzle
//   /api/og?d=2026-07-01 -> that day's puzzle
import sharp from "sharp";
import { supabaseFetch } from "@/lib/supabase";

export const runtime = "nodejs";

const UA = "PicxleGame/1.0 (Open Graph image; picxlebypenrose@gmail.com)";
const SIZE = 1200; // square, full-bleed
const RES = 8;     // matches the game's first stage (RES_STEPS[0])

async function pixelate(day) {
  const res = await supabaseFetch(`puzzles?puzzle_date=eq.${day}&select=image_src`);
  const rows = await res.json();
  const src = Array.isArray(rows) && rows[0] && rows[0].image_src;
  if (!src) return null;
  const buf = Buffer.from(await fetch(src, { headers: { "User-Agent": UA } }).then((r) => r.arrayBuffer()));
  // sharp collapses chained .resize() calls, so do it in two passes:
  // 1) downscale to 8x8 (fit:"fill" stretches to square, like the game draws it)
  const small = await sharp(buf).resize(RES, RES, { fit: "fill" }).png().toBuffer();
  // 2) upscale with nearest-neighbour = crisp hard blocks (imageSmoothingEnabled=false)
  return sharp(small).resize(SIZE, SIZE, { kernel: "nearest" }).png().toBuffer();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const day = searchParams.get("d") || new Date().toISOString().slice(0, 10);
  let png = null;
  try { png = await pixelate(day); } catch { /* fall through to a plain tile */ }
  if (!png) {
    png = await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: { r: 0x17, g: 0x13, b: 0x0d } } }).png().toBuffer();
  }
  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=3600, s-maxage=86400" },
  });
}
