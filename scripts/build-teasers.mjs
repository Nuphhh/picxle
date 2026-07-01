// Precompute each puzzle's TRUE first-stage 8x8 by running the game's exact
// canvas pipeline in a headless browser (the only way to reproduce Chrome's
// downscaler). Writes app/api/og/teasers.json  { "YYYY-MM-DD": base64(192 RGB bytes) }.
//
// Usage: node scripts/build-teasers.mjs            (all puzzles, skips existing)
//        node scripts/build-teasers.mjs --force    (recompute all)
//        node scripts/build-teasers.mjs 2026-07-01 (one date)
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "app", "api", "og", "teasers.json");
const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

// --- read env from .env.local ---
const env = {};
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// --- fetch puzzle list ---
let puzzles = await fetch(`${SB}/rest/v1/puzzles?select=puzzle_date,category,image_src&order=puzzle_date`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
}).then((r) => r.json());
if (ONLY) puzzles = puzzles.filter((p) => p.puzzle_date === ONLY);

const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const todo = puzzles.filter((p) => FORCE || ONLY || !existing[p.puzzle_date]);
console.log(`${puzzles.length} puzzles, ${todo.length} to compute`);
if (!todo.length) process.exit(0);

// --- CDP ---
const targets = await fetch("http://127.0.0.1:9223/json").then((r) => r.json());
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let _id = 0; const pending = new Map();
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id).resolve(msg.result); pending.delete(msg.id); } };
const send = (method, params = {}) => { const id = ++_id; return new Promise((res) => { pending.set(id, { resolve: res }); ws.send(JSON.stringify({ id, method, params })); }); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = async (e) => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval error"); return r.result?.value; };
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "https://picxle.vercel.app/play" });
await sleep(3500);

// Runs the game's EXACT stage-1 pipeline for one image; returns 64 RGB ints (flattened over cream).
function pipelineExpr(src, isFlag) {
  return `(async () => {
    const CREAM = [237,232,222]; // --ink2 #ede8de, the puzzle card bg
    const RES = 8;
    const img = new Image(); img.crossOrigin = "anonymous";
    await new Promise((ok, err) => { img.onload = ok; img.onerror = () => err(new Error("img load")); img.src = ${JSON.stringify(src)}; });
    const s = document.createElement("canvas"); s.width = 440; s.height = 440;
    const ctx = s.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ${isFlag ? `
      const scale = Math.min(440 / img.naturalWidth, 440 / img.naturalHeight);
      const dw = Math.round(img.naturalWidth * scale), dh = Math.round(img.naturalHeight * scale);
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, Math.round((440-dw)/2), Math.round((440-dh)/2), dw, dh);
    ` : `
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, (img.naturalWidth-side)/2, (img.naturalHeight-side)/2, side, side, 0, 0, 440, 440);
    `}
    const t = document.createElement("canvas"); t.width = RES; t.height = RES;
    const tc = t.getContext("2d"); tc.imageSmoothingEnabled = true;
    tc.drawImage(s, 0, 0, RES, RES);
    const d = tc.getImageData(0, 0, RES, RES).data;
    const out = [];
    for (let i = 0; i < RES*RES; i++) {
      const a = d[i*4+3] / 255;
      for (let c = 0; c < 3; c++) out.push(Math.round(d[i*4+c]*a + CREAM[c]*(1-a)));
    }
    return out;
  })()`;
}

const result = { ...existing };
let done = 0, failed = 0;
for (const p of todo) {
  const isFlag = p.category === "Flag";
  try {
    const rgb = await evalJs(pipelineExpr(p.image_src, isFlag));
    if (!rgb || rgb.length !== 192) throw new Error("bad length " + (rgb && rgb.length));
    result[p.puzzle_date] = Buffer.from(rgb).toString("base64");
    done++;
  } catch (e) {
    failed++;
    console.log(`  FAIL ${p.puzzle_date} ${p.category}: ${String(e.message).slice(0, 80)}`);
  }
  if ((done + failed) % 20 === 0) console.log(`  ...${done + failed}/${todo.length}`);
}
// keep sorted by date
const sorted = {};
for (const k of Object.keys(result).sort()) sorted[k] = result[k];
fs.writeFileSync(OUT, JSON.stringify(sorted));
console.log(`done=${done} failed=${failed} total_stored=${Object.keys(sorted).length}`);
console.log(`wrote ${OUT}`);
ws.close(); process.exit(0);
