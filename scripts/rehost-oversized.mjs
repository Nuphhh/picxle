// Re-host oversized puzzle images at a sane resolution.
//
// Some puzzles point straight at Wikimedia museum-scan originals — the Niagara
// Falls painting is 80 MB, the Mona Lisa 90 MB. Every player on that day's puzzle
// downloads the whole thing, which on mobile data is punishing. The game never
// needs more than a screen's worth of pixels, so cap them and serve from our own
// /public.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { execSync } from "node:child_process";

const PUB = path.join(process.cwd(), "public", "puzzles");
const UA = "PicxleBot/1.0 (image rehost; picxlebypenrose@gmail.com)";
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// dates whose images are oversized (from the size scan + the known Niagara)
const DATES = ["2026-07-17", "2026-06-01", "2026-06-09", "2026-06-10"];

const env = {};
for (const l of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

const rows = await fetch(`${env.SUPABASE_URL}/rest/v1/puzzles?select=puzzle_date,answer,image_src&puzzle_date=in.(${DATES.map((d) => `"${d}"`).join(",")})`, { headers: H }).then((r) => r.json());

for (const p of rows) {
  if (p.image_src.includes("picxle.vercel.app")) { console.log(`skip ${p.answer} (already re-hosted)`); continue; }
  const tmp = path.join(PUB, `_dl.bin`);
  execSync(`curl -sL --max-time 300 -A ${JSON.stringify(UA)} -o ${JSON.stringify(tmp)} ${JSON.stringify(p.image_src)}`, { timeout: 320000 });
  const before = fs.statSync(tmp).size / 1048576;
  const file = `${slug(p.answer)}.jpg`;
  // 2000px long edge is ample for any phone/tablet display and the expand modal.
  await sharp(tmp, { limitInputPixels: false })
    .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 }).toFile(path.join(PUB, file));
  fs.unlinkSync(tmp);
  const after = fs.statSync(path.join(PUB, file)).size / 1048576;
  console.log(`${p.puzzle_date}  ${p.answer.padEnd(14)} ${before.toFixed(1)}MB -> ${after.toFixed(2)}MB  (${file})`);
}
console.log("\nnext: commit+push images, then update DB, then rebuild teasers");
