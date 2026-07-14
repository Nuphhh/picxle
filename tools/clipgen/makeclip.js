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
import { VIDEO, COLOUR, FONT, COPY, BEATS, LAYOUT } from "./config.js";
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

async function frame(imageBuf, file) {
  const { width, height } = VIDEO;
  const { imageSize, imageTop, cornerRadius } = LAYOUT;
  const panel = await sharp(imageBuf)
    .composite([{ input: roundedMask(imageSize, cornerRadius), blend: "dest-in" }])
    .png()
    .toBuffer();

  await sharp({ create: { width, height, channels: 4, background: COLOUR.bg } })
    .composite([{ input: panel, left: Math.round((width - imageSize) / 2), top: imageTop }])
    .png()
    .toFile(file);
}

async function endCardFrame(file) {
  const { width, height } = VIDEO;
  // Wordmark drawn as SVG so the X can carry the brand blue, exactly as on the site.
  const svg = `<svg width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="${COLOUR.bg}"/>
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

async function main() {
  const image = arg("image");
  const answer = arg("answer");
  const category = arg("category", "");
  const credit = arg("credit", ""); // CC-BY images MUST be attributed when posted
  const date = arg("date", new Date().toISOString().slice(0, 10));
  if (!image || !answer) {
    console.error("usage: node makeclip.js --image <path|url> --answer \"The Colosseum\" [--category Landmarks] [--credit \"...\"] [--date YYYY-MM-DD]");
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
    await frame(stageBufs[i], f);
    frames.push(f);
  }
  const revealFile = path.join(TMP, "reveal.png");
  await frame(await sharpImage(src, imageSize), revealFile);
  const endFile = path.join(TMP, "end.png");
  await endCardFrame(endFile);

  // ── beats: [file, seconds, overlay filters] ──
  const { hook, stage, pause, reveal, endCard } = BEATS;
  const TITLE_Y = 250, SUB_Y = 360, COUNTER_Y = 1520;
  const beats = [
    { file: frames[0], dur: hook, texts: [
      drawtext({ text: COPY.hook, font: FONT.display, size: 78, colour: COLOUR.text, y: TITLE_Y }),
      ...(category ? [drawtext({ text: `${COPY.categoryPrefix}: ${category.toUpperCase()}`, font: FONT.mono, size: 34, colour: COLOUR.blue, y: SUB_Y })] : []),
      drawtext({ text: COPY.guessLabel(1, RES_STEPS.length), font: FONT.mono, size: 38, colour: COLOUR.textDim, y: COUNTER_Y }),
    ] },
    ...frames.slice(1).map((f, i) => ({
      file: f, dur: stage, texts: [
        drawtext({ text: COPY.hook, font: FONT.display, size: 78, colour: COLOUR.text, y: TITLE_Y }),
        drawtext({ text: COPY.guessLabel(i + 2, RES_STEPS.length), font: FONT.mono, size: 38, colour: COLOUR.textDim, y: COUNTER_Y }),
      ],
    })),
    // held on the final pixelated stage — the last chance to guess
    { file: frames[frames.length - 1], dur: pause, texts: [
      drawtext({ text: COPY.pause, font: FONT.display, size: 66, colour: COLOUR.blue, y: TITLE_Y, scrim: true }),
      drawtext({ text: COPY.guessLabel(RES_STEPS.length, RES_STEPS.length), font: FONT.mono, size: 38, colour: COLOUR.textDim, y: COUNTER_Y }),
    ] },
    // the payoff. Sharp image, NO answer text.
    { file: revealFile, dur: reveal, texts: [
      drawtext({ text: COPY.revealKicker, font: FONT.mono, size: 38, colour: COLOUR.green, y: SUB_Y }),
      drawtext({ text: "Did you get it?", font: FONT.display, size: 72, colour: COLOUR.text, y: TITLE_Y }),
    ] },
    { file: endFile, dur: endCard, texts: [
      drawtext({ text: "PICXLE", font: FONT.display, size: 132, colour: COLOUR.text, y: 760 }),
      drawtext({ text: COPY.ctaTitle, font: FONT.display, size: 62, colour: COLOUR.text, y: 960 }),
      drawtext({ text: COPY.ctaUrl, font: FONT.mono, size: 44, colour: COLOUR.blue, y: 1060 }),
    ] },
  ];

  // ── assemble ──
  const inputs = [];
  const filters = [];
  beats.forEach((b, i) => {
    inputs.push("-loop", "1", "-t", String(b.dur), "-framerate", String(VIDEO.fps), "-i", path.relative(HERE, b.file).replace(/\\/g, "/"));
    filters.push(`[${i}:v]${b.texts.join(",")},format=yuv420p,setsar=1[v${i}]`);
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
  const caption = [
    `${COPY.hook} Yesterday's Picxle was: ${answer}.`,
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
