// Enforce the invariant: EVERY accepted answer must be typeable.
//
// The client blocks any guess that isn't in DICTIONARY, before it ever reaches
// the server. So an alias sitting in a puzzle's accepts[] but missing from the
// dictionary is a right answer the game refuses to let you enter — which is what
// happened to "aubergine": the database accepted it, the guess box would not.
//
// This adds every missing alias (normalised) to RAW_DICTIONARY. The export
// de-duplicates and sorts, so re-running is safe.
import fs from "node:fs";
import path from "node:path";
import { normaliseGuess } from "../lib/normalise.js";

const FILE = path.join(process.cwd(), "data", "puzzles.js");
const env = {};
for (const l of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const rows = await fetch(`${env.SUPABASE_URL}/rest/v1/puzzles?select=puzzle_date,answer,accepts&order=puzzle_date`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
}).then((r) => r.json());

const { DICTIONARY } = await import("../data/puzzles.js");
const have = new Set(DICTIONARY);

const missing = [];
for (const r of rows) {
  for (const alias of r.accepts || []) {
    const n = normaliseGuess(alias);
    if (n && !have.has(n) && !missing.includes(n)) missing.push(n);
  }
  // the canonical answer must be typeable too
  const a = normaliseGuess(r.answer);
  if (a && !have.has(a) && !missing.includes(a)) missing.push(a);
}

if (!missing.length) { console.log("every accepted answer is already typeable ✓"); process.exit(0); }

const src = fs.readFileSync(FILE, "utf8");
const block = [
  "",
  "  // ── Accepted answers (aliases and regional names) ──",
  "  // Every string any puzzle accepts must appear here, or the guess box rejects",
  "  // it before the server ever sees it. \"aubergine\" was a correct answer the",
  "  // game refused to let anyone type. Kept in sync by scripts/sync-accepts-to-dictionary.mjs.",
  ...missing.map((w) => `  ${JSON.stringify(w)},`),
].join("\n");

const marker = "\n];\n\n// Dedupe, then sort.";
if (!src.includes(marker)) { console.error("could not find RAW_DICTIONARY terminator"); process.exit(1); }
fs.writeFileSync(FILE, src.replace(marker, `${block}${marker}`));

console.log(`added ${missing.length} previously un-typeable accepted answers:`);
console.log("  " + missing.join(", "));
