// Prove the fix end to end: a regional alias must be (a) typeable in the guess
// box, and (b) graded correct by the server. Previously the database accepted
// "aubergine" but the guess box refused to let anyone enter it.
import fs from "node:fs";
import { normaliseGuess } from "../lib/normalise.js";

const BASE = "http://localhost:3000";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const rows = await fetch(`${env.SUPABASE_URL}/rest/v1/puzzles?select=id,puzzle_date,answer,accepts`, {
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
}).then((r) => r.json());
const { DICTIONARY } = await import("../data/puzzles.js");
const dict = new Set(DICTIONARY);

// The cases a UK player would actually type.
const CASES = [
  ["eggplant", "aubergine"], ["eggplant", "Aubergine"], ["eggplant", "  AUBERGINE "],
  ["ladybug", "ladybird"], ["fire truck", "fire engine"], ["corn", "sweetcorn"],
  ["motorcycle", "motorbike"], ["bicycle", "bike"], ["hippopotamus", "hippo"],
  ["grey wolf", "wolf"], ["orca", "killer whale"], ["solar eclipse", "eclipse"],
  ["kiwi", "kiwi fruit"], ["giant panda", "panda"], ["koala", "koala bear"],
  ["sagrada familia", "Sagrada Família"],   // accented input must work
  ["mont saint michel", "Mont-Saint-Michel"], // hyphens must work
  ["st basils cathedral", "Saint Basil's Cathedral"],
];

let pass = 0;
for (const [answer, typed] of CASES) {
  const puz = rows.find((r) => r.answer === answer);
  if (!puz) { console.log(`SKIP  ${answer} (no such puzzle)`); continue; }
  const n = normaliseGuess(typed);

  const typeable = dict.has(n);                       // client would let it through
  const graded = await fetch(`${BASE}/api/guess`, {   // server grades it
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ puzzleId: puz.id, guess: typed }),
  }).then((r) => r.json()).then((d) => d.correct).catch(() => null);

  const ok = typeable && graded === true;
  if (ok) pass++;
  console.log(`${ok ? "PASS" : "FAIL"}  "${typed}" for ${answer}`);
  if (!ok) console.log(`        typeable: ${typeable}   server says correct: ${graded}`);
}
console.log(`\n${pass}/${CASES.length} passed`);
process.exit(pass === CASES.length ? 0 : 1);
