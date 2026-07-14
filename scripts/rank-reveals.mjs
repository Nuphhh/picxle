// Rank every puzzle by how SATISFYING its reveal is, for the social clips.
//
// The format lives on the "oh!" — the picture must be genuinely unreadable at 8x8
// and instantly obvious sharp. A flat tomato becoming a tomato is a dud: the stage-1
// tile already tells you the answer, so nothing is revealed.
//
//   delta   how much the picture CHANGES from stage 1 to full (mean pixel distance)
//   detail  how much structure EMERGES (edge energy in the full image)
//   mystery how little the stage-1 tile gives away (block-to-block variation)
//
// Metrics cannot judge whether a subject is ICONIC, so the top of this list is a
// shortlist to eyeball, not an answer.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const env = {};
for (const l of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const rows = await fetch(`${env.SUPABASE_URL}/rest/v1/puzzles?select=puzzle_date,answer,category,image_src,license,attribution&order=puzzle_date`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
}).then((r) => r.json());
const teasers = JSON.parse(fs.readFileSync("app/api/og/teasers.json", "utf8"));

const UA = "PicxleBot/1.0 (reveal ranking; picxlebypenrose@gmail.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = 200; // compare at this size

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };

async function score(p) {
  const b64 = teasers[p.puzzle_date];
  if (!b64) throw new Error("no teaser");
  const raw = Buffer.from(b64, "base64"); // the REAL stage-1 pixels, from the game canvas

  const buf = Buffer.from(await fetch(p.image_src, { headers: { "User-Agent": UA } }).then((r) => r.arrayBuffer()));

  // both views at the same size: what the player sees first, and what they end with
  const stage1 = await sharp(raw, { raw: { width: 8, height: 8, channels: 3 } })
    .resize(N, N, { kernel: "nearest" }).removeAlpha().raw().toBuffer();
  const full = await sharp(buf, { limitInputPixels: false })
    .resize(N, N, { fit: "cover", position: "centre" }).removeAlpha().raw().toBuffer();

  // delta — how much the image changes across the reveal
  let d = 0;
  for (let i = 0; i < N * N * 3; i++) d += Math.abs(stage1[i] - full[i]);
  const delta = d / (N * N * 3);

  // detail — edge energy that emerges (Sobel on the sharp image)
  const grey = await sharp(buf, { limitInputPixels: false })
    .resize(N, N, { fit: "cover", position: "centre" }).greyscale().raw().toBuffer();
  let edges = 0;
  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      const gx = -grey[i - N - 1] - 2 * grey[i - 1] - grey[i + N - 1] + grey[i - N + 1] + 2 * grey[i + 1] + grey[i + N + 1];
      const gy = -grey[i - N - 1] - 2 * grey[i - N] - grey[i - N + 1] + grey[i + N - 1] + 2 * grey[i + N] + grey[i + N + 1];
      edges += Math.hypot(gx, gy);
    }
  }
  const detail = edges / ((N - 2) * (N - 2));

  // mystery — how little the 8x8 gives away. A tile with almost no block-to-block
  // variation says nothing; a tile that already shows the subject says too much.
  const lums = [];
  for (let i = 0; i < 64; i++) lums.push(0.2126 * raw[i*3] + 0.7152 * raw[i*3+1] + 0.0722 * raw[i*3+2]);
  const mystery = std(lums);

  return { ...p, delta, detail, mystery };
}

const out = [];
const queue = [...rows];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const p = queue.shift();
    try { out.push(await score(p)); } catch { /* skip */ }
    if (out.length % 40 === 0) console.log(`  ...${out.length}/${rows.length}`);
    await sleep(120);
  }
}));

// normalise each measure to 0..1 across the set, then weight
const norm = (vals) => { const lo = Math.min(...vals), hi = Math.max(...vals); return (v) => (v - lo) / (hi - lo || 1); };
const nD = norm(out.map((o) => o.delta));
const nE = norm(out.map((o) => o.detail));
const nM = norm(out.map((o) => o.mystery));

for (const o of out) {
  // delta carries it: the transformation IS the format. Detail is what emerges.
  // Mystery is a mild bonus and deliberately not dominant — an unreadable tile is
  // only good if something worth seeing arrives.
  o.score = 0.5 * nD(o.delta) + 0.35 * nE(o.detail) + 0.15 * nM(o.mystery);
}
out.sort((a, b) => b.score - a.score);

console.log(`\n${out.length} puzzles ranked by reveal quality\n`);
console.log("  # score  delta detail myst  licence  answer");
out.slice(0, 25).forEach((o, i) => {
  console.log(`${String(i + 1).padStart(3)} ${o.score.toFixed(3)}  ${o.delta.toFixed(0).padStart(3)}   ${o.detail.toFixed(0).padStart(3)}  ${o.mystery.toFixed(0).padStart(3)}  ${o.license.padEnd(6)} ${o.answer} (${o.category})`);
});
console.log("\n  ...weakest (do NOT clip these):");
out.slice(-6).forEach((o) => console.log(`    ${o.score.toFixed(3)}  ${o.answer} (${o.category})`));

fs.writeFileSync(path.join(process.cwd(), "..", "reveal-ranking.json"), JSON.stringify(out, null, 1));
console.log("\n-> Picxle/reveal-ranking.json");
