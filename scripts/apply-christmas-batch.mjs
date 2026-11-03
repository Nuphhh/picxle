// Christmas 2026 batch: 79 AI-generated puzzles from Images/GPT Gens, with a
// "12 Days of Christmas" countdown on 14–25 Dec (Christmas Tree on the 25th).
//
// The table was already full to 2027-02-02, so this REBUILDS the schedule from
// 2026-12-01 onward instead of appending:
//   - pinned puzzles (the countdown, a few festive warm-ups, Fireworks on New
//     Year's Day) take their exact dates;
//   - every existing puzzle from 1 Dec on keeps its relative order and slides
//     later to make room;
//   - the new non-festive puzzles follow, interleaved by category.
// Only future, unplayed dates move, so no completion or share result changes.
//
// Usage (from picxle-app/):
//   node scripts/apply-christmas-batch.mjs            dry run: writes the JPGs, prints the plan
//   node scripts/apply-christmas-batch.mjs --commit   also writes Supabase + data/puzzles.js
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { normaliseGuess } from "../lib/normalise.js";

const COMMIT = process.argv.includes("--commit");
const FROM = "2026-12-01";
const SRC_DIR = path.join(process.cwd(), "..", "Images", "GPT Gens");
const PUB = path.join(process.cwd(), "public", "puzzles");
const batch = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "christmas-batch.json"), "utf8"));

const env = {};
for (const l of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ── 1. Images: PNG -> 1200² JPG in public/puzzles (same settings as regen.mjs) ──
// Vercel serves these at picxle.vercel.app/puzzles/<slug>.jpg once pushed.
const news = batch.puzzles.map((p) => {
  const slug = p.slug || path.basename(p.file, ".png");
  return {
    ...p, slug,
    accepts: [...new Set([p.answer, ...p.accepts].map(normaliseGuess))],
    image_src: `https://picxle.vercel.app/puzzles/${slug}.jpg`,
    license: "CC0",
    attribution: "Picxle original (AI-generated)",
  };
});
for (const p of news) {
  const dest = path.join(PUB, `${p.slug}.jpg`);
  if (fs.existsSync(dest)) continue;
  await sharp(path.join(SRC_DIR, p.file)).resize(1200, 1200, { fit: "cover" }).jpeg({ quality: 88 }).toFile(dest);
}
console.log(`images: ${news.length} JPGs present in public/puzzles`);

// ── 2. Sanity checks against what's already live ──
const existing = await fetch(`${SB}/rest/v1/puzzles?select=id,puzzle_date,puzzle_number,answer,accepts,category&order=puzzle_date`, { headers: H }).then((r) => r.json());
const liveAnswers = new Set(existing.map((e) => e.answer));
const dupes = news.filter((p) => liveAnswers.has(p.answer));
if (dupes.length) { console.error(`already live: ${dupes.map((d) => d.answer).join(", ")}`); process.exit(1); }
// An alias that is another puzzle's answer or alias makes one guess right for two puzzles.
const owner = new Map();
for (const e of existing) for (const a of e.accepts) owner.set(normaliseGuess(a), e.answer);
for (const p of news) for (const a of p.accepts) {
  if (owner.has(a) && owner.get(a) !== p.answer) console.log(`  note: "${a}" (${p.answer}) is also accepted by ${owner.get(a)}`);
  owner.set(a, p.answer);
}

// ── 3. Build the schedule from FROM onward ──
const before = existing.filter((e) => e.puzzle_date < FROM);
const moving = existing.filter((e) => e.puzzle_date >= FROM); // already in a good interleaved order
const pins = new Map(news.filter((p) => p.pin).map((p) => [p.pin, p]));

// New non-festive puzzles arrive grouped by category; spread them out by always
// taking from the biggest remaining category that isn't yesterday's.
function interleave(items) {
  const groups = new Map();
  for (const p of items) { if (!groups.has(p.category)) groups.set(p.category, []); groups.get(p.category).push(p); }
  const out = []; let prev = null;
  while (out.length < items.length) {
    const avail = [...groups].filter(([c, l]) => l.length && c !== prev);
    const pool = avail.length ? avail : [...groups].filter(([, l]) => l.length);
    pool.sort((a, b) => b[1].length - a[1].length);
    out.push(pool[0][1].shift()); prev = pool[0][0];
  }
  return out;
}
const flow = [...moving, ...interleave(news.filter((p) => !p.pin))];

// Walk the dates. A pinned date takes its pin; any other date takes the next
// item in the flow, looking a few items ahead if that one would repeat the
// category of the day before or of a pinned day after.
const total = moving.length + news.length;
const plan = [];
let prevCat = before.at(-1).category;
for (let i = 0; i < total; i++) {
  const date = addDays(FROM, i);
  let item = pins.get(date);
  if (!item) {
    const nextCat = pins.get(addDays(date, 1))?.category;
    const k = flow.slice(0, 4).findIndex((f) => f.category !== prevCat && f.category !== nextCat);
    item = flow.splice(Math.max(k, 0), 1)[0];
  }
  plan.push({ date, number: before.at(-1).puzzle_number + i + 1, item });
  prevCat = item.category;
}
if (flow.length || plan.some((p) => !p.item)) { console.error("schedule did not consume every puzzle"); process.exit(1); }

for (const p of plan) {
  const tag = p.item.id ? (p.item.puzzle_date === p.date ? "" : `moved from ${p.item.puzzle_date}`) : p.item.twelveDays ? `NEW · Day ${p.item.twelveDays} of 12` : "NEW";
  if (p.date < "2027-01-10" || !p.item.id) console.log(`  ${p.date} #${p.number}  ${p.item.answer.padEnd(20)} ${p.item.category.padEnd(15)} ${tag}`);
}
const repeats = plan.filter((p, i) => i && plan[i - 1].item.category === p.item.category);
console.log(`\n${plan.length} dates ${plan[0].date} .. ${plan.at(-1).date}; back-to-back same category: ${repeats.length}`);
for (const r of repeats) console.log(`  ${r.date} ${r.item.category} (${r.item.answer})`);

// ── 4. Dictionary: every accept must be typeable, plus decoys so the
//       autocomplete doesn't hand over the answer ──
const DICT_FILE = path.join(process.cwd(), "data", "puzzles.js");
const { DICTIONARY } = await import("../data/puzzles.js");
const have = new Set(DICTIONARY);
const addWords = [...new Set([...news.flatMap((p) => p.accepts), ...batch.decoys.map(normaliseGuess)])].filter((w) => !have.has(w));
console.log(`\ndictionary: +${addWords.length} words`);

if (!COMMIT) { console.log("\n(dry run — database and dictionary untouched; re-run with --commit)"); process.exit(0); }

// ── 5. Write. puzzle_date and puzzle_number are both UNIQUE, so moved rows
//       first park on a far-future date (+1000 years) and number (+100000),
//       then the new rows go in, then the parked rows land on their final
//       values. Each step is safe to re-run.
async function req(url, opts) {
  const r = await fetch(url, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}
const park = (iso) => `${Number(iso.slice(0, 4)) + 1000}${iso.slice(4)}`;
for (const e of moving) {
  await req(`${SB}/rest/v1/puzzles?id=eq.${e.id}`, { method: "PATCH", body: JSON.stringify({ puzzle_date: park(e.puzzle_date), puzzle_number: (e.puzzle_number % 100000) + 100000 }) });
}
console.log(`parked ${moving.length} rows`);
const inserts = plan.filter((p) => !p.item.id).map((p) => ({
  puzzle_date: p.date, puzzle_number: p.number, image_src: p.item.image_src, answer: p.item.answer,
  accepts: p.item.accepts, category: p.item.category, license: p.item.license, attribution: p.item.attribution,
}));
await req(`${SB}/rest/v1/puzzles`, { method: "POST", body: JSON.stringify(inserts) });
console.log(`inserted ${inserts.length} rows`);
for (const p of plan.filter((p) => p.item.id)) {
  await req(`${SB}/rest/v1/puzzles?id=eq.${p.item.id}`, { method: "PATCH", body: JSON.stringify({ puzzle_date: p.date, puzzle_number: p.number }) });
}
console.log(`moved ${moving.length} rows to their new dates`);

const src = fs.readFileSync(DICT_FILE, "utf8");
const marker = "\n];\n\n// Dedupe, then sort.";
if (!src.includes(marker)) throw new Error("could not find RAW_DICTIONARY terminator");
const block = ["", "  // ── Christmas 2026 batch (scripts/apply-christmas-batch.mjs): answers, aliases, decoys ──",
  ...addWords.map((w) => `  ${JSON.stringify(w)},`)].join("\n");
fs.writeFileSync(DICT_FILE, src.replace(marker, `${block}${marker}`));
console.log(`dictionary: wrote ${addWords.length} words to data/puzzles.js`);
