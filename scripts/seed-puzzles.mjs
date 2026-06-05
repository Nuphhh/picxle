// scripts/seed-puzzles.mjs
// Usage (from the picxle-app directory):  node scripts/seed-puzzles.mjs
//
// Reads data/puzzles.json and inserts any entries whose puzzle_date isn't
// already in Supabase.  Running this multiple times is safe — existing rows
// are never overwritten or duplicated.
//
// Workflow:
//   1. Add new entries to data/puzzles.json (give them future puzzle_dates).
//   2. Run:  npm run seed
//   3. That's it.  Nothing else to do.
//
// IMPORTANT: Run the additive migration SQL in Supabase first (adds the
// puzzle_number column).  The script will fail gracefully if it's missing.

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// ── Load .env.local ───────────────────────────────────────────────────────────
// dotenv's default config() only reads ".env", not ".env.local".
// We parse the file ourselves to keep the dependency footprint small.
function loadEnv() {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
}
loadEnv();

// ── Validation ────────────────────────────────────────────────────────────────
const REQUIRED_FIELDS = [
  "puzzle_number", "puzzle_date", "image_src",
  "answer", "accepts", "category", "license", "attribution",
];

// "PD" is the existing DB convention for public domain.
// CC-BY-SA: share-alike applies to derivative works — displaying an image in a
// game is not a derivative, so CC-BY-SA images are fine with attribution.
const VALID_LICENSES = new Set(["CC0", "PD", "public-domain", "CC-BY", "CC-BY-SA"]);

function validateEntry(entry) {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (entry[field] == null || entry[field] === "") {
      errors.push(`missing "${field}"`);
    }
  }
  if (entry.puzzle_date && isNaN(Date.parse(entry.puzzle_date))) {
    errors.push(`unparseable date "${entry.puzzle_date}"`);
  }
  if (!Array.isArray(entry.accepts) || entry.accepts.length === 0) {
    errors.push("accepts must be a non-empty array");
  }
  if (entry.license && !VALID_LICENSES.has(entry.license)) {
    errors.push(`license "${entry.license}" must be one of: ${[...VALID_LICENSES].join(", ")}`);
  }
  return errors;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Why the service role key and not the anon key?
  // The anon key respects Row Level Security (RLS) — INSERT on puzzles is
  // blocked for anonymous callers.  The service role key bypasses RLS so this
  // script can write directly.  Keep it out of client-side code and git.
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Load JSON ──────────────────────────────────────────────────────────────
  const puzzles = JSON.parse(readFileSync("data/puzzles.json", "utf8"));
  console.log(`Loaded ${puzzles.length} entries from data/puzzles.json\n`);

  // ── Validate every entry before sending anything ───────────────────────────
  const validationErrors = [];
  for (const [i, entry] of puzzles.entries()) {
    const errs = validateEntry(entry);
    if (errs.length) {
      validationErrors.push(
        `  Entry ${i + 1} (${entry.puzzle_date ?? "?"}): ${errs.join(" | ")}`
      );
    }
  }
  if (validationErrors.length) {
    console.error("Validation failed — fix these before seeding:\n");
    console.error(validationErrors.join("\n"));
    process.exit(1);
  }
  console.log(`✓ All ${puzzles.length} entries passed validation`);

  // ── Determine which dates are genuinely new ────────────────────────────────
  // Fetching existing dates first lets us give an accurate summary and avoids
  // relying solely on the DB conflict handler for the count.
  const { data: existing, error: fetchErr } = await supabase
    .from("puzzles")
    .select("puzzle_date");
  if (fetchErr) {
    console.error("Could not read existing rows:", fetchErr.message);
    process.exit(1);
  }

  const existingDates = new Set(existing.map((r) => r.puzzle_date));
  const toInsert = puzzles.filter((p) => !existingDates.has(p.puzzle_date));
  const skipCount = puzzles.length - toInsert.length;

  console.log(`✓ DB currently has ${existingDates.size} rows`);
  console.log(`  ${skipCount} entries skipped (date already present)`);
  console.log(`  ${toInsert.length} new entries to insert\n`);

  if (toInsert.length === 0) {
    console.log("Nothing to do — all entries are already in the DB.");
    return;
  }

  // ── Upsert (append-only) ───────────────────────────────────────────────────
  // ignoreDuplicates: true  →  pure append; existing rows are never touched.
  // Flip to false only if you want edits in the JSON to overwrite existing rows.
  const { error: upsertErr } = await supabase
    .from("puzzles")
    .upsert(toInsert, { onConflict: "puzzle_date", ignoreDuplicates: true });

  if (upsertErr) {
    console.error("Upsert failed:", upsertErr.message);
    if (upsertErr.message.includes("puzzle_number")) {
      console.error(
        "\nHint: the puzzle_number column doesn't exist yet.\n" +
        "Run the additive migration SQL in the Supabase SQL editor first."
      );
    }
    process.exit(1);
  }

  console.log(`✓ Inserted ${toInsert.length} new puzzle${toInsert.length === 1 ? "" : "s"}:`);
  toInsert.forEach((r) =>
    console.log(
      `  #${String(r.puzzle_number).padStart(3)}  ${r.puzzle_date}  ${r.answer}  [${r.category}]`
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
