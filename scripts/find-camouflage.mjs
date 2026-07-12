// Find puzzles where the SUBJECT BLENDS INTO THE BACKGROUND — i.e. the stage-1
// 8x8 is a flat, single-hue field with nothing to latch onto (the pumpkin-on-an-
// orange-jumper problem). Measured on the real stored teasers, because that is
// exactly what the player sees on guess one.
//
//   hue90    % of coloured blocks sharing ONE hue band  (high = all one colour)
//   lumStd   std-dev of block brightness               (low  = no shape/contrast)
//   chromaStd std-dev of block saturation              (low  = uniformly colourful)
// A tile that is high hue90 AND low lumStd gives the player nothing.
import fs from "node:fs";
import path from "node:path";

const env = {};
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const puzzles = await fetch(`${SB}/rest/v1/puzzles?select=puzzle_date,answer,category&order=puzzle_date`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
}).then((r) => r.json());
const teasers = JSON.parse(fs.readFileSync("app/api/og/teasers.json", "utf8"));

const hueOf = (r, g, b) => {
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  if (d === 0) return -1;
  let h = max === r ? ((g-b)/d) % 6 : max === g ? (b-r)/d + 2 : (r-g)/d + 4;
  h *= 60; return h < 0 ? h + 360 : h;
};
const std = (a) => { const m = a.reduce((x,y)=>x+y,0)/a.length; return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length); };

const out = [];
for (const p of puzzles) {
  const b64 = teasers[p.puzzle_date];
  if (!b64) continue;
  const raw = Buffer.from(b64, "base64");
  const lums = [], chromas = [], hist = new Array(36).fill(0);
  let coloured = 0;
  for (let i = 0; i < 64; i++) {
    const r = raw[i*3], g = raw[i*3+1], b = raw[i*3+2];
    lums.push(0.2126*r + 0.7152*g + 0.0722*b);
    const c = Math.max(r,g,b) - Math.min(r,g,b);
    chromas.push(c);
    if (c > 25) { coloured++; const h = hueOf(r,g,b); if (h >= 0) hist[Math.floor(h/10)%36]++; }
  }
  let best = 0;
  for (let s = 0; s < 36; s++) { let w = 0; for (let k = 0; k < 6; k++) w += hist[(s+k)%36]; if (w > best) best = w; }
  const hue90 = coloured ? (best/coloured)*100 : 0;
  out.push({ ...p, hue90, pctCol: (coloured/64)*100, lumStd: std(lums), chromaStd: std(chromas) });
}

// camouflaged = nearly all blocks one hue, and little brightness variation to read a shape
const flag = (r) => r.pctCol > 55 && r.hue90 > 88 && r.lumStd < 34;
const risky = (r) => !flag(r) && r.pctCol > 50 && r.hue90 > 92 && r.lumStd < 45;

const bad = out.filter(flag).sort((a,b) => a.lumStd - b.lumStd);
const warn = out.filter(risky).sort((a,b) => a.lumStd - b.lumStd);

console.log(`${out.length} teasers analysed\n`);
console.log(`=== CAMOUFLAGED: one flat hue, no shape at 8x8 (${bad.length}) ===`);
console.log("date        hue90 %col  lumStd  answer");
for (const r of bad) console.log(`${r.puzzle_date} ${r.hue90.toFixed(0).padStart(5)}% ${r.pctCol.toFixed(0).padStart(4)}% ${r.lumStd.toFixed(1).padStart(6)}  ${r.answer} (${r.category})`);
console.log(`\n=== BORDERLINE (${warn.length}) ===`);
for (const r of warn) console.log(`${r.puzzle_date} ${r.hue90.toFixed(0).padStart(5)}% ${r.pctCol.toFixed(0).padStart(4)}% ${r.lumStd.toFixed(1).padStart(6)}  ${r.answer} (${r.category})`);
fs.writeFileSync(path.join(process.cwd(), "..", "camouflage-audit.json"), JSON.stringify(out.sort((a,b)=>a.lumStd-b.lumStd), null, 1));
