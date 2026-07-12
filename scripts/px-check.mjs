// Vet a candidate puzzle image: side-by-side of the full photo and how it will
// actually look in-game at stage 1 (8x8), plus the colour metrics from the audit.
// Usage: node scripts/px-check.mjs <image-path-or-url> [label]
import sharp from "sharp";
import fs from "node:fs";

const D = "C:/Users/Nath/AppData/Local/Temp/claude/C--Users-Nath/d16d015c-ca8e-4839-a477-0a5c16d09a93/scratchpad";
const src = process.argv[2];
const label = process.argv[3] || "check";

const buf = /^https?:/.test(src)
  ? Buffer.from(await fetch(src, { headers: { "User-Agent": "PicxleBot/1.0" } }).then((r) => r.arrayBuffer()))
  : fs.readFileSync(src);

// game pipeline: centre-crop square -> 8x8 -> nearest upscale
const master = await sharp(buf, { limitInputPixels: false }).resize(440, 440, { fit: "cover" }).toBuffer();
const small = await sharp(master).resize(8, 8, { fit: "fill" }).toBuffer();
const px = await sharp(small).resize(440, 440, { kernel: "nearest" }).toBuffer();
await sharp({ create: { width: 890, height: 440, channels: 3, background: { r: 20, g: 20, b: 20 } } })
  .composite([{ input: master, left: 0, top: 0 }, { input: px, left: 450, top: 0 }])
  .png().toFile(`${D}/${label}-check.png`);

// colour metrics (same as the audit)
const { data, info } = await sharp(buf, { limitInputPixels: false }).resize(200, 200, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const n = info.width * info.height;
let sum = 0, coloured = 0;
const hist = new Array(36).fill(0);
for (let i = 0; i < n; i++) {
  const r = data[i*3], g = data[i*3+1], b = data[i*3+2];
  const c = Math.max(r,g,b) - Math.min(r,g,b);
  sum += c;
  if (c > 30) {
    coloured++;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    let h = max === r ? ((g-b)/d) % 6 : max === g ? (b-r)/d + 2 : (r-g)/d + 4;
    h *= 60; if (h < 0) h += 360;
    hist[Math.floor(h/10) % 36]++;
  }
}
let best = 0;
for (let s = 0; s < 36; s++) { let w = 0; for (let k = 0; k < 6; k++) w += hist[(s+k)%36]; if (w > best) best = w; }
let hues = 0;
for (let s = 0; s < 36; s += 3) {
  const w = hist[s] + hist[(s+1)%36] + hist[(s+2)%36];
  if (coloured && w / coloured >= 0.05) hues++;
}
const sat = sum / n, pctCol = (coloured / n) * 100, hue90 = coloured ? (best/coloured)*100 : 100;
const verdict = sat < 4 ? "BLACK & WHITE - REJECT" : sat < 15 ? "TOO DESATURATED - REJECT" : (hue90 > 95 && hues <= 1) ? "single tint - risky" : "good colour";
console.log(`${label}: sat=${sat.toFixed(1)} %col=${pctCol.toFixed(0)}% hue90=${hue90.toFixed(0)}% hues=${hues} -> ${verdict}`);
console.log(`preview -> ${D}/${label}-check.png`);
