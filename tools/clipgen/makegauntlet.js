#!/usr/bin/env node
// Picxle GAUNTLET generator — five subjects in one clip.
//
//   node makegauntlet.js --mode speed    --dates 2026-07-04,2026-06-10,...
//   node makegauntlet.js --mode category --category Landmark --dates ...
//   node makegauntlet.js --mode speed --dates ... --schedule --date 2026-08-05 --commit
//
// TWO FORMATS, ONE ENGINE
//   speed     five subjects from anywhere in the archive — a mixed rapid-fire quiz
//   category  five subjects that share a category — "name all 5 landmarks"
// They differ only in how the five are chosen and what the standing headline says.
//
// HOW IT DIFFERS FROM THE DAILY (makeclip.js)
// The daily is one subject, five sharpens, answer withheld. This is five subjects, one
// sharpen each, answer shown immediately. See GAUNTLET in config.js for why the answer
// is revealed here and withheld there.
//
// SPOILER RULE
// Every subject must be at least SPOILER_GAP_DAYS old. A gauntlet names its answers on
// screen, so including a puzzle that is still live — or that a scheduled daily post has
// not reached yet — would hand out the answer to a puzzle people are still playing.
//
// Frames are rendered ONCE and encoded twice: a silent cut for TikTok (posted by hand so
// a trending sound can be added) and a music cut for Instagram / Facebook / YouTube.
//
// Scheduling is a DRY RUN by default. --commit uploads and books.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import {
  VIDEO, COLOUR, FONT, COPY, LAYOUT, GAUNTLET, MUSIC, ENCODE, LOUDNORM,
} from "./config.js";
import {
  HERE, TMP, OUT, rel, ff,
  RES_STEPS, exactStageImages, sharpImage, loadImage,
  drawtext, frame, footerText, endCardFrame, endCardText, frameStddev,
} from "./makeclip.js";

const BUFFER_API = "https://api.buffer.com";
const LEDGER = path.join(OUT, ".buffer-queued.json");
const BUCKET = "clips";
const POST_TZ = "Europe/London";
const POST_TIME_DEFAULT = "18:30";   // off the 11:00 daily slot, so the two don't compete
const SPOILER_GAP_DAYS = 2;
const YT_CATEGORY_ID = "20";         // Gaming — same as the daily
const CHANNELS = {
  youtube:   { type: "short" },
  instagram: { type: "reel" },
  facebook:  { type: "reel" },
};

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (f, d = null) => { const i = argv.indexOf(f); return i > -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d; };
const MODE = (opt("--mode", "speed") || "speed").toLowerCase();
const CATEGORY = opt("--category", "");
const DATES = (opt("--dates", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const MUSIC_FILE = opt("--music", "");
const MUSIC_CREDIT = opt("--music-credit", "");
const SCHEDULE = has("--schedule");
const COMMIT = has("--commit");
const POST_DATE = opt("--date", "");
const POST_TIME = opt("--time", POST_TIME_DEFAULT);

if (!["speed", "category"].includes(MODE)) { console.error("--mode must be speed|category"); process.exit(1); }
if (MODE === "category" && !CATEGORY) { console.error("--mode category needs --category <name>"); process.exit(1); }
if (DATES.length !== GAUNTLET.subjects) { console.error(`--dates needs exactly ${GAUNTLET.subjects} comma-separated puzzle dates (got ${DATES.length})`); process.exit(1); }

// Answers are stored lowercase, so they have to be title-cased for display — but a naive
// capitalise-every-word gives "Christ The Redeemer" and "Statue Of Liberty". The answer is
// drawn 58px tall in the middle of the frame; a capitalised "The" reads as a typo, and a
// typo on screen is the cheapest possible way to look unserious. Small words stay lowercase
// unless they lead (an answer never ends on one, so no need to special-case the last word).
const SMALL = new Set(["the", "of", "a", "an", "and", "in", "on", "at", "to", "de", "du", "la", "le", "von", "van"]);
const pretty = (s) => String(s).toLowerCase().split(/\s+/)
  .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.replace(/^[a-z]/, (c) => c.toUpperCase())))
  .join(" ");
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const gqlEsc = (s) => JSON.stringify(String(s));

function loadEnv() {
  const p = path.join(HERE, "..", "..", ".env.local");
  if (!fs.existsSync(p)) throw new Error("no .env.local at picxle-app/");
  const env = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const ENV = loadEnv();
const SB_HEADERS = { apikey: ENV.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}` };

async function fetchPuzzle(date) {
  const rows = await fetch(
    `${ENV.SUPABASE_URL}/rest/v1/puzzles?select=puzzle_date,answer,category,image_src,license,attribution&puzzle_date=eq.${date}`,
    { headers: SB_HEADERS }
  ).then((r) => r.json());
  if (!rows?.length) throw new Error(`no puzzle in DB for ${date}`);
  return rows[0];
}

// Wall-clock in an IANA zone -> UTC ISO, DST-safe. Same approach as queue-to-buffer.mjs:
// 18:30 UK is 17:30Z in summer and 18:30Z in winter.
function zonedTimeToUtc(dateStr, hhmm, tz) {
  const [Y, Mo, D] = dateStr.split("-").map(Number);
  const [h, mnt] = hhmm.split(":").map(Number);
  const guess = Date.UTC(Y, Mo - 1, D, h, mnt || 0);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asSeen = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (asSeen - guess)).toISOString();
}

// ── copy ─────────────────────────────────────────────────────────────────────
// The standing headline. It has to state the task in the first frame, because unlike the
// daily there is no single subject to carry the hook — the FORMAT is the hook.
const headline = () => MODE === "speed" ? "Name all 5" : `Name all 5 ${CATEGORY.toLowerCase()}s`;
const ytTitle = () => MODE === "speed"
  ? "5 Picxles, 3 seconds each — how many can you name? 🧩 #Shorts"
  : `Can you name all 5 ${CATEGORY.toLowerCase()}s? 🧩 #Shorts`;

function caption(subjects) {
  const who = MODE === "speed"
    ? `Send this to someone who'll score higher than you 👀`
    : `Send this to someone who reckons they know their ${CATEGORY.toLowerCase()}s 👀`;
  const what = MODE === "speed"
    ? `5 Picxles. One sharpen each. No second chances.`
    : `5 ${CATEGORY.toLowerCase()}s, pixelated. One sharpen each.`;

  // CC-BY is a licence condition, not decoration — every CC-BY image in the clip has to
  // be credited. CC0/PD need nothing.
  const credits = subjects
    .filter((s) => /CC-?BY/i.test(s.license || "") && s.attribution)
    .map((s) => `${pretty(s.answer)}: ${s.attribution}`);

  const tag = MODE === "speed" ? "speedround" : slug(CATEGORY).replace(/-/g, "");
  return [
    who, ``,
    what, ``,
    `Score out of 5 in the comments 👇`, ``,
    `A new Picxle every day — play today's at ${COPY.ctaUrl}`, ``,
    credits.length ? `Images: ${credits.join(" · ")}` : ``,
    MUSIC_CREDIT ? `Music: ${MUSIC_CREDIT}` : ``,
    ``,
    `#picxle #dailypuzzle #guessthepicture #${tag} #puzzlegame`,
  ].filter((l) => l !== null).join("\n");
}

// ── beats ────────────────────────────────────────────────────────────────────
// Reuses the daily's furniture — same footer wordmark, same bar row, same end card — so
// the two formats read as the same product. The bar row is REPURPOSED: on the daily it
// means "how sharp is the image", here it means "which of the five are you on". Same
// visual language, and it is the only progress cue a viewer needs.
function buildBeats({ subjects, frames, endFile }) {
  const big = VIDEO.height > 1500;
  const footer = footerText(VIDEO, LAYOUT);
  const T = (...items) => items.filter(Boolean).concat(footer);

  const title = () => drawtext({
    text: headline(), font: FONT.display, size: big ? 72 : 52,
    colour: COLOUR.text, y: String(LAYOUT.titleY),
  });
  // Speed mode shows each subject's category as a hint — it is the only thing narrowing
  // an 8x8 down from "anything in the archive". Category mode already said it up top.
  const hint = (s) => MODE !== "speed" ? null : drawtext({
    text: `${COPY.categoryPrefix}: ${String(s.category).toUpperCase()}`,
    font: FONT.mono, size: big ? 34 : 26, colour: COLOUR.blue, y: String(LAYOUT.categoryY),
  });
  const answerText = (s) => drawtext({
    text: pretty(s.answer), font: FONT.display, size: big ? 58 : 42,
    colour: COLOUR.green, y: String(LAYOUT.categoryY - 8),
  });
  const counter = (i) => drawtext({
    text: `${i + 1} / ${GAUNTLET.subjects}`, font: FONT.mono, size: big ? 38 : 30,
    colour: COLOUR.textDim, y: String(LAYOUT.counterY),
  });

  const beats = [];
  subjects.forEach((s, i) => {
    // flash 0 on the very first beat: frame 0 must already contain a puzzle, or the
    // platform sees a blank opening and the hook dies before it starts.
    beats.push({ file: frames[i].blocky, dur: GAUNTLET.blocky, flash: i === 0 ? 0 : GAUNTLET.flash, texts: T(title(), hint(s), counter(i)) });
    beats.push({ file: frames[i].mid, dur: GAUNTLET.mid, flash: GAUNTLET.flash, texts: T(title(), hint(s), counter(i)) });
    beats.push({ file: frames[i].sharp, dur: GAUNTLET.answer, flash: GAUNTLET.revealFlash, texts: T(title(), answerText(s), counter(i)) });
  });
  beats.push({ file: endFile, dur: GAUNTLET.endCard, flash: GAUNTLET.flash, texts: endCardText(VIDEO) });
  return beats;
}

function encode({ beats, outFile, music }) {
  const inputs = [], filters = [];
  beats.forEach((b, i) => {
    inputs.push("-loop", "1", "-t", String(b.dur), "-framerate", String(VIDEO.fps), "-i", rel(b.file));
    const flash = b.flash ? [`fade=t=in:st=0:d=${b.flash}:color=0x${COLOUR.bg.replace("#", "").toUpperCase()}`] : [];
    filters.push(`[${i}:v]${[...b.texts, ...flash, "format=yuv420p", "setsar=1"].join(",")}[v${i}]`);
  });
  const concat = beats.map((_, i) => `[v${i}]`).join("") + `concat=n=${beats.length}:v=1:a=0[out]`;
  const total = beats.reduce((s, b) => s + b.dur, 0);

  let audioFilter = "", audioMap = [];
  if (music) {
    inputs.push("-stream_loop", "-1", "-i", rel(music));
    const idx = beats.length;
    const fadeAt = Math.max(0, total - MUSIC.fadeOut).toFixed(2);
    audioFilter = `;[${idx}:a]atrim=0:${total.toFixed(2)},asetpts=PTS-STARTPTS,`
      + `afade=t=in:st=0:d=${MUSIC.fadeIn},afade=t=out:st=${fadeAt}:d=${MUSIC.fadeOut},${LOUDNORM}[a]`;
    audioMap = ["-map", "[a]", "-c:a", "aac", "-b:a", "160k", "-shortest"];
  }
  execFileSync(ffmpeg, [
    "-y", ...inputs, "-filter_complex", `${filters.join(";")};${concat}${audioFilter}`,
    "-map", "[out]", ...audioMap,
    "-c:v", "libx264", "-preset", "medium",
    "-b:v", ENCODE.bitrate, "-maxrate", ENCODE.maxrate, "-bufsize", ENCODE.bufsize,
    "-profile:v", ENCODE.profile, "-level", ENCODE.level,
    "-pix_fmt", "yuv420p", "-r", String(VIDEO.fps), "-vsync", "cfr",
    "-movflags", "+faststart",
    rel(outFile),
  ], { cwd: HERE, stdio: ["ignore", "ignore", "pipe"] });
  return total;
}

// ── acceptance checks ────────────────────────────────────────────────────────
// Same gates as the daily, with the duration window widened for the longer format and one
// extra check: the final PUZZLE frame (just before the end card) must be an answer frame,
// not a blocky one — a mis-ordered beat list would otherwise ship silently.
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
  if (dur < 14 || dur > 20) fails.push(`duration ${dur.toFixed(1)}s (want 14-20s)`);

  const hasAudio = /Audio:/.test(info);
  if (silent && hasAudio) fails.push("audio stream present but silent cut");
  if (!silent) {
    if (!hasAudio) fails.push("no audio stream (music expected)");
    else {
      const vol = parseFloat((ff(["-i", rel(outFile), "-af", "volumedetect", "-f", "null", "-"]).match(/mean_volume:\s*(-?[\d.]+) dB/) || [])[1] || "-99");
      if (vol < -18) fails.push(`mean volume ${vol} dB (want >= -18)`);
    }
  }

  const f0 = await frameStddev(outFile, ["-ss", "0"]);
  if (f0 < 18) fails.push(`frame 0 near-blank (stddev ${f0.toFixed(1)}) — intro not killed`);
  // The end card is a near-flat gradient, so it legitimately has a LOW stddev — the
  // daily's "final frame must be busy" check would fail here. Probe the last answer
  // frame instead, ~0.4s before the end card starts.
  const answerAt = (dur - GAUNTLET.endCard - 0.4).toFixed(2);
  const fAns = await frameStddev(outFile, ["-ss", answerAt]);
  if (fAns < 18) fails.push(`last answer frame near-blank (stddev ${fAns.toFixed(1)}) at ${answerAt}s`);

  if (fails.length) throw new Error(`acceptance checks FAILED for ${path.basename(outFile)}:\n  - ${fails.join("\n  - ")}`);
  console.log(`  checks ok: 1080x1920 h264 ${fps}fps ${dur.toFixed(1)}s ${silent ? "silent" : "audio"} frame0=${f0.toFixed(0)} answer=${fAns.toFixed(0)}`);
}

// ── Buffer ───────────────────────────────────────────────────────────────────
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

async function uploadClip(localPath, objectName) {
  const body = fs.readFileSync(localPath);
  const up = await fetch(`${ENV.SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectName}`, {
    method: "POST",
    headers: { ...SB_HEADERS, "Content-Type": "video/mp4", "x-upsert": "true" },
    body,
  });
  if (!up.ok) throw new Error(`Supabase upload failed HTTP ${up.status}: ${(await up.text()).slice(0, 200)}`);
  return `${ENV.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectName}`;
}

function metadataFor(service) {
  if (service === "instagram") return `instagram: { type: ${CHANNELS.instagram.type}, shouldShareToFeed: true }`;
  if (service === "facebook") return `facebook: { type: ${CHANNELS.facebook.type} }`;
  if (service === "youtube") return `youtube: { title: ${gqlEsc(ytTitle())}, categoryId: ${gqlEsc(YT_CATEGORY_ID)}, madeForKids: false }`;
  return "";
}

async function schedulePost({ service, channelId, text, videoUrl, dueAtISO }) {
  const data = await gql(`mutation {
    createPost(input: {
      channelId: ${gqlEsc(channelId)}
      text: ${gqlEsc(text)}
      schedulingType: automatic
      mode: customScheduled
      dueAt: ${gqlEsc(dueAtISO)}
      assets: [{ video: { url: ${gqlEsc(videoUrl)}, metadata: { thumbnailOffset: 0 } } }]
      metadata: { ${metadataFor(service)} }
    }) {
      ... on PostActionSuccess { post { id dueAt } }
      ... on MutationError { message }
    }
  }`);
  const r = data.createPost;
  if (r?.message) throw new Error(`createPost rejected: ${r.message}`);
  return r.post;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - SPOILER_GAP_DAYS * 86400e3).toISOString().slice(0, 10);

  console.log(`mode      ${MODE}${MODE === "category" ? ` (${CATEGORY})` : ""}`);
  console.log(`today     ${today}   spoiler cutoff: puzzle_date <= ${cutoff}\n`);

  // 1) resolve the five subjects, enforcing the spoiler rule and the category claim
  const subjects = [];
  for (const d of DATES) {
    const p = await fetchPuzzle(d);
    if (p.puzzle_date > cutoff)
      throw new Error(`${p.puzzle_date} (${p.answer}) is newer than the spoiler cutoff ${cutoff} — this clip NAMES its answers on screen, so it would spoil a puzzle people are still playing.`);
    if (MODE === "category" && String(p.category).toLowerCase() !== CATEGORY.toLowerCase())
      throw new Error(`${p.puzzle_date} is ${p.category}, not ${CATEGORY} — a category run whose headline says "${headline()}" has to be true.`);
    subjects.push(p);
    console.log(`  ${p.puzzle_date}  ${pretty(p.answer).padEnd(26)} ${String(p.category).padEnd(15)} ${p.license}`);
  }

  // 2) render frames once — both cuts must be visually identical
  const tag = MODE === "speed" ? "speed-round" : `category-run-${slug(CATEGORY)}`;
  const dir = path.join(TMP, tag);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  console.log(`\nrendering frames (exact pixelation via the game's own canvas)...`);
  const frames = [];
  for (let i = 0; i < subjects.length; i++) {
    const s = subjects[i];
    const buf = await loadImage(s.image_src);
    const stages = await exactStageImages(buf, LAYOUT.imageSize, String(s.category).toLowerCase() === "flag");
    const sharpBuf = await sharpImage(buf, LAYOUT.imageSize);
    const f = {
      blocky: path.join(dir, `s${i}-blocky.png`),
      mid: path.join(dir, `s${i}-mid.png`),
      sharp: path.join(dir, `s${i}-sharp.png`),
    };
    // stage index doubles as the bar count, so the row fills as the run progresses
    await frame(VIDEO, LAYOUT, stages[GAUNTLET.resIndex[0]], f.blocky, { stage: i - 1 });
    await frame(VIDEO, LAYOUT, stages[GAUNTLET.resIndex[1]], f.mid, { stage: i - 1 });
    await frame(VIDEO, LAYOUT, sharpBuf, f.sharp, { stage: i });
    frames.push(f);
    console.log(`  ${i + 1}/${subjects.length}  ${pretty(s.answer)}`);
  }
  const endFile = path.join(dir, "end.png");
  await endCardFrame(VIDEO, endFile);

  const beats = buildBeats({ subjects, frames, endFile });

  // 3) encode both cuts
  const base = `${tag}-${today}`;
  const music = MUSIC_FILE ? path.join(HERE, "music", MUSIC_FILE) : null;
  if (music && !fs.existsSync(music)) throw new Error(`no such track: ${music}`);

  const silentFile = path.join(OUT, `${base}-standard.mp4`);
  const total = encode({ beats, outFile: silentFile, music: null });
  console.log(`\nvideo   ${rel(silentFile)}\nlength  ${total.toFixed(1)}s  silent (TikTok)`);
  await verify(silentFile, { silent: true });

  let musicFile = null;
  if (music) {
    musicFile = path.join(OUT, `${base}-standard-music.mp4`);
    encode({ beats, outFile: musicFile, music });
    console.log(`video   ${rel(musicFile)}\nlength  ${total.toFixed(1)}s  music: ${path.basename(music)}`);
    await verify(musicFile, { silent: false });
  }

  // 4) caption
  const text = caption(subjects);
  const capFile = path.join(OUT, `${base}.txt`);
  fs.writeFileSync(capFile, text);
  console.log(`caption ${rel(capFile)}\n`);
  console.log("── caption ──\n" + text + "\n");

  const missingCredit = subjects.filter((s) => /CC-?BY/i.test(s.license || "") && !s.attribution);
  if (missingCredit.length)
    throw new Error(`CC-BY image with no attribution in the DB: ${missingCredit.map((s) => s.answer).join(", ")} — attribution is a licence condition, not optional.`);

  if (!SCHEDULE) { console.log(`Rendered. Watch it, then re-run with --schedule --date YYYY-MM-DD (add --commit to book).`); return; }

  // 5) schedule
  if (!musicFile) throw new Error("--schedule needs a music cut — pass --music <track.mp3>");
  if (!POST_DATE) throw new Error("--schedule needs --date YYYY-MM-DD (the post date)");
  const dueAtISO = zonedTimeToUtc(POST_DATE, POST_TIME, POST_TZ);
  if (new Date(dueAtISO).getTime() <= Date.now()) throw new Error(`${POST_DATE} ${POST_TIME} ${POST_TZ} is in the past`);

  const orgId = (await gql(`query { account { organizations { id name } } }`)).account.organizations[0].id;
  const channels = (await gql(`query { channels(input: { organizationId: ${gqlEsc(orgId)} }) { id name service } }`)).channels;
  const byService = {};
  for (const c of channels) if (CHANNELS[c.service] && !byService[c.service]) byService[c.service] = c;
  const targets = Object.keys(CHANNELS).filter((s) => byService[s]);

  console.log(`${COMMIT ? "COMMIT" : "DRY RUN"} — ${POST_DATE} ${POST_TIME} ${POST_TZ}  (${dueAtISO})`);
  console.log(`channels: ${targets.join(", ")}\n`);

  const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : {};
  let videoUrl = null;
  for (const service of targets) {
    const key = `${base}|${service}`;
    if (ledger[key]) { console.log(`  ${service.padEnd(10)} already booked (ledger) — skip`); continue; }
    if (!COMMIT) { console.log(`  ${service.padEnd(10)} would schedule`); continue; }
    try {
      if (!videoUrl) videoUrl = await uploadClip(musicFile, path.basename(musicFile));
      const post = await schedulePost({ service, channelId: byService[service].id, text, videoUrl, dueAtISO });
      ledger[key] = { postId: post.id, dueAt: post.dueAt, at: new Date().toISOString() };
      fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
      console.log(`  ${service.padEnd(10)} ✓ scheduled (post ${post.id})`);
    } catch (e) {
      console.log(`  ${service.padEnd(10)} ✗ ${e.message}`);
    }
  }
  console.log(COMMIT ? "\nDone." : "\nDry run — add --commit to book.");
}

main().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
