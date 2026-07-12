// Full-size review sheets for GENERATED images only. Thumbnails hide the defects
// that matter (a two-headed camel and a headless piper both survived a contact
// sheet), so these are rendered big enough to count heads, limbs and fingers.
// Usage: node scripts/review-gen.mjs <category|all> [sheetIndex]
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const D = "C:/Users/Nath/AppData/Local/Temp/claude/C--Users-Nath/d16d015c-ca8e-4839-a477-0a5c16d09a93/scratchpad";
const rows = JSON.parse(fs.readFileSync(path.join(process.cwd(), "..", "new-puzzles.json"), "utf8"));
const cat = process.argv[2] || "all";
const gen = rows.filter((r) => r.source === "generated" && (cat === "all" || r.category === cat));

const S = 560, COLS = 2, PER = 4;
const sheets = Math.ceil(gen.length / PER);
for (let sh = 0; sh < sheets; sh++) {
  const batch = gen.slice(sh * PER, (sh + 1) * PER);
  const tiles = [];
  for (const r of batch) {
    const f = path.join(process.cwd(), "public", "puzzles", path.basename(new URL(r.image_src).pathname));
    tiles.push(await sharp(fs.readFileSync(f)).resize(S, S, { fit: "cover" }).toBuffer());
  }
  const nRows = Math.ceil(tiles.length / COLS);
  await sharp({ create: { width: S * COLS, height: S * nRows, channels: 3, background: { r: 15, g: 15, b: 15 } } })
    .composite(tiles.map((b, i) => ({ input: b, left: (i % COLS) * S, top: Math.floor(i / COLS) * S })))
    .png().toFile(`${D}/gen-${cat}-${sh}.png`);
  console.log(`gen-${cat}-${sh}.png:  ${batch.map((r) => r.answer).join("  |  ")}`);
}
