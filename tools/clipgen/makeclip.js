#!/usr/bin/env node
// Picxle reveal-clip generator.
//
//   node makeclip.js                          # yesterday's puzzle -> vertical mp4 (silent, no reveal)
//   node makeclip.js --puzzle 2026-07-27      # a specific day
//   node makeclip.js --music track.mp3 ...    # bake normalised audio instead of silent
//   node makeclip.js --reveal                 # full pause + reveal + end card
//   node makeclip.js --variant native         # no baked text at all (add text/sound in TikTok)
//   node makeclip.js --promo --gif            # evergreen advert + a square GIF
//
// TikTok DEFAULT: frame 0 already shows the puzzle (no intro), silent, and it stops
// on the last pixelated stage with "Answer in the comments" — no full reveal, no
// logo card. That protects watch-time (the thing TikTok promotes on) and pushes
// people to comment their guess. The answer is never on the video; put it in a
// pinned comment.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import opentype from "opentype.js";
import {
  VIDEO, GIF, COLOUR, FONT, COPY as BASE_COPY, PROMO,
  BEATS, GIF_BEATS, LAYOUT, GIF_LAYOUT, BARS, MUSIC, ENCODE, LOUDNORM,
} from "./config.js";
import { exactStages } from "./exact.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TMP = path.join(HERE, "tmp");
const OUT = path.join(HERE, "out");
const rel = (f) => path.relative(HERE, f).replace(/\\/g, "/");
const ff = (args) => { const r = spawnSync(ffmpeg, args, { cwd: HERE }); return (r.stderr?.toString() || "") + (r.stdout?.toString() || ""); };

const PROMO_MODE = process.argv.includes("--promo");
const COPY = PROMO_MODE ? { ...BASE_COPY, ...PROMO } : BASE_COPY;

// ── the game's pixelation ────────────────────────────────────────────────────
const RES_STEPS = [8, 12, 19, 29, 45];
const MASTER = 440;

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
      .resize(size, size, { kernel: "nearest" }).png().toBuffer()));
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
const loadFont = (r) => opentype.parse(fs.readFileSync(path.join(HERE, r)).buffer);

// ── frame composition ───────────────────────────────────────────────────────
const roundedMask = (size, r) =>
  Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);

function sharpnessBars(V, L, filledUpTo, done) {
  const { width: bw, gap, heights } = BARS;
  const total = heights.length * bw + (heights.length - 1) * gap;
  let x = (V.width - total) / 2;
  return heights.map((h, i) => {
    const on = done || i <= filledUpTo;
    const fill = done ? COLOUR.green : on ? COLOUR.blue : COLOUR.line;
    const rct = `<rect x="${Math.round(x)}" y="${L.barsBaseline - h}" width="${bw}" height="${h}" rx="4" fill="${fill}"/>`;
    x += bw + gap;
    return rct;
  }).join("");
}

async function frame(V, L, imageBuf, file, { stage = null, done = false, cta = false } = {}) {
  const panel = await sharp(imageBuf)
    .composite([{ input: roundedMask(L.imageSize, L.cornerRadius), blend: "dest-in" }])
    .png().toBuffer();
  // The 👇 the comment CTA wants has no glyph in the brand fonts, so draw a vector
  // chevron instead. It sits in the top margin above the image, just under the text.
  const cx = V.width / 2, cy = L.categoryY + 4;
  const chevron = cta
    ? `<path d="M ${cx - 30} ${cy} L ${cx} ${cy + 26} L ${cx + 30} ${cy}" fill="none" stroke="${COLOUR.blue}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`
    : "";
  const overlay = Buffer.from(
    `<svg width="${V.width}" height="${V.height}" xmlns="http://www.w3.org/2000/svg">${sharpnessBars(V, L, stage ?? -1, done)}${chevron}</svg>`
  );
  await sharp({ create: { width: V.width, height: V.height, channels: 4, background: COLOUR.bg } })
    .composite([
      { input: panel, left: Math.round((V.width - L.imageSize) / 2), top: L.imageTop },
      { input: overlay, left: 0, top: 0 },
    ])
    .png().toFile(file);
}

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

// End card — wordmark as three positioned drawtext calls (opentype for metrics only;
// SVG glyph paths mangle under librsvg). --reveal / GIF only.
function endCardGeometry(V) { return { markSize: V.height > 1500 ? 150 : 118, markY: Math.round(V.height * 0.46) }; }
function endCardText(V) {
  const { markSize, markY } = endCardGeometry(V);
  const d = loadFont(FONT.display);
  const wPic = d.getAdvanceWidth("PIC", markSize), wX = d.getAdvanceWidth("X", markSize), wLe = d.getAdvanceWidth("LE", markSize);
  const x0 = (V.width - (wPic + wX + wLe)) / 2;
  const top = Math.round(markY - markSize * 0.78);
  const seg = (t, x, c) => drawtext({ text: t, font: FONT.display, size: markSize, colour: c, y: String(top), x: String(Math.round(x)) });
  return [
    seg("PIC", x0, COLOUR.text), seg("X", x0 + wPic, COLOUR.blue), seg("LE", x0 + wPic + wX, COLOUR.text),
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

// ── beats ─────────────────────────────────────────────────────────────────────
function buildBeats({ frames, revealFile, endFile, ctaFile, B, L, V, category, mode }) {
  const { reveal, native, gif } = mode;
  const big = V.height > 1500;
  const footer = native ? [] : footerText(V, L);
  const title = (text, size, colour = COLOUR.text, scrim = false) =>
    native ? null : drawtext({ text, font: FONT.display, size: big ? size : Math.round(size * 0.72), colour, y: String(L.titleY), scrim });
  const counter = (n) => native ? null : drawtext({ text: COPY.guessLabel(n, RES_STEPS.length), font: FONT.mono, size: big ? 38 : 30, colour: COLOUR.textDim, y: String(L.counterY) });
  const catLabel = native || !category ? null
    : drawtext({ text: `${COPY.categoryPrefix}: ${category.toUpperCase()}`, font: FONT.mono, size: big ? 34 : 26, colour: COLOUR.blue, y: String(L.categoryY) });
  const kicker = (text, colour) => native ? null : drawtext({ text, font: FONT.mono, size: big ? 38 : 28, colour, y: String(L.categoryY) });
  const T = (...items) => items.filter(Boolean).concat(footer);

  // HOOK: flash 0 so frame 0 already contains the puzzle + prompt + category. A
  // fade here is what makes TikTok see a blank opening and drop the video.
  const hook = { file: frames[0], dur: B.hook, flash: 0, texts: T(title(COPY.hook, 78), catLabel, counter(1)) };
  const stageBeats = (n) => frames.slice(1, 1 + n).map((f, i) => ({
    file: f, dur: B.stages[i] ?? B.stages.at(-1), flash: B.flash, texts: T(title(COPY.hook, 78), counter(i + 2)),
  }));

  if (gif) {
    return [
      hook, ...stageBeats(4),
      { file: revealFile, dur: B.reveal, flash: B.revealFlash, texts: T(title("Did you get it?", 72), kicker(COPY.revealKicker, COLOUR.green)) },
      { file: endFile, dur: B.endCard, flash: B.flash, texts: native ? [] : endCardText(V) },
    ];
  }
  if (reveal) {
    return [
      hook, ...stageBeats(4),
      { file: frames.at(-1), dur: B.pause, flash: 0, texts: T(title(COPY.pause, 66, COLOUR.blue, true), counter(RES_STEPS.length)) },
      { file: revealFile, dur: B.reveal, flash: B.revealFlash, texts: T(title("Did you get it?", 72), kicker(COPY.revealKicker, COLOUR.green)) },
      { file: endFile, dur: B.endCard, flash: B.flash, texts: native ? [] : endCardText(V) },
    ];
  }
  // DEFAULT (TikTok): hook + 3 sharpen stages + held final on the last pixelated
  // stage with the comment CTA. No full reveal, no end card.
  return [
    hook, ...stageBeats(3),
    {
      file: native ? frames[4] : ctaFile, dur: B.finalHold, flash: B.flash,
      texts: native ? [] : T(title(COPY.commentCTA, 60)),
    },
  ];
}

// ── render one variant ──────────────────────────────────────────────────────
async function renderVariant({ V, L, B, stageBufs, revealBuf, outFile, category, tag, music = null, mode }) {
  const dir = path.join(TMP, tag);
  fs.mkdirSync(dir, { recursive: true });

  const frames = [];
  for (let i = 0; i < stageBufs.length; i++) {
    const f = path.join(dir, `stage-${i}.png`);
    await frame(V, L, stageBufs[i], f, { stage: i });
    frames.push(f);
  }
  // Only render what this mode needs.
  let revealFile = null, endFile = null, ctaFile = null;
  if (mode.gif || mode.reveal) {
    revealFile = path.join(dir, "reveal.png"); await frame(V, L, revealBuf, revealFile, { done: true });
    endFile = path.join(dir, "end.png"); await endCardFrame(V, endFile);
  }
  if (!mode.gif && !mode.reveal && !mode.native) {
    ctaFile = path.join(dir, "cta.png"); await frame(V, L, stageBufs[4], ctaFile, { stage: 4, cta: true });
  }

  const beats = buildBeats({ frames, revealFile, endFile, ctaFile, B, L, V, category, mode });

  const inputs = [], filters = [];
  beats.forEach((b, i) => {
    inputs.push("-loop", "1", "-t", String(b.dur), "-framerate", String(mode.gif ? GIF.fps : VIDEO.fps), "-i", rel(b.file));
    const flash = b.flash ? [`fade=t=in:st=0:d=${b.flash}:color=0x${COLOUR.bg.replace("#", "").toUpperCase()}`] : [];
    filters.push(`[${i}:v]${[...b.texts, ...flash, "format=yuv420p", "setsar=1"].join(",")}[v${i}]`);
  });
  const concat = beats.map((_, i) => `[v${i}]`).join("") + `concat=n=${beats.length}:v=1:a=0[out]`;
  const total = beats.reduce((s, b) => s + b.dur, 0);

  if (mode.gif) {
    execFileSync(ffmpeg, [
      "-y", ...inputs, "-filter_complex",
      `${filters.join(";")};${concat};[out]scale=${GIF.scale}:${GIF.scale}:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3[g]`,
      "-map", "[g]", "-loop", "0", rel(outFile),
    ], { cwd: HERE, stdio: ["ignore", "ignore", "pipe"] });
    return total;
  }

  // Audio: silent unless a track is baked in. Baked audio is loudnorm'd to platform
  // level (mean far below norm was a real reach problem).
  let audioFilter = "", audioMap = [];
  if (music) {
    inputs.push("-stream_loop", "-1", "-i", rel(music.path));
    const idx = beats.length, start = music.startAt || 0;
    const fadeAt = Math.max(0, total - MUSIC.fadeOut).toFixed(2);
    audioFilter =
      `;[${idx}:a]atrim=${start.toFixed(2)}:${(start + total).toFixed(2)},asetpts=PTS-STARTPTS,` +
      `afade=t=in:st=0:d=${MUSIC.fadeIn},afade=t=out:st=${fadeAt}:d=${MUSIC.fadeOut},${LOUDNORM}[a]`;
    audioMap = ["-map", "[a]", "-c:a", "aac", "-b:a", "160k", "-shortest"];
  }
  execFileSync(ffmpeg, [
    "-y", ...inputs, "-filter_complex", `${filters.join(";")};${concat}${audioFilter}`,
    "-map", "[out]", ...audioMap,
    "-c:v", "libx264", "-preset", "medium",
    "-b:v", ENCODE.bitrate, "-maxrate", ENCODE.maxrate, "-bufsize", ENCODE.bufsize,
    "-profile:v", ENCODE.profile, "-level", ENCODE.level,
    "-pix_fmt", "yuv420p", "-r", String(VIDEO.fps), "-vsync", "cfr",
    "-movflags", "+faststart", // first frame is the blockiest stage — the default cover can't spoil it
    rel(outFile),
  ], { cwd: HERE, stdio: ["ignore", "ignore", "pipe"] });
  return total;
}

// ── acceptance checks (run on every rendered mp4) ────────────────────────────
async function frameStddev(outFile, seek) {
  const tmp = path.join(TMP, `probe-${Date.now()}.png`);
  ff([...seek, "-i", rel(outFile), "-frames:v", "1", "-y", rel(tmp)]);
  if (!fs.existsSync(tmp)) return 0;
  const st = await sharp(tmp).stats();
  fs.unlinkSync(tmp);
  return st.channels.slice(0, 3).reduce((a, c) => a + c.stdev, 0) / 3;
}
async function verify(outFile, { silent }) {
  const info = ff(["-i", rel(outFile)]);
  const fails = [];

  const res = info.match(/, (\d{3,4})x(\d{3,4})/);
  if (!res || res[1] !== "1080" || res[2] !== "1920") fails.push(`resolution ${res ? res[1] + "x" + res[2] : "?"} (want 1080x1920)`);
  if (!/Video: h264/.test(info)) fails.push("video codec not h264");
  const fps = parseFloat((info.match(/([\d.]+) fps/) || [])[1] || "0");
  if (Math.abs(fps - 30) > 1) fails.push(`fps ${fps} (want ~30)`);
  const dm = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const dur = dm ? +dm[1] * 3600 + +dm[2] * 60 + +dm[3] : 0;
  if (dur < 10 || dur > 20) fails.push(`duration ${dur.toFixed(1)}s (want 10-20s)`);

  const hasAudio = /Audio:/.test(info);
  if (silent && hasAudio) fails.push("audio stream present but --silent");
  if (!silent) {
    if (!hasAudio) fails.push("no audio stream (music expected)");
    else {
      const vol = parseFloat((ff(["-i", rel(outFile), "-af", "volumedetect", "-f", "null", "-"]).match(/mean_volume:\s*(-?[\d.]+) dB/) || [])[1] || "-99");
      if (vol < -18) fails.push(`mean volume ${vol} dB (want >= -18)`);
    }
  }

  const f0 = await frameStddev(outFile, ["-ss", "0"]);
  if (f0 < 18) fails.push(`frame 0 near-blank (stddev ${f0.toFixed(1)}) — intro not killed`);
  const fLast = await frameStddev(outFile, ["-sseof", "-0.3"]);
  if (fLast < 18) fails.push(`final frame near-blank (stddev ${fLast.toFixed(1)}) — expected the held CTA frame`);

  if (fails.length) throw new Error(`acceptance checks FAILED for ${path.basename(outFile)}:\n  - ${fails.join("\n  - ")}`);
  console.log(`  checks ok: 1080x1920 h264 ${fps}fps ${dur.toFixed(1)}s ${silent ? "silent" : "audio"} frame0=${f0.toFixed(0)} last=${fLast.toFixed(0)}`);
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
async function fetchPuzzle(date) {
  const envPath = path.join(HERE, "..", "..", ".env.local");
  if (!fs.existsSync(envPath)) throw new Error("no .env.local — pass --image/--answer by hand");
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
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
  const wantGif = process.argv.includes("--gif");
  const wantFast = process.argv.includes("--fast");
  const wantReveal = process.argv.includes("--reveal");
  const forceSilent = process.argv.includes("--silent");
  const variant = (arg("variant", "standard") || "standard").toLowerCase();
  if (!["standard", "native"].includes(variant)) { console.error(`--variant must be standard|native`); process.exit(1); }

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
    console.error(`usage: node makeclip.js [--puzzle YYYY-MM-DD] [--reveal] [--silent] [--variant native] [--music f.mp3] [--promo] [--gif] [--fast]`);
    process.exit(1);
  }

  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  let src = await loadImage(image);
  const isFlag = category.toLowerCase() === "flag";
  const meta = await sharp(src, { limitInputPixels: false }).metadata();
  if (Math.max(meta.width || 0, meta.height || 0) > 2400) {
    src = await sharp(src, { limitInputPixels: false })
      .resize(2400, 2400, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
    console.log(`  capped source: ${meta.width}x${meta.height} -> fits 2400px`);
  }

  const renderSize = Math.max(LAYOUT.imageSize, GIF_LAYOUT.imageSize);
  let stages;
  if (wantFast) {
    stages = await Promise.all(RES_STEPS.map((r) => stageImage(src, r, renderSize)));
    console.log("pixelation: fast (sharp) — NOT identical to the game");
  } else {
    try { stages = await exactStageImages(src, renderSize, isFlag); console.log("pixelation: exact"); }
    catch (e) { console.log(`pixelation: fast fallback (${e.message.split("\n")[0]})`); stages = await Promise.all(RES_STEPS.map((r) => stageImage(src, r, renderSize))); }
  }
  const revealFull = await sharpImage(src, renderSize);
  const fit = (buf, size) => sharp(buf).resize(size, size, { kernel: "nearest" }).png().toBuffer();

  // --music: silent by default; --silent always wins.
  let music = arg("music");
  if (music && !forceSilent) {
    const found = [music, path.join(HERE, "music", music), path.join(HERE, music)].find((c) => fs.existsSync(c));
    if (!found) { console.error(`no such music file: ${music} (see music/README.md)`); process.exit(1); }
    music = { path: found, startAt: parseFloat(arg("music-start", "0")) || 0 };
  } else music = null;

  const native = variant === "native";
  const mode = { reveal: wantReveal, native, gif: false };
  const base = `${date}-${slug(answer)}${PROMO_MODE ? "-promo" : ""}-${variant}`;
  const outFile = path.join(OUT, `${base}.mp4`);
  const vStages = await Promise.all(stages.map((b) => fit(b, LAYOUT.imageSize)));
  const total = await renderVariant({
    V: VIDEO, L: LAYOUT, B: BEATS, tag: "v", category, outFile, music, mode,
    stageBufs: vStages, revealBuf: await fit(revealFull, LAYOUT.imageSize),
  });
  console.log(`video   ${outFile}`);
  console.log(`length  ${total.toFixed(1)}s  ${VIDEO.width}x${VIDEO.height}  ${variant}  ${wantReveal ? "reveal" : "no-reveal"}  ${music ? `music: ${path.basename(music.path)}` : "silent"}`);
  await verify(outFile, { silent: !music });

  if (wantGif) {
    const gifFile = path.join(OUT, `${base.replace(`-${variant}`, "")}.gif`);
    const gt = await renderVariant({
      V: GIF, L: GIF_LAYOUT, B: GIF_BEATS, tag: "g", category, outFile: gifFile,
      mode: { reveal: true, native, gif: true },
      stageBufs: await Promise.all(stages.map((b) => fit(b, GIF_LAYOUT.imageSize))),
      revealBuf: await fit(revealFull, GIF_LAYOUT.imageSize),
    });
    console.log(`gif     ${gifFile}  (${gt.toFixed(1)}s, ${GIF.scale}x${GIF.scale}, ${(fs.statSync(gifFile).size / 1048576).toFixed(1)}MB)`);
  }

  // ── caption (answer never named — goes in a pinned comment) ──
  const pretty = answer.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  const daily = [
    `Did you get it before the last guess? Name it in the comments 👇`, ``,
    `A new Picxle every day — play today's at ${COPY.ctaUrl}`, ``,
    category ? `Category: ${category}` : ``,
  ];
  const musicCredit = arg("music-credit", "");
  const caption = [
    ...(PROMO_MODE ? PROMO.caption(pretty, category) : daily),
    credit ? `Image: ${credit}` : ``,
    musicCredit ? `Music: ${musicCredit}` : ``,
    ``,
    PROMO_MODE ? `#picxle #puzzlegame #dailypuzzle #guessthepicture #brainteaser`
      : `#picxle #dailypuzzle #guessthepicture #${slug(category || "puzzle").replace(/-/g, "")} #puzzlegame`,
  ].filter((l) => l !== null).join("\n");
  fs.writeFileSync(path.join(OUT, `${base}.txt`), caption);
  console.log(`caption ${path.join(OUT, `${base}.txt`)}`);

  fs.rmSync(TMP, { recursive: true, force: true });
  if (!credit && !PROMO_MODE) console.log(`\nnote: no image credit (CC0/PD ok; CC-BY MUST be credited).`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
