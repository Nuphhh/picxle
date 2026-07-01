// Social-share image = the puzzle's TRUE first stage (8x8), byte-identical to
// what the game shows on guess one. The exact block colours come from Chrome's
// canvas downscaler, which server-side tools can't reproduce, so they are
// precomputed per puzzle (scripts/build-teasers.mjs) and stored in teasers.json.
// Here we just upscale those 8x8 pixels with hard nearest-neighbour blocks.
// Safe to expose: 8x8 never reveals the answer.
//
//   /api/og              -> today's puzzle
//   /api/og?d=2026-07-01 -> that day's puzzle
import sharp from "sharp";
import { supabaseFetch } from "@/lib/supabase";
import teasers from "./teasers.json";

export const runtime = "nodejs";

const SIZE = 1200; // square, full-bleed
const RES = 8;     // the game's first stage (RES_STEPS[0])

// Turn 64 stored RGB pixels into a crisp 1200x1200 PNG (imageSmoothingEnabled=false).
function render(raw) {
  return sharp(raw, { raw: { width: RES, height: RES, channels: 3 } })
    .resize(SIZE, SIZE, { kernel: "nearest" })
    .png()
    .toBuffer();
}

// Fallback only for dates missing from teasers.json (shouldn't happen for real
// puzzles): best-effort centre-crop pixelation. Not colour-identical to the game.
async function fallback(day) {
  const rows = await (await supabaseFetch(`puzzles?puzzle_date=eq.${day}&select=image_src,category`)).json();
  const row = Array.isArray(rows) && rows[0];
  if (!row?.image_src) return null;
  const buf = Buffer.from(await fetch(row.image_src, { headers: { "User-Agent": "PicxleGame/1.0 (og; picxlebypenrose@gmail.com)" } }).then((r) => r.arrayBuffer()));
  const fit = row.category === "Flag" ? "contain" : "cover";
  const master = await sharp(buf).resize(440, 440, { fit, position: "centre", background: { r: 237, g: 232, b: 222 } }).flatten({ background: { r: 237, g: 232, b: 222 } }).toBuffer();
  const small = await sharp(master).resize(RES, RES, { fit: "fill" }).removeAlpha().raw().toBuffer();
  return render(small);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const day = searchParams.get("d") || new Date().toISOString().slice(0, 10);
  let png = null;
  try {
    if (teasers[day]) png = await render(Buffer.from(teasers[day], "base64"));
    else png = await fallback(day);
  } catch { /* fall through to a plain tile */ }
  if (!png) {
    png = await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: { r: 0x17, g: 0x13, b: 0x0d } } }).png().toBuffer();
  }
  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=3600, s-maxage=86400" },
  });
}
