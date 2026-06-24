// One-off: apply the license-compliant re-sourced images to the puzzles table.
// Reads scratchpad/final-audit.json, backs up current rows, then updates
// image_src/license/attribution per id using the service-role key.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SCRATCH = "C:/Users/Nath/AppData/Local/Temp/claude/C--Users-Nath/d16d015c-ca8e-4839-a477-0a5c16d09a93/scratchpad";

// minimal .env.local parser
const env = {};
for (const line of readFileSync("./.env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const rows = JSON.parse(readFileSync(`${SCRATCH}/final-audit.json`, "utf8"));
const ids = rows.map((r) => r.id);

// 1. backup current values
const { data: before, error: selErr } = await supabase
  .from("puzzles").select("id, answer, image_src, license, attribution").in("id", ids);
if (selErr) { console.error("backup select failed:", selErr); process.exit(1); }
writeFileSync(`${SCRATCH}/db-backup-before.json`, JSON.stringify(before, null, 2));
console.log(`Backed up ${before.length} rows to db-backup-before.json`);

// 2. apply updates
let ok = 0, fail = 0;
for (const r of rows) {
  const { error } = await supabase.from("puzzles")
    .update({ image_src: r.image_src, license: r.license, attribution: r.attribution })
    .eq("id", r.id);
  if (error) { console.error("FAIL", r.answer, error.message); fail++; }
  else ok++;
}
console.log(`Updated ${ok} rows, ${fail} failed.`);

// 3. verify license mix now
const { data: mixRows } = await supabase.from("puzzles").select("license");
const mix = mixRows.reduce((m, x) => ((m[x.license] = (m[x.license] || 0) + 1), m), {});
console.log("License mix across ALL puzzles now:", mix);
