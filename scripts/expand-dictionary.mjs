// Add the new puzzle answers AND their decoys to the guess dictionary.
//
// The decoys matter: if the only bird in the dictionary is "snowy owl", typing
// "ow" gives the answer away. Plausible neighbours (barn owl, tawny owl...) keep
// the autocomplete honest without making the puzzle unfair.
//
// Appends into RAW_DICTIONARY; the export already de-duplicates and sorts.
import fs from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "puzzles.js");
const news = JSON.parse(fs.readFileSync(path.join(process.cwd(), "..", "new-puzzles.json"), "utf8"));
const src = fs.readFileSync(FILE, "utf8");

const { DICTIONARY } = await import("../data/puzzles.js");
const have = new Set(DICTIONARY);

const words = [];
for (const p of news) {
  for (const w of [p.answer, ...(p.decoys || [])]) {
    const n = w.toLowerCase().trim();
    if (!have.has(n) && !words.includes(n)) words.push(n);
  }
}
if (!words.length) { console.log("nothing new to add"); process.exit(0); }

const answers = news.map((p) => p.answer);
const block = [
  "",
  "  // ── Added with the December 2026+ puzzle batch ──",
  "  // Answers, plus plausible decoys so the autocomplete does not give the answer away.",
  ...words.map((w) => `  ${JSON.stringify(w)},`),
].join("\n");

// insert just before the closing bracket of RAW_DICTIONARY
const marker = "\n];\n\n// Dedupe, then sort.";
if (!src.includes(marker)) { console.error("could not find RAW_DICTIONARY terminator"); process.exit(1); }
fs.writeFileSync(FILE, src.replace(marker, `${block}${marker}`));

console.log(`added ${words.length} words (${answers.length} answers + ${words.length - answers.filter(a=>words.includes(a)).length} decoys)`);
console.log(words.join(", "));
