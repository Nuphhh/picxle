// Repoint the 5 puzzles whose images failed the colour audit at newly generated
// replacements (served same-origin from /public/puzzles so canvas pixelation works).
import fs from "node:fs";
import path from "node:path";

const env = {};
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const REPLACEMENTS = [
  { date: "2026-07-13", answer: "eggplant",    file: "eggplant.jpg",    was: "diseased/scabbed fruit" },
  { date: "2026-08-08", answer: "alarm clock", file: "alarm-clock.jpg", was: "near-black Sony radio" },
  { date: "2026-08-28", answer: "accordion",   file: "accordion.jpg",   was: "black & white archival photo" },
  { date: "2026-10-31", answer: "headphones",  file: "headphones.jpg",  was: "black & white studio shot" },
  { date: "2026-11-18", answer: "light bulb",  file: "light-bulb.jpg",  was: "Edison patent line drawing" },
];

for (const r of REPLACEMENTS) {
  const body = {
    image_src: `https://picxle.vercel.app/puzzles/${r.file}`,
    license: "CC0",
    attribution: "Picxle original (AI-generated)",
  };
  const res = await fetch(`${SB}/rest/v1/puzzles?puzzle_date=eq.${r.date}`, {
    method: "PATCH",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const out = await res.json();
  if (!res.ok || !out.length) { console.log(`FAIL ${r.date} ${r.answer}: ${JSON.stringify(out).slice(0, 120)}`); continue; }
  console.log(`ok  ${r.date}  ${r.answer.padEnd(12)} (was: ${r.was})`);
}
