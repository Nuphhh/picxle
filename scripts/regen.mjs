// Force-regenerate specific subjects (bypassing the cache), back up whatever was
// there before, and update new-puzzles.json.
// Usage: node scripts/regen.mjs "wasp" "anchor" ...
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { execSync } from "node:child_process";
import { SUBJECTS } from "./new-subjects.mjs";

const OUT = path.join(process.cwd(), "..", "new-puzzles.json");
const PUB = path.join(process.cwd(), "public", "puzzles");
const UA = "PicxleBot/1.0 (regen; picxlebypenrose@gmail.com)";
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const NO_PEOPLE = "absolutely no people, no person, no hands, no human figures, no body parts";

const want = process.argv.slice(2);
if (!want.length) { console.error("give me subject answers to regenerate"); process.exit(1); }

const results = JSON.parse(fs.readFileSync(OUT, "utf8"));

function generate(prompt) {
  const full = /no people/i.test(prompt) ? prompt : `${prompt}, ${NO_PEOPLE}`;
  const out = execSync(`higgsfield generate create z_image --prompt ${JSON.stringify(full)} --aspect_ratio 1:1 --wait`,
    { encoding: "utf8", timeout: 600000 });
  const url = (out.match(/https?:\/\/\S+\.png/) || [])[0];
  if (!url) throw new Error("no url");
  return url;
}
function download(url, to) {
  execSync(`curl -sL --max-time 90 -A ${JSON.stringify(UA)} -o ${JSON.stringify(to)} ${JSON.stringify(url)}`, { timeout: 100000 });
  if (!fs.existsSync(to) || fs.statSync(to).size < 1000) throw new Error("download failed");
}

for (const answer of want) {
  const s = SUBJECTS.find((x) => x.answer === answer);
  if (!s?.prompt) { console.log(`SKIP ${answer} (no prompt)`); continue; }
  const file = `${slug(answer)}.jpg`;
  const dest = path.join(PUB, file);
  try {
    // keep the old one — a re-roll can come back WORSE (a fresh camel grew a second head)
    if (fs.existsSync(dest)) {
      const bak = path.join(PUB, `_backup-${file}`);
      if (!fs.existsSync(bak)) fs.copyFileSync(dest, bak);
    }
    const tmp = path.join(PUB, `_tmp_${slug(answer)}.png`);
    download(generate(s.prompt), tmp);
    await sharp(tmp).resize(1200, 1200, { fit: "cover" }).jpeg({ quality: 88 }).toFile(dest);
    fs.unlinkSync(tmp);

    const i = results.findIndex((r) => r.answer === answer);
    const row = {
      answer: s.answer, accepts: s.accepts, category: s.category, decoys: s.decoys,
      source: "generated", image_src: `https://picxle.vercel.app/puzzles/${file}`,
      license: "CC0", attribution: "Picxle original (AI-generated)", title: answer,
    };
    if (i >= 0) results[i] = row; else results.push(row);
    fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
    console.log(`ok   ${answer}`);
  } catch (e) {
    console.log(`FAIL ${answer}: ${e.message}`);
  }
}
console.log("done");
