// Audit every puzzle image for BLACK & WHITE / SEPIA / MONOCHROME content.
// Colour carries most of the signal in Picxle's early pixelated stages, so a
// greyscale or single-tint image is disproportionately hard / unfair.
//
// Measures on the real full-size image:
//   sat      mean chroma (max-min RGB), 0 = perfectly grey
//   %col     share of pixels with chroma > 30 (clearly coloured at all)
//   hue90    share of coloured pixels inside the dominant +/-30deg hue band
//   hues     how many distinct 30deg hue bands hold >=5% of the coloured pixels
// A photo can be saturated yet monochrome (all-sepia, all-blue) - the hue tests
// catch that; a warm-toned but genuinely colourful photo (a lion) will still show
// several populated hue bands, so it is NOT flagged.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const env = {};
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const puzzles = await fetch(`${SB}/rest/v1/puzzles?select=puzzle_date,answer,category,image_src&order=puzzle_date`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
}).then((r) => r.json());

const UA = "PicxleBot/1.0 (image colour audit; picxlebypenrose@gmail.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getImage(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/*" } });
    if (res.ok) {
      const ct = res.headers.get("content-type") || "";
      if (!ct.startsWith("image/")) throw new Error(`not an image: ${ct}`);
      return Buffer.from(await res.arrayBuffer());
    }
    if (res.status === 429 || res.status >= 500) { await sleep(1200 * attempt); continue; } // backoff
    throw new Error(`HTTP ${res.status}`);
  }
  throw new Error("rate-limited after 4 tries");
}

function hueOf(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return -1;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

async function analyse(p) {
  const buf = await getImage(p.image_src);
  const { data, info } = await sharp(buf).resize(200, 200, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let sum = 0, coloured = 0;
  const hist = new Array(36).fill(0); // 10deg buckets
  for (let i = 0; i < n; i++) {
    const r = data[i*3], g = data[i*3+1], b = data[i*3+2];
    const c = Math.max(r,g,b) - Math.min(r,g,b);
    sum += c;
    if (c > 30) { coloured++; const h = hueOf(r,g,b); if (h >= 0) hist[Math.floor(h/10) % 36]++; }
  }
  const sat = sum / n;
  const pctCol = (coloured / n) * 100;
  let best = 0;
  for (let s = 0; s < 36; s++) { let w = 0; for (let k = 0; k < 6; k++) w += hist[(s+k) % 36]; if (w > best) best = w; }
  const hue90 = coloured ? (best / coloured) * 100 : 100;
  // distinct 30deg bands holding >=5% of coloured pixels
  let hues = 0;
  for (let s = 0; s < 36; s += 3) {
    const w = hist[s] + hist[(s+1)%36] + hist[(s+2)%36];
    if (coloured && w / coloured >= 0.05) hues++;
  }
  return { ...p, sat, pctCol, hue90, hues };
}

console.log(`scanning ${puzzles.length} images (sequential, polite)...`);
const out = [];
for (const p of puzzles) {
  try { out.push(await analyse(p)); }
  catch (e) { out.push({ ...p, error: String(e.message).slice(0, 45) }); }
  if (out.length % 25 === 0) console.log(`  ...${out.length}/${puzzles.length}`);
  await sleep(120);
}

function classify(r) {
  if (r.error) return "ERROR";
  if (r.sat < 4 && r.pctCol < 1) return "BLACK & WHITE";
  if (r.sat < 15 && r.pctCol < 12) return "NEAR-GREY / SEPIA";
  // genuinely one tint: colour is all in one band AND no other hue family present
  if (r.hue90 > 95 && r.hues <= 1) return "MONOCHROME (1 tint)";
  return "colour";
}

const order = { "BLACK & WHITE": 0, "NEAR-GREY / SEPIA": 1, "MONOCHROME (1 tint)": 2, ERROR: 3 };
const flagged = out.filter((r) => classify(r) !== "colour").sort((a, b) => order[classify(a)] - order[classify(b)] || (a.sat ?? 999) - (b.sat ?? 999));

console.log(`\n${out.length} scanned | ${out.filter(r=>r.error).length} errors | ${flagged.filter(r=>!r.error).length} flagged\n`);
console.log("date         sat  %col  hue90 hues  verdict              answer");
for (const r of flagged) {
  if (r.error) { console.log(`${r.puzzle_date}  ERROR: ${r.error} — ${r.answer}`); continue; }
  console.log(`${r.puzzle_date} ${r.sat.toFixed(1).padStart(5)} ${r.pctCol.toFixed(0).padStart(4)}% ${r.hue90.toFixed(0).padStart(5)}% ${String(r.hues).padStart(4)}  ${classify(r).padEnd(19)}  ${r.answer} (${r.category})`);
}
fs.writeFileSync(path.join(process.cwd(), "..", "image-colour-audit.json"), JSON.stringify(out, null, 1));
console.log("\nfull data -> Picxle/image-colour-audit.json");
