// Fix autocomplete-collision false negatives: accept the alternative names that
// correctly describe the actual image for these puzzles.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync("./.env.local", "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0 && !line.startsWith("#")) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// answer -> the full accepts array it should have
const updates = {
  "penguin":    ["penguin", "emperor penguin"],
  "dolphin":    ["dolphin", "bottlenose dolphin"],
  "sunflowers": ["sunflowers", "sunflower"],          // van Gogh painting
  "sunflower":  ["sunflower", "sunflowers"],           // the plant
};

for (const [answer, accepts] of Object.entries(updates)) {
  const { error, count } = await supabase.from("puzzles").update({ accepts }, { count: "exact" }).eq("answer", answer);
  if (error) console.error("FAIL", answer, error.message);
  else console.log(`ok  ${answer} -> [${accepts.join(", ")}]`);
}
// verify
const { data } = await supabase.from("puzzles").select("answer, accepts").in("answer", Object.keys(updates));
console.log("\nVerify:");
for (const r of data) console.log(`  ${r.answer}: [${r.accepts.join(", ")}]`);
