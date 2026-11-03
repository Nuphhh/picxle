// Re-plan every puzzle from a start date onward so the Christmas 2026 batch's
// non-festive puzzles are spread through the existing unplayed ones instead of
// all sitting at the end of the runway.
//
// - Festive pins from Images/GPT Gens/christmas-batch.json keep their dates
//   (the 12 Days countdown, warm-ups, Fireworks, Snowman).
// - Everything else from START on is merged: existing puzzles keep their
//   relative order, the new ones are dropped in at even intervals, and a short
//   lookahead stops the same category landing on two days in a row.
// - No rows are added or removed; dates and numbers are rewritten.
//
// START defaults to 2026-11-10: puzzles up to 11-09 already have reveal clips
// booked in Buffer, and moving them would make those posts reveal the wrong answer.
//
// Usage (from picxle-app/):
//   node scripts/reshuffle-unplayed.mjs [YYYY-MM-DD]            dry run
//   node scripts/reshuffle-unplayed.mjs [YYYY-MM-DD] --commit   write
import fs from "node:fs";
import path from "node:path";

const COMMIT = process.argv.includes("--commit");
const START = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || "2026-11-10";
const today = new Date().toISOString().slice(0, 10);
if (START <= today) { console.error(`start ${START} must be after today (${today}) — never move a puzzle that's been played`); process.exit(1); }

const env = {};
for (const l of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const batch = JSON.parse(fs.readFileSync(path.join(process.cwd(), "..", "Images", "GPT Gens", "christmas-batch.json"), "utf8"));
const pinByAnswer = new Map(batch.puzzles.filter((p) => p.pin).map((p) => [p.answer, p.pin]));
const newAnswers = new Set(batch.puzzles.map((p) => p.answer));

const rows = await fetch(`${SB}/rest/v1/puzzles?select=id,puzzle_date,puzzle_number,answer,category&order=puzzle_date`, { headers: H }).then((r) => r.json());
const before = rows.filter((r) => r.puzzle_date < START);
const window = rows.filter((r) => r.puzzle_date >= START);
const pins = new Map(window.filter((r) => pinByAnswer.has(r.answer)).map((r) => [pinByAnswer.get(r.answer), r]));
const old = window.filter((r) => !pinByAnswer.has(r.answer) && !newAnswers.has(r.answer));
const fresh = window.filter((r) => !pinByAnswer.has(r.answer) && newAnswers.has(r.answer));

// Even merge: walk the combined length and take a new puzzle whenever it has
// fallen behind its fair share. 60 new among 164 old ≈ one new every 3–4 days.
const flow = [];
for (let o = 0, n = 0; o + n < old.length + fresh.length;) {
  const takeNew = n < fresh.length && (o >= old.length || (n + 1) / fresh.length <= (o + 1) / old.length);
  flow.push(takeNew ? fresh[n++] : old[o++]);
}

const plan = [];
let prevCat = before.at(-1).category;
for (let i = 0; i < window.length; i++) {
  const date = addDays(START, i);
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
  const tag = pinByAnswer.has(p.item.answer) ? "festive (pinned)" : newAnswers.has(p.item.answer) ? "NEW" : "";
  console.log(`  ${p.date} #${p.number}  ${p.item.answer.padEnd(22)} ${p.item.category.padEnd(15)} ${tag}`);
}
const repeats = plan.filter((p, i) => i && plan[i - 1].item.category === p.item.category);
const moved = plan.filter((p) => p.item.puzzle_date !== p.date || p.item.puzzle_number !== p.number);
console.log(`\n${plan.length} dates ${START} .. ${plan.at(-1).date}; ${moved.length} rows change; back-to-back same category: ${repeats.length}`);
for (const r of repeats) console.log(`  ${r.date} ${r.item.category} (${r.item.answer})`);

if (!COMMIT) { console.log("\n(dry run — nothing written; re-run with --commit)"); process.exit(0); }

// puzzle_date and puzzle_number are both UNIQUE: park first, then land.
async function patch(id, body) {
  const r = await fetch(`${SB}/rest/v1/puzzles?id=eq.${id}`, { method: "PATCH", headers: H, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}
const park = (iso) => `${Number(iso.slice(0, 4)) + 1000}${iso.slice(4)}`;
for (const p of moved) await patch(p.item.id, { puzzle_date: park(p.item.puzzle_date), puzzle_number: (p.item.puzzle_number % 100000) + 100000 });
console.log(`parked ${moved.length}`);
for (const p of moved) await patch(p.item.id, { puzzle_date: p.date, puzzle_number: p.number });
console.log(`moved ${moved.length}`);

// Share teasers are keyed by date, so every moved date's teaser now shows the
// wrong puzzle. Drop them; build-teasers.mjs refills the gaps after a deploy.
const TEASERS = path.join(process.cwd(), "app", "api", "og", "teasers.json");
const t = JSON.parse(fs.readFileSync(TEASERS, "utf8"));
let dropped = 0;
for (const p of moved) if (t[p.date]) { delete t[p.date]; dropped++; }
fs.writeFileSync(TEASERS, JSON.stringify(t));
console.log(`dropped ${dropped} stale teasers`);
