// Fill in the puzzles the ranking dropped (image fetches that failed on rate
// limits), and re-rank EXCLUDING FLAGS.
//
// Flags dominated the first ranking because the score rewards pixel distance: a
// blurred colour field versus a crisp flag is a big numeric change. But it is a
// dull reveal — the colours give it away at stage 1. Pixel distance is not surprise.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { execSync } from "node:child_process";

const env = {};
for (const l of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const rows = await fetch(`${env.SUPABASE_URL}/rest/v1/puzzles?select=puzzle_date,answer,category,image_src,license,attribution&order=puzzle_date`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
}).then((r) => r.json());
const teasers = JSON.parse(fs.readFileSync("app/api/og/teasers.json", "utf8"));
const RANK = path.join(process.cwd(), "..", "reveal-ranking.json");
const done = new Map((JSON.parse(fs.readFileSync(RANK, "utf8")) || []).map((o) => [o.puzzle_date, o]));

const TMP = path.join(process.cwd(), "..", "_rankimg.bin");
const UA = "PicxleBot/1.0 (reveal ranking; picxlebypenrose@gmail.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = 200;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };

// curl, with retries — node fetch gets 429'd and (for Flickr) 502'd
function grab(url) {
  for (let a = 1; a <= 4; a++) {
    try {
      execSync(`curl -sL --max-time 60 -A ${JSON.stringify(UA)} -o ${JSON.stringify(TMP)} ${JSON.stringify(url)}`, { timeout: 70000 });
      const b = fs.readFileSync(TMP);
      if (b.length > 2000) return b;
    } catch { /* retry */ }
    execSync(`sleep ${a}`, { shell: "/bin/bash" });
  }
  throw new Error("fetch failed");
}

async function score(p) {
  const raw = Buffer.from(teasers[p.puzzle_date], "base64");
  const buf = grab(p.image_src);
  const stage1 = await sharp(raw, { raw: { width: 8, height: 8, channels: 3 } })
    .resize(N, N, { kernel: "nearest" }).removeAlpha().raw().toBuffer();
  const full = await sharp(buf, { limitInputPixels: false })
    .resize(N, N, { fit: "cover", position: "centre" }).removeAlpha().raw().toBuffer();
  let d = 0;
  for (let i = 0; i < N * N * 3; i++) d += Math.abs(stage1[i] - full[i]);
  const delta = d / (N * N * 3);
  const grey = await sharp(buf, { limitInputPixels: false })
    .resize(N, N, { fit: "cover", position: "centre" }).greyscale().raw().toBuffer();
  let edges = 0;
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = y * N + x;
    const gx = -grey[i-N-1] - 2*grey[i-1] - grey[i+N-1] + grey[i-N+1] + 2*grey[i+1] + grey[i+N+1];
    const gy = -grey[i-N-1] - 2*grey[i-N] - grey[i-N+1] + grey[i+N-1] + 2*grey[i+N] + grey[i+N+1];
    edges += Math.hypot(gx, gy);
  }
  const detail = edges / ((N - 2) * (N - 2));
  const lums = [];
  for (let i = 0; i < 64; i++) lums.push(0.2126*raw[i*3] + 0.7152*raw[i*3+1] + 0.0722*raw[i*3+2]);
  return { ...p, delta, detail, mystery: std(lums) };
}

const missing = rows.filter((r) => teasers[r.puzzle_date] && !done.has(r.puzzle_date));
console.log(`${done.size} already scored, ${missing.length} to fill in`);
let n = 0;
for (const p of missing) {
  try { done.set(p.puzzle_date, await score(p)); } catch { console.log(`  skip ${p.answer}`); }
  if (++n % 25 === 0) console.log(`  ...${n}/${missing.length}`);
  await sleep(150);
}
try { fs.unlinkSync(TMP); } catch {}

const all = [...done.values()];
const norm = (vals) => { const lo = Math.min(...vals), hi = Math.max(...vals); return (v) => (v - lo) / (hi - lo || 1); };
const nD = norm(all.map((o) => o.delta)), nE = norm(all.map((o) => o.detail)), nM = norm(all.map((o) => o.mystery));
for (const o of all) o.score = 0.5 * nD(o.delta) + 0.35 * nE(o.detail) + 0.15 * nM(o.mystery);

// Flags are excluded from the SHORTLIST, not the data: they game the metric.
const shortlist = all.filter((o) => o.category !== "Flag").sort((a, b) => b.score - a.score);
fs.writeFileSync(RANK, JSON.stringify(all.sort((a, b) => b.score - a.score), null, 1));

console.log(`\n${all.length}/${rows.length} puzzles scored. Top reveals (flags excluded):\n`);
console.log("  # score  delta detail myst  licence  answer");
shortlist.slice(0, 18).forEach((o, i) =>
  console.log(`${String(i+1).padStart(3)} ${o.score.toFixed(3)}  ${o.delta.toFixed(0).padStart(3)}   ${o.detail.toFixed(0).padStart(3)}  ${o.mystery.toFixed(0).padStart(3)}  ${o.license.padEnd(6)} ${o.answer} (${o.category})`));
fs.writeFileSync(path.join(process.cwd(), "..", "reveal-shortlist.json"), JSON.stringify(shortlist.slice(0, 18), null, 1));
