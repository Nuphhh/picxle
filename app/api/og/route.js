// Dynamic Open Graph card for link unfurls. Renders the puzzle's FIRST stage
// (8x8) pixelation as a branded teaser — safe to show publicly because 8x8 is
// unrecognisable and never reveals the answer.
//
//   /api/og            -> today's puzzle
//   /api/og?d=2026-07-01 -> that day's puzzle
//
// How: sharp downsamples the puzzle image to 8x8 and reads the 64 colours;
// ImageResponse (Satori) can't pixelate an image itself, so we render those 64
// colours as an 8x8 grid of blocks — which matches the game's first stage.
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { supabaseFetch } from "@/lib/supabase";
import { readFileSync } from "node:fs";

export const runtime = "nodejs";

const UA = "PicxleGame/1.0 (Open Graph card generator; picxlebypenrose@gmail.com)";
const INK = "#17130d";
const INK2 = "#221b12";
const CREAM = "#f4ead7";
const DIM = "#cdbfa6";
const BLUE = "#3b82f6";
const LINE = "#3a3024";

// Bundled brand font, loaded once. new URL(..., import.meta.url) is statically
// analysable so Next traces the .ttf into the serverless function bundle.
let FONT = null;
try { FONT = readFileSync(new URL("./font.ttf", import.meta.url)); } catch {}

async function sample64(date) {
  const day = date || new Date().toISOString().slice(0, 10);
  const res = await supabaseFetch(`puzzles?puzzle_date=eq.${day}&select=image_src`);
  const rows = await res.json();
  const src = Array.isArray(rows) && rows[0] && rows[0].image_src;
  if (!src) return null;
  const buf = await fetch(src, { headers: { "User-Agent": UA } }).then((r) => r.arrayBuffer());
  // fit:"fill" stretches to 8x8 exactly like the game draws the source square.
  const { data } = await sharp(Buffer.from(buf))
    .resize(8, 8, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors = [];
  for (let i = 0; i < 64; i++) colors.push(`rgb(${data[i * 3]},${data[i * 3 + 1]},${data[i * 3 + 2]})`);
  return colors;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  let colors = null;
  try { colors = await sample64(searchParams.get("d")); } catch { /* fall back to blank grid */ }

  const fonts = FONT ? [{ name: "Picxle", data: FONT, weight: 800, style: "normal" }] : [];
  const fontFamily = "Picxle";

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: INK, alignItems: "center", justifyContent: "center", fontFamily }}>
        <div style={{ display: "flex", fontSize: 70, fontWeight: 800, color: CREAM, letterSpacing: "-3px" }}>
          PIC<span style={{ color: BLUE }}>X</span>LE
        </div>
        <div style={{ display: "flex", fontSize: 26, color: DIM, marginTop: 4, marginBottom: 30 }}>
          Can you guess today&apos;s puzzle?
        </div>
        <div style={{ display: "flex", flexDirection: "column", borderRadius: 18, overflow: "hidden", border: `1px solid ${LINE}` }}>
          {colors
            ? Array.from({ length: 8 }, (_, y) => (
                <div key={y} style={{ display: "flex" }}>
                  {Array.from({ length: 8 }, (_, x) => (
                    <div key={x} style={{ width: 52, height: 52, background: colors[y * 8 + x] }} />
                  ))}
                </div>
              ))
            : <div style={{ display: "flex", width: 416, height: 416, background: INK2 }} />}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400" },
    }
  );
}
