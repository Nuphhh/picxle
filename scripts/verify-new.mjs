// Build contact sheets of every sourced image so they can be eyeballed.
// The colour/stage-one tests cannot tell whether the picture shows the RIGHT
// SUBJECT (Commons search once offered a wooden chair for "canoe"), so this is
// the step that catches a wrong image before it ships.
// Usage: node scripts/verify-new.mjs [sheetIndex]
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const D = "C:/Users/Nath/AppData/Local/Temp/claude/C--Users-Nath/d16d015c-ca8e-4839-a477-0a5c16d09a93/scratchpad";
const rows = JSON.parse(fs.readFileSync(path.join(process.cwd(), "..", "new-puzzles.json"), "utf8"));
const UA = "PicxleBot/1.0 (verification; picxlebypenrose@gmail.com)";
const PER = 12, COLS = 4, S = 260;

const sheets = Math.ceil(rows.length / PER);
const only = process.argv[2] ? parseInt(process.argv[2], 10) : null;

for (let sh = 0; sh < sheets; sh++) {
  if (only !== null && sh !== only) continue;
  const batch = rows.slice(sh * PER, (sh + 1) * PER);
  const tiles = [];
  for (const r of batch) {
    try {
      // Generated images aren't deployed yet, so their picxle.vercel.app URL 404s —
      // read those straight off disk.
      const local = path.join(process.cwd(), "public", "puzzles", path.basename(new URL(r.image_src).pathname));
      const buf = r.source === "generated" && fs.existsSync(local)
        ? fs.readFileSync(local)
        : Buffer.from(await fetch(r.image_src, { headers: { "User-Agent": UA } }).then((x) => x.arrayBuffer()));
      tiles.push(await sharp(buf, { limitInputPixels: false }).resize(S, S, { fit: "cover" }).toBuffer());
    } catch {
      tiles.push(await sharp({ create: { width: S, height: S, channels: 3, background: { r: 90, g: 20, b: 20 } } }).png().toBuffer());
    }
  }
  const r0 = Math.ceil(tiles.length / COLS);
  await sharp({ create: { width: S * COLS, height: S * r0, channels: 3, background: { r: 15, g: 15, b: 15 } } })
    .composite(tiles.map((b, i) => ({ input: b, left: (i % COLS) * S, top: Math.floor(i / COLS) * S })))
    .png().toFile(`${D}/verify-${sh}.png`);
  console.log(`\n--- sheet ${sh} (${D}/verify-${sh}.png) ---`);
  batch.forEach((r, i) => console.log(`  ${i + 1}. ${r.answer}  [${r.source}/${r.license}]`));
}
