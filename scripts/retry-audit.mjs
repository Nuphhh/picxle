// Re-measure only the images that errored in find-greyscale.mjs (rate limits /
// pixel-limit), then merge into image-colour-audit.json and reprint the flags.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const AUDIT = path.join(process.cwd(), "..", "image-colour-audit.json");
const all = JSON.parse(fs.readFileSync(AUDIT, "utf8"));
const failed = all.filter((r) => r.error);
console.log(`retrying ${failed.length} failed images (slow)...`);

const UA = "PicxleBot/1.0 (image colour audit; picxlebypenrose@gmail.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getImage(url) {
  for (let a = 1; a <= 6; a++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/*" } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429 || res.status >= 500) { await sleep(3000 * a); continue; }
    throw new Error(`HTTP ${res.status}`);
  }
  throw new Error("still rate-limited");
}
function hueOf(r, g, b) {
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  if (d === 0) return -1;
  let h = max === r ? ((g-b)/d) % 6 : max === g ? (b-r)/d + 2 : (r-g)/d + 4;
  h *= 60; return h < 0 ? h + 360 : h;
}
async function analyse(p) {
  const buf = await getImage(p.image_src);
  const { data, info } = await sharp(buf, { limitInputPixels: false })
    .resize(200, 200, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let sum = 0, coloured = 0;
  const hist = new Array(36).fill(0);
  for (let i = 0; i < n; i++) {
    const r = data[i*3], g = data[i*3+1], b = data[i*3+2];
    const c = Math.max(r,g,b) - Math.min(r,g,b);
    sum += c;
    if (c > 30) { coloured++; const h = hueOf(r,g,b); if (h >= 0) hist[Math.floor(h/10)%36]++; }
  }
  const sat = sum / n, pctCol = (coloured / n) * 100;
  let best = 0;
  for (let s = 0; s < 36; s++) { let w = 0; for (let k = 0; k < 6; k++) w += hist[(s+k)%36]; if (w > best) best = w; }
  const hue90 = coloured ? (best / coloured) * 100 : 100;
  let hues = 0;
  for (let s = 0; s < 36; s += 3) {
    const w = hist[s] + hist[(s+1)%36] + hist[(s+2)%36];
    if (coloured && w / coloured >= 0.05) hues++;
  }
  return { puzzle_date: p.puzzle_date, answer: p.answer, category: p.category, image_src: p.image_src, sat, pctCol, hue90, hues };
}

for (const p of failed) {
  try {
    const r = await analyse(p);
    const i = all.findIndex((x) => x.puzzle_date === p.puzzle_date);
    all[i] = r;
    console.log(`  ok ${p.puzzle_date} ${p.answer}`);
  } catch (e) {
    console.log(`  STILL FAILING ${p.puzzle_date} ${p.answer}: ${e.message}`);
  }
  await sleep(1500);
}
fs.writeFileSync(AUDIT, JSON.stringify(all, null, 1));

function classify(r) {
  if (r.error) return "ERROR";
  if (r.sat < 4 && r.pctCol < 1) return "BLACK & WHITE";
  if (r.sat < 15 && r.pctCol < 12) return "NEAR-GREY / SEPIA";
  if (r.hue90 > 95 && r.hues <= 1) return "MONOCHROME (1 tint)";
  return "colour";
}
const order = { "BLACK & WHITE": 0, "NEAR-GREY / SEPIA": 1, "MONOCHROME (1 tint)": 2, ERROR: 3 };
const flagged = all.filter((r) => classify(r) !== "colour").sort((a,b) => order[classify(a)] - order[classify(b)] || (a.sat ?? 999) - (b.sat ?? 999));
console.log(`\n=== FINAL: ${all.length} scanned, ${all.filter(r=>r.error).length} unreadable, ${flagged.filter(r=>!r.error).length} flagged ===\n`);
console.log("date         sat  %col  hue90 hues  verdict              answer");
for (const r of flagged) {
  if (r.error) { console.log(`${r.puzzle_date}  ERROR: ${r.error} — ${r.answer}`); continue; }
  console.log(`${r.puzzle_date} ${r.sat.toFixed(1).padStart(5)} ${r.pctCol.toFixed(0).padStart(4)}% ${r.hue90.toFixed(0).padStart(5)}% ${String(r.hues).padStart(4)}  ${classify(r).padEnd(19)}  ${r.answer} (${r.category})`);
}
