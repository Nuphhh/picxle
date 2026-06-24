// Find autocomplete collisions: puzzle answers that are a substring-sibling of
// another DICTIONARY entry, so typing toward the answer also surfaces the other
// (and picking it fails). Prints candidates to classify for cross-accept.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { DICTIONARY } from "../data/puzzles.js";

const env = {};
for (const line of readFileSync("./.env.local", "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0 && !line.startsWith("#")) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: rows } = await supabase.from("puzzles").select("answer, accepts");
const answers = rows.map((r) => r.answer);
const acceptsByAnswer = Object.fromEntries(rows.map((r) => [r.answer, r.accepts]));
const dict = DICTIONARY.map((d) => d.toLowerCase());
const dictSet = new Set(dict);

// For each puzzle answer, find OTHER dictionary entries where one string is a
// substring of the other (these are the entries that co-appear in autocomplete).
const collisions = [];
for (const a of answers) {
  const sibs = dict.filter((d) => d !== a && (d.includes(a) || a.includes(d)));
  if (sibs.length) collisions.push({ answer: a, accepts: acceptsByAnswer[a], siblings: sibs });
}

console.log(`Puzzle answers with substring-sibling dictionary entries: ${collisions.length}\n`);
for (const c of collisions) {
  console.log(`${c.answer}  [accepts: ${c.accepts.join(", ")}]`);
  console.log(`   ↳ also surfaces: ${c.siblings.join(" | ")}`);
}
