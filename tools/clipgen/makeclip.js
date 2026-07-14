#!/usr/bin/env node
// Picxle reveal-clip generator.
//
//   node makeclip.js --image ./photo.jpg --answer "The Colosseum" --category "Landmarks"
//
// Produces a 1080x1920 MP4 of the puzzle sharpening stage by stage, plus a
// suggested caption. The answer is NOT drawn on the video: platforms lift a late
// frame for the feed thumbnail, which would spoil it before anyone taps, and
// leaving it unsaid is what makes people comment their guess. It goes in the
// caption instead.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import opentype from "opentype.js";
import { VIDEO, COLOUR, FONT, COPY, BEATS, LAYOUT, BARS } from "./config.js";
import { exactStages } from "./exact.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TMP = path.join(HERE, "tmp");
const OUT = path.join(HERE, "out");

// ── the game's pixelation ────────────────────────────────────────────────────
// Ported from data/puzzles.js + components/PicxleGame.jsx. The game draws the
// source to a 440px CENTRE-CROPPED square master, downscales that to N x N, then
// blows it back up with imageSmoothingEnabled=false — hard blocks, no blending.
// These are the real numbers, not a lookalike.
const RES_STEPS = [8, 12, 19, 29, 45]; // one per guess
const MASTER = 440;

// Fast path (default). Structurally identical to the game — same crop, same block
// grid, same hard edges — but Chrome's canvas downscaler uses a different filter
// than sharp's Lanczos, so block COLOURS land ~5% off. Invisible in a moving clip.
async function stageImage(srcBuf, res, size) {
  // Two passes: sharp COLLAPSES chained .resize() calls into the last one, so
  // downscaling and upscaling in one chain would silently skip the pixelation.
  const master = await sharp(srcBuf, { limitInputPixels: false })
    .resize(MASTER, MASTER, { fit: "cover", position: "centre" })
    .toBuffer();
  const small = await sharp(master).resize(res, res, { fit: "fill" }).toBuffer();
  return sharp(small).resize(size, size, { kernel: "nearest" }).toBuffer();
}

// --exact: the block colours come from the game's own canvas, via headless Chrome.
// Only the hard-edged blow-up is done here, which sharp does exactly (kernel:nearest).
async function exactStageImages(srcBuf, size, isFlag) {
  const stages = await exactStages(srcBuf, RES_STEPS, { isFlag });
  return Promise.all(stages.map(({ res, rgb }) =>
    sharp(rgb, { raw: { width: res, height: res, channels: 3 } })
      .resize(size, size, { kernel: "nearest" })
      .png()          // raw in => sharp cannot infer an output format; say it
      .toBuffer()
  ));
}

async function sharpImage(srcBuf, size) {
  return sharp(srcBuf, { limitInputPixels: false })
    .resize(size, size, { fit: "cover", position: "centre" })
    .toBuffer();
}

// ── frame composition ───────────────────────────────────────────────────────
const roundedMask = (size, r) =>
  Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);

// The game's SHARPNESS row: five ascending bars that fill as the picture resolves.
// Drawn straight into the frame (rects only — librsvg is reliable with those).
function sharpnessBars(filledUpTo, done = false) {
  const { width } = VIDEO;
  const { barsBaseline } = LAYOUT;
  const { width: bw, gap, heights } = BARS;
  const total = heights.length * bw + (heights.length - 1) * gap;
  let x = (width - total) / 2;
  const rects = heights.map((h, i) => {
    const on = done || i <= filledUpTo;
    const fill = done ? COLOUR.green : on ? COLOUR.blue : COLOUR.line;
    const r = `<rect x="${Math.round(x)}" y="${barsBaseline - h}" width="${bw}" height="${h}" rx="4" fill="${fill}"/>`;
    x += bw + gap;
    return r;
  });
  return rects.join("");
}

async function frame(imageBuf, file, { stage = null, done = false } = {}) {
  const { width, height } = VIDEO;
  const { imageSize, imageTop, cornerRadius } = LAYOUT;
  const panel = await sharp(imageBuf)
    .composite([{ input: roundedMask(imageSize, cornerRadius), blend: "dest-in" }])
    .png()
    .toBuffer();

  const bars = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${sharpnessBars(stage ?? -1, done)}</svg>`
  );

  await sharp({ create: { width, height, channels: 4, background: COLOUR.bg } })
    .composite([
      { input: panel, left: Math.round((width - imageSize) / 2), top: imageTop },
      { input: bars, left: 0, top: 0 },
    ])
    .png()
    .toFile(file);
}

// The end card is drawn as VECTOR PATHS, not text.
//
// ffmpeg's drawtext colours a whole string or nothing, so it cannot give the
// wordmark its blue X — and sharp's SVG renderer won't reliably pick up a bundled
// font by name. Converting glyphs to paths with opentype sidesteps both: exact
// per-letter colour, and no font resolution at render time.
// TEXT IS DRAWN BY FFMPEG, NOT BY SVG.
//
// The wordmark needs a blue X, and drawtext colours a whole string or nothing — so
// the obvious move was to render glyphs as SVG paths. That was a rabbit hole:
// librsvg (sharp's SVG renderer) mangles opentype's output in a different way at
// every turn (an unclosed apostrophe made it abandon the rest of the line; a "p"
// counter filled into a blob; then a "u" vanished outright).
//
// ffmpeg's drawtext uses FreeType and renders every other beat perfectly. So the
// SVG now draws only RECTANGLES (which librsvg handles fine), and the wordmark is
// three separate drawtext calls positioned by opentype's ADVANCE WIDTHS — metrics,
// not rendering. With GPOS dropped from the font there is no kerning, so segment
// advances are exact and the three pieces butt up seamlessly.
const loadFont = (rel) => opentype.parse(fs.readFileSync(path.join(HERE, rel)).buffer);

const MARK_SIZE = 150;
const MARK_Y = 880; // baseline of the wordmark

// Brand line along the bottom of every PUZZLE beat.
//
// Most people never reach the end card — they scroll away mid-reveal — so the only
// branding they would ever see is on the frames they actually watch. This fills the
// dead space under the image with the one thing that earns its place there.
//
// Space Mono is MONOSPACED, so the blue X can be placed by counting characters
// rather than measuring glyphs: every cell is exactly one advance wide.
function footerText() {
  const { width } = VIDEO;
  const mono = loadFont(FONT.mono);
  const size = 30;
  const cell = mono.getAdvanceWidth("M", size); // monospace: every glyph is this wide
  const tail = ` ${COPY.footerSep} ${COPY.ctaUrl}`;
  const cells = 6 + tail.length; // PICXLE + tail
  const x0 = (width - cells * cell) / 2;
  const at = (n) => String(Math.round(x0 + n * cell));
  const y = String(LAYOUT.footerY);
  return [
    drawtext({ text: "PIC", font: FONT.mono, size, colour: COLOUR.textDim, y, x: at(0) }),
    drawtext({ text: "X", font: FONT.mono, size, colour: COLOUR.blue, y, x: at(3) }),
    drawtext({ text: "LE", font: FONT.mono, size, colour: COLOUR.textDim, y, x: at(4) }),
    drawtext({ text: tail.trimStart(), font: FONT.mono, size, colour: COLOUR.textDim, y, x: at(7) }),
  ];
}

function endCardText() {
  const { width } = VIDEO;
  const display = loadFont(FONT.display);
  const wPic = display.getAdvanceWidth("PIC", MARK_SIZE);
  const wX = display.getAdvanceWidth("X", MARK_SIZE);
  const wLe = display.getAdvanceWidth("LE", MARK_SIZE);
  const x0 = (width - (wPic + wX + wLe)) / 2;

  // drawtext's y is the TOP of the text box, not the baseline — nudge up by the
  // cap height so the mark sits where the layout expects.
  const top = Math.round(MARK_Y - MARK_SIZE * 0.78);
  const seg = (text, x, colour) =>
    drawtext({ text, font: FONT.display, size: MARK_SIZE, colour, y: top, x: String(Math.round(x)) });

  return [
    seg("PIC", x0, COLOUR.text),
    seg("X", x0 + wPic, COLOUR.blue), // the brand blue X
    seg("LE", x0 + wPic + wX, COLOUR.text),
    drawtext({ text: COPY.ctaTitle, font: FONT.display, size: 60, colour: COLOUR.text, y: MARK_Y + 110 }),
    drawtext({ text: COPY.ctaUrl, font: FONT.mono, size: 42, colour: COLOUR.blue, y: MARK_Y + 200 }),
  ];
}

async function endCardFrame(file) {
  const { width, height } = VIDEO;
  // Rectangles and a gradient only — no text, no glyph paths.
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g" cx="50%" cy="46%" r="60%">
        <stop offset="0%" stop-color="${COLOUR.panel}"/>
        <stop offset="100%" stop-color="${COLOUR.bg}"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    <rect x="${(width - 180) / 2}" y="${MARK_Y + 40}" width="180" height="3" rx="1.5" fill="${COLOUR.blue}" opacity="0.55"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
}

// ── text ────────────────────────────────────────────────────────────────────
// Curly apostrophe sidesteps ffmpeg's filter escaping entirely (and looks better).
const esc = (s) => String(s).replace(/'/g, "’").replace(/([:\\%])/g, "\\$1");

function drawtext({ text, font, size, colour, y, x = "(w-text_w)/2", scrim = false, letterSpacing = 0 }) {
  const parts = [
    `text='${esc(text)}'`,
    `fontfile=${font}`,
    `fontsize=${size}`,
    `fontcolor=${colour}`,
    `x=${x}`,
    `y=${y}`,
  ];
  if (letterSpacing) parts.push(`expansion=none`);
  if (scrim) {
    // Readable on both light and dark photos without a hard box.
    parts.push(`box=1`, `boxcolor=${COLOUR.bg}@${LAYOUT.scrimOpacity}`, `boxborderw=26`);
  }
  return `drawtext=${parts.join(":")}`;
}

// ── build ───────────────────────────────────────────────────────────────────
function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
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

// Pull a day's puzzle straight from the database, so the daily post is one command
// and the ATTRIBUTION cannot be forgotten — 68 of the puzzles are CC-BY, where
// crediting the photographer is a licence condition, not a nicety.
async function fetchPuzzle(date) {
  const envPath = path.join(HERE, "..", "..", ".env.local");
  if (!fs.existsSync(envPath)) throw new Error("no .env.local — pass --image/--answer by hand");
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const url = `${env.SUPABASE_URL}/rest/v1/puzzles?select=puzzle_date,answer,category,image_src,license,attribution&puzzle_date=eq.${date}`;
  const rows = await fetch(url, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  }).then((r) => r.json());
  if (!rows?.length) throw new Error(`no puzzle for ${date}`);
  return rows[0];
}

// Default: yesterday. The clip always shows a puzzle that is already finished, so
// it can never spoil the live one.
const yesterday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

async function main() {
  // Two ways in:
  //   node makeclip.js                      -> yesterday's puzzle, straight from the DB
  //   node makeclip.js --puzzle 2026-07-14  -> that day's puzzle
  //   node makeclip.js --image ... --answer ...  -> anything, by hand
  let image = arg("image");
  let answer = arg("answer");
  let category = arg("category", "");
  let credit = arg("credit", ""); // CC-BY images MUST be attributed when posted
  let date = arg("date");

  if (!image) {
    const day = arg("puzzle", yesterday());
    const p = await fetchPuzzle(day);
    image = p.image_src;
    answer = answer || p.answer;
    category = category || p.category || "";
    credit = credit || (p.license === "CC0" || p.license === "PD" ? "" : `${p.attribution}`);
    date = date || p.puzzle_date;
    console.log(`puzzle  ${p.puzzle_date}  ${p.answer} (${p.category}, ${p.license})`);
  }
  date = date || new Date().toISOString().slice(0, 10);

  if (!image || !answer) {
    console.error("usage: node makeclip.js [--puzzle YYYY-MM-DD] | --image <path|url> --answer \"...\" [--category ...] [--credit ...]");
    process.exit(1);
  }

  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  const src = await loadImage(image);
  const { imageSize } = LAYOUT;
  const isFlag = category.toLowerCase() === "flag"; // the game letterboxes flags

  // EXACT BY DEFAULT. The sharp renderer gets the block grid right but the block
  // COLOURS wrong (~5% mean, 91/255 worst) because Chrome's canvas downscaler uses
  // a different filter. Side by side that is not subtle — the sharp version loses
  // the blue and near-black blocks entirely and reads far warmer than the real
  // game. --fast opts out when Chrome isn't available and you don't mind.
  let stageBufs;
  const wantFast = process.argv.includes("--fast");
  if (wantFast) {
    stageBufs = await Promise.all(RES_STEPS.map((r) => stageImage(src, r, imageSize)));
    console.log("pixelation: fast (sharp) — approximate colours, NOT identical to the game");
  } else {
    try {
      stageBufs = await exactStageImages(src, imageSize, isFlag);
      console.log("pixelation: exact — rendered through the game's own canvas");
    } catch (e) {
      console.log(`pixelation: falling back to fast (${e.message.split("\n")[0]})`);
      stageBufs = await Promise.all(RES_STEPS.map((r) => stageImage(src, r, imageSize)));
    }
  }

  const frames = [];
  for (let i = 0; i < stageBufs.length; i++) {
    const f = path.join(TMP, `stage-${i}.png`);
    await frame(stageBufs[i], f, { stage: i }); // bars fill as it sharpens
    frames.push(f);
  }
  const revealFile = path.join(TMP, "reveal.png");
  await frame(await sharpImage(src, imageSize), revealFile, { done: true }); // all bars green
  const endFile = path.join(TMP, "end.png");
  await endCardFrame(endFile);

  // ── beats: [file, seconds, overlay filters] ──
  const { hook, stages, pause, reveal, endCard } = BEATS;
  const { titleY: TITLE_Y, categoryY: SUB_Y, counterY: COUNTER_Y } = LAYOUT;
  const footer = footerText(); // on every puzzle beat, not just the end card
  const counter = (n) => drawtext({ text: COPY.guessLabel(n, RES_STEPS.length), font: FONT.mono, size: 38, colour: COLOUR.textDim, y: String(COUNTER_Y) });
  const title = (text, size = 78, colour = COLOUR.text, scrim = false) =>
    drawtext({ text, font: FONT.display, size, colour, y: String(TITLE_Y), scrim });

  // flash: only where the picture actually SHARPENS. The pause beat holds the same
  // image as stage 5, so a flash there would announce a change that never happened.
  const beats = [
    { file: frames[0], dur: hook, flash: BEATS.flash, texts: [
      title(COPY.hook),
      ...(category ? [drawtext({ text: `${COPY.categoryPrefix}: ${category.toUpperCase()}`, font: FONT.mono, size: 34, colour: COLOUR.blue, y: String(SUB_Y) })] : []),
      counter(1), ...footer,
    ] },
    // Holds tighten as it sharpens — the clip gathers pace instead of ticking.
    ...frames.slice(1).map((f, i) => ({
      file: f, dur: stages[i] ?? stages[stages.length - 1], flash: BEATS.flash,
      texts: [title(COPY.hook), counter(i + 2), ...footer],
    })),
    // held on the final pixelated stage — the last chance to guess. No flash.
    { file: frames[frames.length - 1], dur: pause, flash: 0, texts: [
      title(COPY.pause, 66, COLOUR.blue, true),
      counter(RES_STEPS.length), ...footer,
    ] },
    // the payoff. Sharp image, NO answer text. Biggest flash.
    { file: revealFile, dur: reveal, flash: BEATS.revealFlash, texts: [
      title("Did you get it?", 72),
      drawtext({ text: COPY.revealKicker, font: FONT.mono, size: 38, colour: COLOUR.green, y: String(SUB_Y) }),
      ...footer,
    ] },
    { file: endFile, dur: endCard, flash: BEATS.flash, texts: endCardText() },
  ];

  // ── assemble ──
  const inputs = [];
  const filters = [];
  beats.forEach((b, i) => {
    inputs.push("-loop", "1", "-t", String(b.dur), "-framerate", String(VIDEO.fps), "-i", path.relative(HERE, b.file).replace(/\\/g, "/"));
    // Sharpen flash: fade IN from the brand cream, so the beat opens on a blink and
    // resolves to the picture — the same cue the game gives when the image sharpens.
    // A cross-dissolve would blend the pixel blocks together; a flash never touches
    // them. ffmpeg wants 0xRRGGBB here, not #rrggbb.
    const flash = b.flash
      ? [`fade=t=in:st=0:d=${b.flash}:color=0x${COLOUR.bg.replace("#", "").toUpperCase()}`]
      : [];
    // Build the chain from a list — an empty texts array would otherwise leave a
    // leading comma and break the filter.
    const chain = [...b.texts, ...flash, "format=yuv420p", "setsar=1"].join(",");
    filters.push(`[${i}:v]${chain}[v${i}]`);
  });
  const concat = beats.map((_, i) => `[v${i}]`).join("") + `concat=n=${beats.length}:v=1:a=0[out]`;

  const outFile = path.join(OUT, `${date}-${slug(answer)}.mp4`);
  const args = [
    "-y", ...inputs,
    "-filter_complex", `${filters.join(";")};${concat}`,
    "-map", "[out]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20",
    "-pix_fmt", "yuv420p", "-r", String(VIDEO.fps),
    "-movflags", "+faststart", // and the FIRST frame is the blockiest stage, so the
                               // platform's default cover cannot spoil the answer
    path.relative(HERE, outFile).replace(/\\/g, "/"),
  ];
  execFileSync(ffmpeg, args, { cwd: HERE, stdio: ["ignore", "ignore", "pipe"] });

  // ── caption ──
  const total = beats.reduce((s, b) => s + b.dur, 0);
  const captionFile = outFile.replace(/\.mp4$/, ".txt");
  // Answers are stored lowercase for guess-matching; capitalise for the caption.
  const pretty = answer.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  const caption = [
    `${COPY.hook} Yesterday's Picxle was: ${pretty}.`,
    ``,
    `Did you get it? Play today's puzzle at ${COPY.ctaUrl}`,
    ``,
    category ? `Category: ${category}` : ``,
    credit ? `Image: ${credit}` : ``,
    ``,
    `#picxle #dailypuzzle #guessthepicture #${slug(category || "puzzle").replace(/-/g, "")} #puzzlegame`,
  ].filter((l) => l !== null).join("\n");
  fs.writeFileSync(captionFile, caption);

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`video   ${outFile}`);
  console.log(`caption ${captionFile}`);
  console.log(`length  ${total.toFixed(1)}s  ${VIDEO.width}x${VIDEO.height}  silent`);
  if (!credit) console.log(`\nnote: no --credit given. CC-BY images MUST be attributed when you post them.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
