#!/usr/bin/env node
// Picxle reveal-clip generator.
//
//   node makeclip.js                       # yesterday's puzzle -> vertical mp4
//   node makeclip.js --puzzle 2026-07-27   # a specific day
//   node makeclip.js --promo --gif         # evergreen advert + a square GIF
//
// The answer is NEVER drawn on the video: platforms lift a late frame for the feed
// thumbnail (which would spoil it), and leaving it unsaid is what makes people
// comment their guess. It goes in the caption.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import opentype from "opentype.js";
import {
  VIDEO, GIF, COLOUR, FONT, COPY as BASE_COPY, PROMO,
  BEATS, GIF_BEATS, LAYOUT, GIF_LAYOUT, BARS,
} from "./config.js";
import { exactStages } from "./exact.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TMP = path.join(HERE, "tmp");
const OUT = path.join(HERE, "out");

// --promo swaps day-specific copy for advert copy: an ad that runs for weeks cannot
// say "YESTERDAY'S PICXLE".
const PROMO_MODE = process.argv.includes("--promo");
const COPY = PROMO_MODE ? { ...BASE_COPY, ...PROMO } : BASE_COPY;

// ── the game's pixelation ────────────────────────────────────────────────────
const RES_STEPS = [8, 12, 19, 29, 45];
const MASTER = 440;

// Fast path. Same crop, block grid and hard edges — but Chrome's canvas downscaler
// uses a different filter than sharp's Lanczos, so block COLOURS land ~5% off and,
// side by side, the blue and near-black blocks vanish. --fast only.
async function stageImage(srcBuf, res, size) {
  // sharp COLLAPSES chained .resize() calls into the last one — two passes.
  const master = await sharp(srcBuf, { limitInputPixels: false })
    .resize(MASTER, MASTER, { fit: "cover", position: "centre" }).toBuffer();
  const small = await sharp(master).resize(res, res, { fit: "fill" }).toBuffer();
  return sharp(small).resize(size, size, { kernel: "nearest" }).png().toBuffer();
}
async function exactStageImages(srcBuf, size, isFlag) {
  const stages = await exactStages(srcBuf, RES_STEPS, { isFlag });
  return Promise.all(stages.map(({ res, rgb }) =>
    sharp(rgb, { raw: { width: res, height: res, channels: 3 } })
      .resize(size, size, { kernel: "nearest" }).png().toBuffer())); // raw in => name the format
}
const sharpImage = (srcBuf, size) =>
  sharp(srcBuf, { limitInputPixels: false })
    .resize(size, size, { fit: "cover", position: "centre" }).png().toBuffer();

// ── text (ffmpeg drawtext — see endCardText for why NOT SVG glyph paths) ─────
const esc = (s) => String(s).replace(/'/g, "’").replace(/([:\\%])/g, "\\$1");
function drawtext({ text, font, size, colour, y, x = "(w-text_w)/2", scrim = false }) {
  const parts = [
    `text='${esc(text)}'`, `fontfile=${font}`, `fontsize=${size}`,
    `fontcolor=${colour}`, `x=${x}`, `y=${y}`,
  ];
  if (scrim) parts.push(`box=1`, `boxcolor=${COLOUR.bg}@${LAYOUT.scrimOpacity}`, `boxborderw=26`);
  return `drawtext=${parts.join(":")}`;
}
const loadFont = (rel) => opentype.parse(fs.readFileSync(path.join(HERE, rel)).buffer);

// ── frame composition ───────────────────────────────────────────────────────
const roundedMask = (size, r) =>
  Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);

// The game's SHARPNESS row: five ascending bars that fill as the picture resolves.
function sharpnessBars(V, L, filledUpTo, done) {
  const { width: bw, gap, heights } = BARS;
  const total = heights.length * bw + (heights.length - 1) * gap;
  let x = (V.width - total) / 2;
  return heights.map((h, i) => {
    const on = done || i <= filledUpTo;
    const fill = done ? COLOUR.green : on ? COLOUR.blue : COLOUR.line;
    const r = `<rect x="${Math.round(x)}" y="${L.barsBaseline - h}" width="${bw}" height="${h}" rx="4" fill="${fill}"/>`;
    x += bw + gap;
    return r;
  }).join("");
}

async function frame(V, L, imageBuf, file, { stage = null, done = false } = {}) {
  const panel = await sharp(imageBuf)
    .composite([{ input: roundedMask(L.imageSize, L.cornerRadius), blend: "dest-in" }])
    .png().toBuffer();
  const bars = Buffer.from(
    `<svg width="${V.width}" height="${V.height}" xmlns="http://www.w3.org/2000/svg">${sharpnessBars(V, L, stage ?? -1, done)}</svg>`
  );
  await sharp({ create: { width: V.width, height: V.height, channels: 4, background: COLOUR.bg } })
    .composite([
      { input: panel, left: Math.round((V.width - L.imageSize) / 2), top: L.imageTop },
      { input: bars, left: 0, top: 0 },
    ])
    .png().toFile(file);
}

// Brand line on every puzzle beat — most people never reach the end card.
// Space Mono is MONOSPACED, so the blue X is placed by counting character cells.
function footerText(V, L) {
  const mono = loadFont(FONT.mono);
  const size = V.height > 1500 ? 30 : 26;
  const cell = mono.getAdvanceWidth("M", size);
  const tail = ` ${COPY.footerSep} ${COPY.ctaUrl}`;
  const x0 = (V.width - (6 + tail.length) * cell) / 2;
  const at = (n) => String(Math.round(x0 + n * cell));
  const y = String(L.footerY);
  return [
    drawtext({ text: "PIC", font: FONT.mono, size, colour: COLOUR.textDim, y, x: at(0) }),
    drawtext({ text: "X", font: FONT.mono, size, colour: COLOUR.blue, y, x: at(3) }),
    drawtext({ text: "LE", font: FONT.mono, size, colour: COLOUR.textDim, y, x: at(4) }),
    drawtext({ text: tail.trimStart(), font: FONT.mono, size, colour: COLOUR.textDim, y, x: at(7) }),
  ];
}

// End card. The wordmark needs a blue X, and drawtext colours a whole string or
// nothing — so rendering glyphs as SVG paths seemed obvious. It is a trap: librsvg
// mangles opentype's output differently at every turn (an unclosed apostrophe made
// it abandon the rest of the line; a "p" counter filled into a blob; a "u" vanished).
// drawtext uses FreeType and is flawless, so the SVG draws only RECTANGLES and the
// wordmark is three positioned drawtext calls. opentype is used for ADVANCE WIDTHS
// only — metrics, not rendering. GPOS is stripped from the fonts, so there is no
// kerning and the segments butt up exactly.
function endCardGeometry(V) {
  const markSize = V.height > 1500 ? 150 : 118;
  const markY = Math.round(V.height * 0.46);
  return { markSize, markY };
}
function endCardText(V) {
  const { markSize, markY } = endCardGeometry(V);
  const display = loadFont(FONT.display);
  const wPic = display.getAdvanceWidth("PIC", markSize);
  const wX = display.getAdvanceWidth("X", markSize);
  const wLe = display.getAdvanceWidth("LE", markSize);
  const x0 = (V.width - (wPic + wX + wLe)) / 2;
  const top = Math.round(markY - markSize * 0.78); // drawtext y = top of box, not baseline
  const seg = (text, x, colour) =>
    drawtext({ text, font: FONT.display, size: markSize, colour, y: String(top), x: String(Math.round(x)) });
  return [
    seg("PIC", x0, COLOUR.text),
    seg("X", x0 + wPic, COLOUR.blue),
    seg("LE", x0 + wPic + wX, COLOUR.text),
    drawtext({ text: COPY.ctaTitle, font: FONT.display, size: markSize * 0.4, colour: COLOUR.text, y: String(markY + markSize * 0.73) }),
    drawtext({ text: COPY.ctaUrl, font: FONT.mono, size: markSize * 0.28, colour: COLOUR.blue, y: String(markY + markSize * 1.33) }),
  ];
}
async function endCardFrame(V, file) {
  const { markSize, markY } = endCardGeometry(V);
  const svg = `<svg width="${V.width}" height="${V.height}" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="g" cx="50%" cy="46%" r="60%">
      <stop offset="0%" stop-color="${COLOUR.panel}"/><stop offset="100%" stop-color="${COLOUR.bg}"/>
    </radialGradient></defs>
    <rect width="${V.width}" height="${V.height}" fill="url(#g)"/>
    <rect x="${(V.width - 180) / 2}" y="${Math.round(markY + markSize * 0.27)}" width="180" height="3" rx="1.5" fill="${COLOUR.blue}" opacity="0.55"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
}

// ── render one variant (vertical video, or square GIF) ───────────────────────
async function renderVariant({ V, L, B, stageBufs, revealBuf, outFile, gif, category, tag }) {
  const dir = path.join(TMP, tag);
  fs.mkdirSync(dir, { recursive: true });

  const frames = [];
  for (let i = 0; i < stageBufs.length; i++) {
    const f = path.join(dir, `stage-${i}.png`);
    await frame(V, L, stageBufs[i], f, { stage: i });
    frames.push(f);
  }
  const revealFile = path.join(dir, "reveal.png");
  await frame(V, L, revealBuf, revealFile, { done: true }); // bars go green, as in the game
  const endFile = path.join(dir, "end.png");
  await endCardFrame(V, endFile);

  const footer = footerText(V, L);
  const big = V.height > 1500;
  const counter = (n) => drawtext({ text: COPY.guessLabel(n, RES_STEPS.length), font: FONT.mono, size: big ? 38 : 30, colour: COLOUR.textDim, y: String(L.counterY) });
  const title = (text, size, colour = COLOUR.text, scrim = false) =>
    drawtext({ text, font: FONT.display, size: big ? size : Math.round(size * 0.72), colour, y: String(L.titleY), scrim });

  const beats = [
    { file: frames[0], dur: B.hook, flash: B.flash, texts: [
      title(COPY.hook, 78),
      ...(category ? [drawtext({ text: `${COPY.categoryPrefix}: ${category.toUpperCase()}`, font: FONT.mono, size: big ? 34 : 26, colour: COLOUR.blue, y: String(L.categoryY) })] : []),
      counter(1), ...footer,
    ] },
    ...frames.slice(1).map((f, i) => ({
      file: f, dur: B.stages[i] ?? B.stages.at(-1), flash: B.flash,
      texts: [title(COPY.hook, 78), counter(i + 2), ...footer],
    })),
    // PAUSE beat — VIDEO ONLY. You cannot pause a GIF: it autoplays, loops and has
    // no controls, so telling a GIF viewer to pause asks for something impossible.
    // In the GIF the loop IS the second look.
    ...(gif ? [] : [{
      file: frames.at(-1), dur: B.pause, flash: 0, // same image as stage 5 — a flash would announce a change that never happened
      texts: [title(COPY.pause, 66, COLOUR.blue, true), counter(RES_STEPS.length), ...footer],
    }]),
    { file: revealFile, dur: B.reveal, flash: B.revealFlash, texts: [
      title("Did you get it?", 72),
      drawtext({ text: COPY.revealKicker, font: FONT.mono, size: big ? 38 : 28, colour: COLOUR.green, y: String(L.categoryY) }),
      ...footer,
    ] },
    { file: endFile, dur: B.endCard, flash: B.flash, texts: endCardText(V) },
  ];

  const inputs = [], filters = [];
  beats.forEach((b, i) => {
    inputs.push("-loop", "1", "-t", String(b.dur), "-framerate", String(gif ? GIF.fps : VIDEO.fps), "-i", path.relative(HERE, b.file).replace(/\\/g, "/"));
    // Flash = fade IN from the brand cream: the beat opens on a blink and resolves,
    // mirroring the game's own canvas flash. A cross-dissolve would blend the pixel
    // blocks into mush — the hard blocks ARE the brand. ffmpeg wants 0xRRGGBB.
    const flash = b.flash ? [`fade=t=in:st=0:d=${b.flash}:color=0x${COLOUR.bg.replace("#", "").toUpperCase()}`] : [];
    filters.push(`[${i}:v]${[...b.texts, ...flash, "format=yuv420p", "setsar=1"].join(",")}[v${i}]`);
  });
  const concat = beats.map((_, i) => `[v${i}]`).join("") + `concat=n=${beats.length}:v=1:a=0[out]`;
  const rel = (f) => path.relative(HERE, f).replace(/\\/g, "/");

  if (!gif) {
    execFileSync(ffmpeg, [
      "-y", ...inputs, "-filter_complex", `${filters.join(";")};${concat}`, "-map", "[out]",
      "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
      "-r", String(VIDEO.fps), "-movflags", "+faststart", // first frame is the blockiest stage, so the default cover cannot spoil it
      rel(outFile),
    ], { cwd: HERE, stdio: ["ignore", "ignore", "pipe"] });
  } else {
    // Two-pass palette: a default 256-colour quantise bands the flat brand cream badly.
    execFileSync(ffmpeg, [
      "-y", ...inputs,
      "-filter_complex",
      `${filters.join(";")};${concat};[out]scale=${GIF.scale}:${GIF.scale}:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3[g]`,
      "-map", "[g]", "-loop", "0", rel(outFile),
    ], { cwd: HERE, stdio: ["ignore", "ignore", "pipe"] });
  }
  return beats.reduce((s, b) => s + b.dur, 0);
}

// ── input ───────────────────────────────────────────────────────────────────
function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
}
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function loadImage(src) {
  if (/^https?:/.test(src)) {
    const res = await fetch(src, { headers: { "User-Agent": "PicxleClipgen/1.0" } });
    if (!res.ok) throw new Error(`could not fetch image: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(src);
}

// Pull the day's puzzle from the DB so the ATTRIBUTION cannot be forgotten — 68 of
// the images are CC-BY, where crediting the photographer is a licence condition.
async function fetchPuzzle(date) {
  const envPath = path.join(HERE, "..", "..", ".env.local");
  if (!fs.existsSync(envPath)) throw new Error("no .env.local — pass --image/--answer by hand");
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const rows = await fetch(
    `${env.SUPABASE_URL}/rest/v1/puzzles?select=puzzle_date,answer,category,image_src,license,attribution&puzzle_date=eq.${date}`,
    { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
  ).then((r) => r.json());
  if (!rows?.length) throw new Error(`no puzzle for ${date}`);
  return rows[0];
}
const yesterday = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  let image = arg("image"), answer = arg("answer"), category = arg("category", "");
  let credit = arg("credit", ""), date = arg("date");

  if (!image) {
    const p = await fetchPuzzle(arg("puzzle", yesterday()));
    image = p.image_src;
    answer = answer || p.answer;
    category = category || p.category || "";
    credit = credit || (p.license === "CC0" || p.license === "PD" ? "" : p.attribution);
    date = date || p.puzzle_date;
    console.log(`puzzle  ${p.puzzle_date}  ${p.answer} (${p.category}, ${p.license})`);
  }
  date = date || new Date().toISOString().slice(0, 10);
  if (!image || !answer) {
    console.error(`usage: node makeclip.js [--puzzle YYYY-MM-DD] [--promo] [--gif] [--fast]
       node makeclip.js --image <path|url> --answer "..." [--category ...] [--credit ...]`);
    process.exit(1);
  }

  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  const src = await loadImage(image);
  const isFlag = category.toLowerCase() === "flag"; // the game letterboxes flags
  const wantGif = process.argv.includes("--gif");
  const wantFast = process.argv.includes("--fast");

  // Pixelate once at the larger of the two image sizes, then downscale per variant —
  // nearest-neighbour, so the hard block edges survive.
  const renderSize = Math.max(LAYOUT.imageSize, GIF_LAYOUT.imageSize);
  let stages;
  if (wantFast) {
    stages = await Promise.all(RES_STEPS.map((r) => stageImage(src, r, renderSize)));
    console.log("pixelation: fast (sharp) — approximate colours, NOT identical to the game");
  } else {
    try {
      stages = await exactStageImages(src, renderSize, isFlag);
      console.log("pixelation: exact — rendered through the game's own canvas");
    } catch (e) {
      console.log(`pixelation: falling back to fast (${e.message.split("\n")[0]})`);
      stages = await Promise.all(RES_STEPS.map((r) => stageImage(src, r, renderSize)));
    }
  }
  const revealFull = await sharpImage(src, renderSize);
  const fit = (buf, size) => sharp(buf).resize(size, size, { kernel: "nearest" }).png().toBuffer();

  const base = `${date}-${slug(answer)}${PROMO_MODE ? "-promo" : ""}`;
  const outFile = path.join(OUT, `${base}.mp4`);
  const total = await renderVariant({
    V: VIDEO, L: LAYOUT, B: BEATS, tag: "v", category, outFile, gif: false,
    stageBufs: await Promise.all(stages.map((b) => fit(b, LAYOUT.imageSize))),
    revealBuf: await fit(revealFull, LAYOUT.imageSize),
  });
  console.log(`video   ${outFile}`);
  console.log(`length  ${total.toFixed(1)}s  ${VIDEO.width}x${VIDEO.height}  silent`);

  if (wantGif) {
    const gifFile = path.join(OUT, `${base}.gif`);
    const gt = await renderVariant({
      V: GIF, L: GIF_LAYOUT, B: GIF_BEATS, tag: "g", category, outFile: gifFile, gif: true,
      stageBufs: await Promise.all(stages.map((b) => fit(b, GIF_LAYOUT.imageSize))),
      revealBuf: await fit(revealFull, GIF_LAYOUT.imageSize),
    });
    const mb = (fs.statSync(gifFile).size / 1024 / 1024).toFixed(1);
    console.log(`gif     ${gifFile}`);
    console.log(`        ${gt.toFixed(1)}s  ${GIF.scale}x${GIF.scale} square, loops, NO pause beat  (${mb} MB)`);
  }

  // ── caption ──
  const pretty = answer.replace(/\b[a-z]/g, (c) => c.toUpperCase()); // answers are stored lowercase
  const daily = [
    `${COPY.hook} Yesterday's Picxle was: ${pretty}.`, ``,
    `Did you get it? Play today's puzzle at ${COPY.ctaUrl}`, ``,
    category ? `Category: ${category}` : ``,
  ];
  const caption = [
    ...(PROMO_MODE ? PROMO.caption(pretty, category) : daily),
    credit ? `Image: ${credit}` : ``,
    ``,
    PROMO_MODE
      ? `#picxle #puzzlegame #dailypuzzle #guessthepicture #brainteaser`
      : `#picxle #dailypuzzle #guessthepicture #${slug(category || "puzzle").replace(/-/g, "")} #puzzlegame`,
  ].filter((l) => l !== null).join("\n");
  const captionFile = path.join(OUT, `${base}.txt`);
  fs.writeFileSync(captionFile, caption);
  console.log(`caption ${captionFile}`);

  fs.rmSync(TMP, { recursive: true, force: true });
  if (!credit) console.log(`\nnote: no credit. CC-BY images MUST be attributed when you post them.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
