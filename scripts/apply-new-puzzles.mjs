// Insert the sourced puzzles into Supabase, on consecutive dates continuing
// from the last existing puzzle. Idempotent: skips any date already present.
// Run with --dry to preview.
import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const env = {};
for (const l of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const news = JSON.parse(fs.readFileSync(path.join(process.cwd(), "..", "new-puzzles.json"), "utf8"));
const existing = await fetch(`${SB}/rest/v1/puzzles?select=puzzle_date,puzzle_number,answer&order=puzzle_date`, { headers: H }).then((r) => r.json());
const lastDate = existing[existing.length - 1].puzzle_date;
const maxNum = Math.max(...existing.map((e) => e.puzzle_number || 0));
const used = new Set(existing.map((e) => e.answer));

const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// The subject list is grouped by category, so straight insertion would give
// players twelve animals in a row. Interleave instead: always take from the
// category with the most remaining, never the same category two days running.
function interleave(items) {
  const groups = new Map();
  for (const p of items) {
    if (!groups.has(p.category)) groups.set(p.category, []);
    groups.get(p.category).push(p);
  }
  const out = [];
  let prev = null;
  while (out.length < items.length) {
    const avail = [...groups.entries()].filter(([c, list]) => list.length && c !== prev);
    // if the only category left is the previous one, we have to repeat it
    const pool = avail.length ? avail : [...groups.entries()].filter(([, l]) => l.length);
    pool.sort((a, b) => b[1].length - a[1].length); // drain the biggest first
    const [cat, list] = pool[0];
    out.push(list.shift());
    prev = cat;
  }
  return out;
}

const fresh = news.filter((p) => {
  if (used.has(p.answer)) { console.log(`skip (answer exists): ${p.answer}`); return false; }
  return true;
});

const rows = interleave(fresh).map((p, idx) => ({
  puzzle_date: addDays(lastDate, idx + 1),
  puzzle_number: maxNum + idx + 1,
  image_src: p.image_src,
  answer: p.answer,
  accepts: p.accepts,
  category: p.category,
  license: p.license,
  attribution: p.attribution,
}));

console.log(`\n${rows.length} puzzles -> ${rows[0]?.puzzle_date} .. ${rows[rows.length-1]?.puzzle_date}`);
for (const r of rows) console.log(`  ${r.puzzle_date}  #${r.puzzle_number}  ${r.answer.padEnd(20)} ${r.category.padEnd(15)} ${r.license}`);
if (DRY) { console.log("\n(dry run — nothing written)"); process.exit(0); }

const res = await fetch(`${SB}/rest/v1/puzzles`, {
  method: "POST",
  headers: { ...H, Prefer: "return=representation" },
  body: JSON.stringify(rows),
});
const out = await res.json();
console.log(res.ok ? `\ninserted ${out.length} puzzles` : `\nFAILED: ${JSON.stringify(out).slice(0, 300)}`);
