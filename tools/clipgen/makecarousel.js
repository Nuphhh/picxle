#!/usr/bin/env node
// makecarousel.js — a "can you name all 5?" carousel for Instagram + Facebook,
// built from the best-looking puzzles in a batch of already-published clips.
//
// WHY THIS EXISTS
// The daily reel is one format posted forever, and that caps the account. Reels chase
// NEW viewers; carousels are what earn profile visits and saves from people who already
// follow, and they are measured on swipe-through rather than watch time. This builds
// that second format entirely out of assets that already exist.
//
// HOW IT PICKS
// The same reveal metric as scripts/rank-reveals.mjs — delta (how much the picture
// changes), detail (structure that emerges), mystery (how little the blocky tile gives
// away) — recomputed over just this batch. It has to be recomputed rather than read
// from reveal-ranking.json: that file only covers puzzles that had a teaser when it ran,
// which is 4 of the 19 clips we have posted.
//
// SPOILER GUARD (the important bit)
// A carousel showing a puzzle nobody has played yet ruins that day's game. Only puzzles
// whose answer is already public are eligible, so puzzle_date must be at least TWO days
// before the post date: the daily reel published on day D reveals day D-1, so D-1 is
// still being posted that morning and only D-2 and earlier are safely spent.
//
// WHY THE ANSWERS ARE ON THE LAST SLIDE, NOT BESIDE EACH PICTURE
// Instagram ranks a carousel on how far people swipe. Holding all five answers back to
// slide 7 is what makes the last slide the destination; revealing each one in place
// gives people permission to leave at slide 3.
//
// USAGE
//   node makecarousel.js                       # dry run: pick, render, print the plan
//   node makecarousel.js --commit              # upload + schedule to Instagram + Facebook
//   node makecarousel.js --post-date 2026-08-01 --time 16:30
//   node makecarousel.js --from 2026-07-13 --to 2026-07-30 --count 5
//
// Needs in ../../.env.local: BUFFER_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Needs Chrome (the blocky tiles are rendered through the game's own canvas — see exact.js)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import opentype from "opentype.js";
import { COLOUR, FONT, COPY } from "./config.js";
import { exactStages } from "./exact.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");
const TMP = path.join(HERE, "tmp-carousel");
const LEDGER = path.join(OUT, ".buffer-queued.json");
const BUFFER_API = "https://api.buffer.com";

// ── knobs ────────────────────────────────────────────────────────────────────
// 4:5 — the tallest ratio Instagram allows in feed, so the post occupies the most
// screen it legally can. A square carousel gives away a quarter of that for nothing.
const W = 1080, H = 1350;

// Instagram has no distinct "carousel" post type: a carousel IS a post with more than
// one image asset, and Buffer's InstagramPostMetadataInput only accepts post/story/reel.
// (Buffer's PostType enum does contain `carousel`, but that is for the networks which
// treat it as its own format.) If Instagram ever rejects `post` here, this is the line.
const IG_TYPE = "post";
const FB_TYPE = "post";

// Stage 2 of 5 (12x12), not the 8x8 the reel opens on. A reel EARNS its 8x8 because the
// picture sharpens a second later; a still slide never does, so an 8x8 is just a
// coloured grid and people swipe past rather than guess. 12x12 is still unmistakably
// Picxle and still hard, but it is a puzzle rather than a wall.
const RES_STEPS = [8, 12, 19, 29, 45];
const SLIDE_RES_INDEX = 1;
const SCORE_RES_INDEX = 0;   // mystery is defined on the 8x8, as in rank-reveals.mjs

const BUCKET = "clips";               // already public — same bucket the reels use
const POST_TZ = "Europe/London";
const POST_TIME_DEFAULT = "16:30";    // see pickPostTime() for why not 11:00
const SPOILER_GAP_DAYS = 2;           // puzzle_date must be <= postDate - 2

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (f, d = null) => { const i = argv.indexOf(f); return i > -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const COMMIT = has("--commit");
const FORCE = has("--force");
const COUNT = Number(opt("--count", "5"));
const TIME = opt("--time", POST_TIME_DEFAULT);

const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const todayISO = () => new Date().toISOString().slice(0, 10);
// Next Saturday, never today — a same-day schedule races the clock in the account tz.
const nextSaturday = () => { let d = addDays(todayISO(), 1); while (new Date(`${d}T12:00:00Z`).getUTCDay() !== 6) d = addDays(d, 1); return d; };

const POST_DATE = opt("--post-date", nextSaturday());
const CUTOFF = addDays(POST_DATE, -SPOILER_GAP_DAYS);
const FROM = opt("--from", "2026-07-13");
const TO = opt("--to", CUTOFF);

// ── env ──────────────────────────────────────────────────────────────────────
function loadEnv() {
  const p = path.join(HERE, "..", "..", ".env.local");
  if (!fs.existsSync(p)) throw new Error("no .env.local at picxle-app/");
  const env = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])
    if (!env[k]) throw new Error(`missing ${k} in .env.local`);
  if (COMMIT && !env.BUFFER_ACCESS_TOKEN) throw new Error("missing BUFFER_ACCESS_TOKEN in .env.local");
  return env;
}
const ENV = loadEnv();
const SB = { apikey: ENV.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}` };

// ── helpers lifted from the clip pipeline so the two stay visually identical ──
const esc = (s) => String(s).replace(/'/g, "’").replace(/([:\\%])/g, "\\$1");
const pretty = (s) => String(s).replace(/\b[a-z]/g, (c) => c.toUpperCase());
const gqlEsc = (s) => JSON.stringify(String(s));
const rel = (f) => path.relative(HERE, f).replace(/\\/g, "/");
const loadFont = (r) => opentype.parse(fs.readFileSync(path.join(HERE, r)).buffer);
const roundedMask = (w, h, r) =>
  Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);

function drawtext({ text, font, size, colour, y, x = "(w-text_w)/2" }) {
  return `drawtext=text='${esc(text)}':fontfile=${font}:fontsize=${size}:fontcolor=${colour}:x=${x}:y=${y}`;
}

// ffmpeg does the text, sharp does the pictures. The clip generator settled on this
// split because librsvg mangles opentype glyph paths; opentype.js is used for METRICS
// only (to place the three-colour wordmark), never to draw.
function burnText(baseFile, outFile, filters) {
  if (!filters.length) { fs.copyFileSync(baseFile, outFile); return; }
  const r = spawnSync(ffmpeg, ["-y", "-i", rel(baseFile), "-vf", filters.join(","), "-frames:v", "1", rel(outFile)], { cwd: HERE });
  if (!fs.existsSync(outFile)) throw new Error(`ffmpeg drawtext failed:\n${r.stderr?.toString().slice(-600)}`);
}

// The PICXLE wordmark: three separately positioned draws so the X can be blue. Widths
// come from the real font metrics, otherwise the segments overlap at large sizes.
function wordmark({ size, y, colour = COLOUR.textDim, accent = COLOUR.blue, font = FONT.mono, tail = "" }) {
  const f = loadFont(font);
  const wPic = f.getAdvanceWidth("PIC", size), wX = f.getAdvanceWidth("X", size), wLe = f.getAdvanceWidth("LE", size);
  const wTail = tail ? f.getAdvanceWidth(tail, size) : 0;
  const x0 = (W - (wPic + wX + wLe + wTail)) / 2;
  const seg = (t, x, c) => drawtext({ text: t, font, size, colour: c, y: String(y), x: String(Math.round(x)) });
  return [
    seg("PIC", x0, colour), seg("X", x0 + wPic, accent), seg("LE", x0 + wPic + wX, colour),
    ...(tail ? [seg(tail, x0 + wPic + wX + wLe, colour)] : []),
  ];
}

// ── data ─────────────────────────────────────────────────────────────────────
async function fetchPuzzles(from, to) {
  const url = `${ENV.SUPABASE_URL}/rest/v1/puzzles?select=puzzle_date,answer,category,image_src,license,attribution`
    + `&puzzle_date=gte.${from}&puzzle_date=lte.${to}&order=puzzle_date`;
  const rows = await fetch(url, { headers: SB }).then((r) => r.json());
  if (!Array.isArray(rows) || !rows.length) throw new Error(`no puzzles between ${from} and ${to}`);
  return rows;
}

// Wikimedia enforces its User-Agent policy and will 429 a generic agent fetching 18
// originals back to back. Two things are non-negotiable here: a UA that names the tool
// and a contact address (same one scripts/rank-reveals.mjs uses), and a gap between
// requests. Getting 429ed is not a cosmetic failure — the score is normalised across
// whatever set survives, so a partial fetch silently changes which puzzles get picked.
const UA = "PicxleBot/1.0 (carousel builder; picxlebypenrose@gmail.com)";
const CACHE = path.join(OUT, ".imgcache");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadImage(src) {
  fs.mkdirSync(CACHE, { recursive: true });
  const key = path.join(CACHE, Buffer.from(src).toString("base64url").slice(-90));
  if (fs.existsSync(key)) return fs.readFileSync(key);

  let wait = 800;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(src, { headers: { "User-Agent": UA } });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(key, buf);
      await sleep(250);                       // be a good citizen between originals
      return buf;
    }
    if (res.status !== 429 && res.status !== 503) throw new Error(`image HTTP ${res.status}`);
    const retryAfter = Number(res.headers.get("retry-after")) * 1000;
    await sleep(retryAfter > 0 ? retryAfter : wait);
    wait *= 2;
  }
  throw new Error("image HTTP 429 after 5 attempts");
}

// ── scoring (same three measures and weights as scripts/rank-reveals.mjs) ─────
const N = 200;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };

async function measure(srcBuf, blockRgb, res) {
  const blocky = await sharp(blockRgb, { raw: { width: res, height: res, channels: 3 } })
    .resize(N, N, { kernel: "nearest" }).removeAlpha().raw().toBuffer();
  const full = await sharp(srcBuf, { limitInputPixels: false })
    .resize(N, N, { fit: "cover", position: "centre" }).removeAlpha().raw().toBuffer();

  let d = 0;
  for (let i = 0; i < N * N * 3; i++) d += Math.abs(blocky[i] - full[i]);
  const delta = d / (N * N * 3);

  const grey = await sharp(srcBuf, { limitInputPixels: false })
    .resize(N, N, { fit: "cover", position: "centre" }).greyscale().raw().toBuffer();
  let edges = 0;
  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      const gx = -grey[i - N - 1] - 2 * grey[i - 1] - grey[i + N - 1] + grey[i - N + 1] + 2 * grey[i + 1] + grey[i + N + 1];
      const gy = -grey[i - N - 1] - 2 * grey[i - N] - grey[i - N + 1] + grey[i + N - 1] + 2 * grey[i + N] + grey[i + N + 1];
      edges += Math.hypot(gx, gy);
    }
  }
  const detail = edges / ((N - 2) * (N - 2));

  const lums = [];
  const n = res * res;
  for (let i = 0; i < n; i++) lums.push(0.2126 * blockRgb[i * 3] + 0.7152 * blockRgb[i * 3 + 1] + 0.0722 * blockRgb[i * 3 + 2]);
  return { delta, detail, mystery: std(lums) };
}

// ── slides ───────────────────────────────────────────────────────────────────
async function coverSlide(picks, file) {
  // A 3x2 mosaic, five tiles and a "?", so the cover states the premise — five
  // pictures, one swipe — before a single word is read.
  const M = 90, GAP = 24;
  const cell = Math.round((W - 2 * M - 2 * GAP) / 3);
  const gridTop = 470;
  const cells = [];
  for (let i = 0; i < 6; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const left = M + col * (cell + GAP), top = gridTop + row * (cell + GAP);
    if (i < picks.length) {
      const tile = await sharp(picks[i].slideBuf).resize(cell, cell, { kernel: "nearest" })
        .composite([{ input: roundedMask(cell, cell, 16), blend: "dest-in" }]).png().toBuffer();
      cells.push({ input: tile, left, top });
    } else {
      const q = Buffer.from(`<svg width="${cell}" height="${cell}"><rect width="${cell}" height="${cell}" rx="16" fill="${COLOUR.panel}"/>`
        + `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${Math.round(cell * 0.5)}"`
        + ` font-family="monospace" font-weight="bold" fill="${COLOUR.line}">?</text></svg>`);
      cells.push({ input: await sharp(q).png().toBuffer(), left, top });
    }
  }
  const base = path.join(TMP, "cover-base.png");
  await sharp({ create: { width: W, height: H, channels: 4, background: COLOUR.bg } })
    .composite(cells).png().toFile(base);

  burnText(base, file, [
    drawtext({ text: "CAN YOU NAME", font: FONT.display, size: 96, colour: COLOUR.text, y: "170" }),
    drawtext({ text: "ALL 5?", font: FONT.display, size: 96, colour: COLOUR.blue, y: "280" }),
    drawtext({ text: "SWIPE — ANSWERS ON THE LAST SLIDE", font: FONT.mono, size: 30, colour: COLOUR.textDim, y: "400" }),
    ...wordmark({ size: 30, y: H - 90 }),
  ]);
}

async function puzzleSlide(p, i, total, file) {
  // The tile has to leave room for TWO lines under it — the prompt and the wordmark —
  // or they stack on top of each other. 300+840 puts the tile's bottom edge at 1140,
  // which leaves 210px of tail for a 32px prompt and a 28px wordmark to breathe.
  const SIZE = 840, TOP = 300;
  const tile = await sharp(p.slideBuf).resize(SIZE, SIZE, { kernel: "nearest" })
    .composite([{ input: roundedMask(SIZE, SIZE, 28), blend: "dest-in" }]).png().toBuffer();
  const base = path.join(TMP, `p${i}-base.png`);
  await sharp({ create: { width: W, height: H, channels: 4, background: COLOUR.bg } })
    .composite([{ input: tile, left: Math.round((W - SIZE) / 2), top: TOP }]).png().toFile(base);

  burnText(base, file, [
    drawtext({ text: `${i} / ${total}`, font: FONT.display, size: 84, colour: COLOUR.text, y: "130" }),
    drawtext({ text: `CATEGORY: ${String(p.category || "?").toUpperCase()}`, font: FONT.mono, size: 34, colour: COLOUR.blue, y: "250" }),
    drawtext({ text: "WHAT IS IT?", font: FONT.mono, size: 32, colour: COLOUR.textDim, y: String(TOP + SIZE + 46) }),
    ...wordmark({ size: 28, y: H - 78 }),
  ]);
}

async function answersSlide(picks, file) {
  // Sharp thumbnails, so the payoff slide is the only place the pictures resolve.
  const THUMB = 128, ROW_H = 168, LEFT = 96, TOP = 300;
  const comps = [];
  for (let i = 0; i < picks.length; i++) {
    const t = await sharp(picks[i].srcBuf, { limitInputPixels: false })
      .resize(THUMB, THUMB, { fit: "cover", position: "centre" })
      .composite([{ input: roundedMask(THUMB, THUMB, 14), blend: "dest-in" }]).png().toBuffer();
    comps.push({ input: t, left: LEFT, top: TOP + i * ROW_H });
  }
  const base = path.join(TMP, "answers-base.png");
  await sharp({ create: { width: W, height: H, channels: 4, background: COLOUR.bg } })
    .composite(comps).png().toFile(base);

  const textX = LEFT + THUMB + 40;
  const rows = picks.flatMap((p, i) => [
    drawtext({ text: `${i + 1}. ${pretty(p.answer)}`, font: FONT.display, size: 52, colour: COLOUR.text, x: String(textX), y: String(TOP + i * ROW_H + 20) }),
    drawtext({ text: String(p.category || "").toUpperCase(), font: FONT.mono, size: 26, colour: COLOUR.textDim, x: String(textX), y: String(TOP + i * ROW_H + 84) }),
  ]);
  burnText(base, file, [
    drawtext({ text: "ANSWERS", font: FONT.display, size: 92, colour: COLOUR.text, y: "130" }),
    drawtext({ text: "HOW MANY DID YOU GET?", font: FONT.mono, size: 30, colour: COLOUR.blue, y: "240" }),
    ...rows,
    drawtext({ text: COPY.ctaTitle, font: FONT.display, size: 46, colour: COLOUR.text, y: String(H - 200) }),
    drawtext({ text: COPY.ctaUrl, font: FONT.mono, size: 34, colour: COLOUR.blue, y: String(H - 140) }),
  ]);
}

// ── caption ──────────────────────────────────────────────────────────────────
// Same priorities as the daily caption: the SEND ask takes line 1 (it is the signal
// that reaches non-followers, and the only line that survives the "... more" fold),
// the comment ask follows. CC-BY is a licence condition, so every credited image is
// listed whether or not anyone reads them.
function buildCaption(picks) {
  const credits = picks.filter((p) => p.attribution && p.license !== "CC0" && p.license !== "PD")
    .map((p) => `${pretty(p.answer)}: ${p.attribution}`);
  return [
    `Five of the toughest Picxles so far. Send this to someone who reckons they'd get all 5 👀`, ``,
    `Score yourself in the comments — answers are on the last slide 👇`, ``,
    `A new Picxle every day — play today's at ${COPY.ctaUrl}`, ``,
    ...(credits.length ? [`Images: ${credits.join(" · ")}`, ``] : []),
    `#picxle #dailypuzzle #guessthepicture #puzzlegame #brainteaser`,
  ].join("\n");
}

// ── scheduling ───────────────────────────────────────────────────────────────
function zonedTimeToUtc(dateStr, hhmm, tz) {
  const [Y, Mo, D] = dateStr.split("-").map(Number);
  const [h, mnt] = hhmm.split(":").map(Number);
  const guess = Date.UTC(Y, Mo - 1, D, h, mnt || 0);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asSeen = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (asSeen - guess)).toISOString();
}

async function gql(query) {
  const res = await fetch(BUFFER_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ENV.BUFFER_ACCESS_TOKEN}` },
    body: JSON.stringify({ query }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Buffer HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  if (json.errors?.length) throw new Error(`Buffer GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
  return json.data;
}

async function upload(localPath, objectName) {
  const up = await fetch(`${ENV.SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectName}`, {
    method: "POST",
    headers: { ...SB, "Content-Type": "image/png", "x-upsert": "true" },
    body: fs.readFileSync(localPath),
  });
  if (!up.ok) throw new Error(`upload failed HTTP ${up.status}: ${(await up.text()).slice(0, 200)}`);
  return `${ENV.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectName}`;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(COMMIT ? "MODE: COMMIT (will upload + schedule)\n" : "MODE: dry run (renders slides, schedules nothing)\n");
  fs.mkdirSync(TMP, { recursive: true });

  console.log(`post date  ${POST_DATE} ${TIME} ${POST_TZ}`);
  console.log(`eligible   ${FROM} .. ${TO}   (spoiler cutoff ${CUTOFF} = post date - ${SPOILER_GAP_DAYS}d)\n`);
  if (TO > CUTOFF) throw new Error(`--to ${TO} is past the spoiler cutoff ${CUTOFF}; those puzzles are not public yet`);

  const rows = await fetchPuzzles(FROM, TO);
  console.log(`scoring ${rows.length} puzzles through the game's canvas...`);

  const scored = [];
  const skipped = [];
  for (const p of rows) {
    try {
      const srcBuf = await loadImage(p.image_src);
      const stages = await exactStages(srcBuf, RES_STEPS, { isFlag: String(p.category).toLowerCase() === "flag" });
      const scoreStage = stages[SCORE_RES_INDEX], slideStage = stages[SLIDE_RES_INDEX];
      const m = await measure(srcBuf, scoreStage.rgb, scoreStage.res);
      const slideBuf = await sharp(slideStage.rgb, { raw: { width: slideStage.res, height: slideStage.res, channels: 3 } })
        .png().toBuffer();
      scored.push({ ...p, ...m, srcBuf, slideBuf });
      process.stdout.write(".");
    } catch (e) {
      skipped.push(`${p.puzzle_date} ${p.answer}: ${e.message}`);
      process.stdout.write("x");
    }
  }
  console.log(`\n${scored.length}/${rows.length} scored`);

  // Refuse to pick from a partial pool. The three measures are normalised ACROSS THE
  // SET, so a puzzle that failed to download does not merely go missing — it rescales
  // everyone else's score and quietly changes the answer to "which five are best".
  // Better to stop and fix the fetch than to ship a ranking that means nothing.
  if (skipped.length) {
    console.log("\nfailed to score:");
    for (const s of skipped) console.log(`  ✗ ${s}`);
    if (!has("--allow-partial"))
      throw new Error(`${skipped.length} of ${rows.length} puzzles could not be scored.\n`
        + `  Ranking across a partial set would pick a different five than ranking across all of them.\n`
        + `  Re-run (downloads are cached, so this resumes), or pass --allow-partial to accept it.`);
    console.log("  --allow-partial: ranking the rest anyway\n");
  }
  console.log("");
  if (scored.length < COUNT) throw new Error(`only ${scored.length} puzzles scored; need ${COUNT}`);

  const norm = (vals) => { const lo = Math.min(...vals), hi = Math.max(...vals); return (v) => (v - lo) / (hi - lo || 1); };
  const nD = norm(scored.map((o) => o.delta)), nE = norm(scored.map((o) => o.detail)), nM = norm(scored.map((o) => o.mystery));
  for (const o of scored) o.score = 0.5 * nD(o.delta) + 0.35 * nE(o.detail) + 0.15 * nM(o.mystery);
  scored.sort((a, b) => b.score - a.score);

  console.log("ranked (all eligible):");
  scored.forEach((o, i) => console.log(`  ${i < COUNT ? "*" : " "} ${o.score.toFixed(3)}  ${o.puzzle_date}  ${pretty(o.answer)} (${o.category})`));
  const picks = scored.slice(0, COUNT);
  console.log(`\npicked: ${picks.map((p) => pretty(p.answer)).join(", ")}\n`);

  // render
  const dir = path.join(OUT, `carousel-${POST_DATE}`);
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  const push = (n) => { const f = path.join(dir, `slide-${String(n).padStart(2, "0")}.png`); files.push(f); return f; };
  await coverSlide(picks, push(1));
  for (let i = 0; i < picks.length; i++) await puzzleSlide(picks[i], i + 1, picks.length, push(i + 2));
  await answersSlide(picks, push(picks.length + 2));

  const caption = buildCaption(picks);
  fs.writeFileSync(path.join(dir, "caption.txt"), caption);
  console.log(`rendered ${files.length} slides -> ${rel(dir)}`);
  for (const f of files) {
    const meta = await sharp(f).metadata();
    if (meta.width !== W || meta.height !== H) throw new Error(`${path.basename(f)} is ${meta.width}x${meta.height}, expected ${W}x${H}`);
  }
  console.log(`  all slides verified ${W}x${H}`);
  console.log(`\n── caption ──\n${caption}\n`);

  const dueAtISO = zonedTimeToUtc(POST_DATE, TIME, POST_TZ);
  if (new Date(dueAtISO).getTime() <= Date.now()) throw new Error(`${POST_DATE} ${TIME} ${POST_TZ} is in the past`);

  if (!COMMIT) {
    console.log(`Dry run complete. Slides are in ${rel(dir)} — look at them, then re-run with --commit.`);
    return;
  }

  // schedule
  const orgId = (await gql(`query { account { organizations { id name } } }`)).account.organizations[0].id;
  const channels = (await gql(`query { channels(input: { organizationId: ${gqlEsc(orgId)} }) { id name service } }`)).channels;
  const want = { instagram: IG_TYPE, facebook: FB_TYPE };
  const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : {};

  const urls = [];
  for (let i = 0; i < files.length; i++) urls.push(await upload(files[i], `carousel-${POST_DATE}-${String(i + 1).padStart(2, "0")}.png`));
  console.log(`uploaded ${urls.length} slides to Supabase storage`);

  const assets = urls.map((u) => `{ image: { url: ${gqlEsc(u)} } }`).join(", ");
  for (const [service, type] of Object.entries(want)) {
    const ch = channels.find((c) => c.service === service);
    if (!ch) { console.log(`  ${service.padEnd(9)} not connected in Buffer — skipped`); continue; }
    const key = `carousel-${POST_DATE}|${service}`;
    if (ledger[key] && !FORCE) { console.log(`  ${service.padEnd(9)} already booked (ledger) — skip`); continue; }
    const meta = service === "instagram"
      ? `instagram: { type: ${type}, shouldShareToFeed: true }`
      : `facebook: { type: ${type} }`;
    try {
      const data = await gql(`mutation {
        createPost(input: {
          channelId: ${gqlEsc(ch.id)}
          text: ${gqlEsc(caption)}
          schedulingType: automatic
          mode: customScheduled
          dueAt: ${gqlEsc(dueAtISO)}
          assets: [${assets}]
          metadata: { ${meta} }
        }) { ... on PostActionSuccess { post { id dueAt } } ... on MutationError { message } }
      }`);
      const r = data.createPost;
      if (r?.message) throw new Error(r.message);
      ledger[key] = { postId: r.post.id, dueAt: r.post.dueAt, at: new Date().toISOString(), slides: urls.length };
      fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
      console.log(`  ${service.padEnd(9)} ✓ scheduled (post ${r.post.id}) for ${r.post.dueAt}`);
    } catch (e) {
      console.log(`  ${service.padEnd(9)} ✗ ${e.message}`);
    }
  }
  console.log("\nDone.");
}

main().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
