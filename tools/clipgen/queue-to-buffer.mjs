// queue-to-buffer.mjs — schedule the week's clips to YouTube + Instagram + Facebook
// via Buffer's GraphQL API, with the answer auto-posted as the first comment.
//
// WHY THIS EXISTS
// clipgen makes the videos; Buffer does the posting. This is the glue between them:
// it takes the finished MUSIC cuts (the YT/IG/FB versions — the silent cuts are for
// TikTok, which we post by hand), hosts each one at a public URL Buffer can pull,
// and books a post on each platform for the correct "one day behind" date.
//
// TikTok is deliberately NOT handled here — it stays manual so a trending in-app
// sound can be added for reach (see music/README.md and project memory).
//
// WHAT "AUTO-COMMENT" MEANS
// The video never shows the answer — the caption says "answer in the comments".
// Buffer's API can attach a first comment on Instagram and Facebook (the `firstComment`
// metadata field), so the answer reveal is posted automatically there. YouTube has NO
// comment API and won't let anything PIN a comment programmatically, so for YouTube the
// script prints the exact comment text for you to paste + pin manually (~10 seconds).
//
// SAFETY
// Scheduling to social is outward-facing and awkward to undo, so this runs as a DRY RUN
// by default: it prints exactly what it WOULD do and writes nothing. Add --commit to
// actually upload + schedule. A ledger (out/.buffer-queued.json) records what's been
// booked so re-running never double-posts (override with --force).
//
// USAGE
//   node queue-to-buffer.mjs                 # dry run — show the plan
//   node queue-to-buffer.mjs --commit        # really upload + schedule
//   node queue-to-buffer.mjs --time 18:30    # post time in UTC (default 17:00)
//   node queue-to-buffer.mjs --glob '2026-07-2*-standard-music.mp4'   # subset
//   node queue-to-buffer.mjs --commit --force   # re-book even if in the ledger
//
// Needs in ../../.env.local: BUFFER_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");
const LEDGER = path.join(OUT, ".buffer-queued.json");
const BUFFER_API = "https://api.buffer.com";

// ── knobs ────────────────────────────────────────────────────────────────────
// Which Buffer channels to post to, keyed by Buffer's `service` string. The value
// is the post type Buffer should use for a 9:16 clip. Switch a reel->post here if a
// platform rejects reels.
const CHANNELS = {
  youtube:   { type: "short" },   // YouTube auto-classifies 9:16 <60s as a Short
  instagram: { type: "reel" },
  facebook:  { type: "reel" },
};
const POST_TIME_UTC_DEFAULT = "17:00";   // 17:00 UTC = 18:00 UK summer / early evening
const OFFSET_DAYS = 1;                    // one day behind: puzzle date D -> post D+1
const YT_CATEGORY_ID = "20";             // YouTube category 20 = Gaming (required field)
const THUMB_OFFSET_MS = 0;               // frame 0 (blockiest stage) = feed thumbnail
const BUCKET = "clips";                  // public Supabase Storage bucket for the mp4s

// The auto-comment (answer reveal). Kept generic so it works for any puzzle.
const comment = (pretty) =>
  `It's ${pretty}! Did you get it before the last guess? 🎯 A new Picxle every day — play today's at picxle.vercel.app`;

// YouTube needs a title (the video's caption becomes the description). Non-spoiler by
// design — the hook is the guess, keywords live in the description hashtags.
const ytTitle = (category) =>
  `Can you guess this ${(category || "picture").toLowerCase()} before it clears? 🧩 #Shorts`;

// ── args + env ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (f, d = null) => { const i = argv.indexOf(f); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const COMMIT = has("--commit");
const FORCE = has("--force");
// Buffer's API only attaches a first comment on a PAID plan. On the free plan we
// schedule without it and print the answer for manual posting. Flip on once upgraded.
const AUTO_COMMENT = has("--auto-comment");
const TIME = opt("--time", POST_TIME_UTC_DEFAULT);
const GLOB = opt("--glob", "*-standard-music.mp4");

function loadEnv() {
  const p = path.join(HERE, "..", "..", ".env.local");
  if (!fs.existsSync(p)) throw new Error("no .env.local at picxle-app/");
  const env = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  for (const k of ["BUFFER_ACCESS_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])
    if (!env[k]) throw new Error(`missing ${k} in .env.local`);
  return env;
}
const ENV = loadEnv();
const SB_HEADERS = { apikey: ENV.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}` };

// ── helpers ──────────────────────────────────────────────────────────────────
const globToRe = (g) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
const pretty = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const readLedger = () => (fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : {});
const gqlEsc = (s) => JSON.stringify(String(s)); // valid GraphQL string literal (quotes, \n, unicode)

// GraphQL POST to Buffer. Throws on transport or GraphQL errors.
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

async function fetchPuzzle(date) {
  const rows = await fetch(
    `${ENV.SUPABASE_URL}/rest/v1/puzzles?select=puzzle_date,answer,category&puzzle_date=eq.${date}`,
    { headers: SB_HEADERS }
  ).then((r) => r.json());
  if (!rows?.length) throw new Error(`no puzzle in DB for ${date}`);
  return rows[0];
}

// Ensure a public bucket exists, then upsert the file. Returns the public URL.
async function uploadClip(localPath, objectName) {
  // create bucket (ignore "already exists")
  await fetch(`${ENV.SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...SB_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  }).catch(() => {});
  const body = fs.readFileSync(localPath);
  const up = await fetch(`${ENV.SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectName}`, {
    method: "POST",
    headers: { ...SB_HEADERS, "Content-Type": "video/mp4", "x-upsert": "true" },
    body,
  });
  if (!up.ok) throw new Error(`Supabase upload failed HTTP ${up.status}: ${(await up.text()).slice(0, 200)}`);
  return `${ENV.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectName}`;
}

// Build the per-channel metadata block (only the network the channel belongs to).
// firstComment is only sent when --auto-comment is on (it needs a paid Buffer plan).
function metadataFor(service, { commentText, category }) {
  const fc = AUTO_COMMENT ? `, firstComment: ${gqlEsc(commentText)}` : "";
  if (service === "instagram")
    return `instagram: { type: ${CHANNELS.instagram.type}, shouldShareToFeed: true${fc} }`;
  if (service === "facebook")
    return `facebook: { type: ${CHANNELS.facebook.type}${fc} }`;
  if (service === "youtube")
    return `youtube: { title: ${gqlEsc(ytTitle(category))}, categoryId: ${gqlEsc(YT_CATEGORY_ID)}, madeForKids: false }`;
  return "";
}

async function schedulePost({ service, channelId, text, videoUrl, dueAtISO, commentText, category }) {
  const mutation = `mutation {
    createPost(input: {
      channelId: ${gqlEsc(channelId)}
      text: ${gqlEsc(text)}
      schedulingType: automatic
      mode: customScheduled
      dueAt: ${gqlEsc(dueAtISO)}
      assets: [{ video: { url: ${gqlEsc(videoUrl)}, metadata: { thumbnailOffset: ${THUMB_OFFSET_MS} } } }]
      metadata: { ${metadataFor(service, { text, commentText, category })} }
    }) {
      ... on PostActionSuccess { post { id dueAt } }
      ... on MutationError { message }
    }
  }`;
  const data = await gql(mutation);
  const r = data.createPost;
  if (r?.message) throw new Error(`createPost rejected: ${r.message}`);
  return r.post;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(COMMIT ? "MODE: COMMIT (will upload + schedule)\n" : "MODE: dry run (nothing written — add --commit to go live)\n");

  // 1) find the clips
  const re = globToRe(GLOB);
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".mp4") && re.test(f)).sort();
  if (!files.length) { console.log(`no clips in out/ matching ${GLOB}`); return; }

  // 2) resolve Buffer org + channels once
  const orgs = (await gql(`query { account { organizations { id name } } }`)).account.organizations;
  if (!orgs?.length) throw new Error("Buffer account has no organizations");
  const orgId = orgs[0].id;
  const channels = (await gql(`query { channels(input: { organizationId: ${gqlEsc(orgId)} }) { id name service } }`)).channels;
  const byService = {};
  for (const c of channels) if (CHANNELS[c.service] && !byService[c.service]) byService[c.service] = c;
  const targets = Object.keys(CHANNELS).filter((s) => byService[s]);
  const missing = Object.keys(CHANNELS).filter((s) => !byService[s]);
  console.log(`Buffer org: ${orgs[0].name}`);
  console.log(`channels:   ${targets.map((s) => `${s} (${byService[s].name})`).join(", ") || "none"}`);
  if (missing.length) console.log(`  ⚠ not connected in Buffer, will skip: ${missing.join(", ")}`);
  console.log("");

  const ledger = readLedger();
  const now = Date.now();
  const manualComments = [];
  const failures = [];
  let booked = 0;

  for (const file of files) {
    const m = file.match(/^(\d{4}-\d{2}-\d{2})-(.+?)-standard-music\.mp4$/);
    if (!m) { console.log(`skip ${file} (name not <date>-<slug>-standard-music.mp4)`); continue; }
    const [, puzzleDate] = m;
    const capFile = path.join(OUT, file.replace(/\.mp4$/, ".txt"));
    const text = fs.existsSync(capFile) ? fs.readFileSync(capFile, "utf8").trim() : "";
    if (!text) { console.log(`skip ${file} (no caption .txt beside it)`); continue; }

    const puz = await fetchPuzzle(puzzleDate);
    const answerPretty = pretty(puz.answer);
    const commentText = comment(answerPretty);

    // post date = puzzle date + OFFSET_DAYS, at TIME UTC
    const d = new Date(`${puzzleDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + OFFSET_DAYS);
    const [hh, mm] = TIME.split(":");
    d.setUTCHours(+hh, +mm || 0, 0, 0);
    const dueAtISO = d.toISOString();
    const postDate = dueAtISO.slice(0, 10);
    const past = d.getTime() <= now;

    console.log(`■ ${answerPretty}  (puzzle ${puzzleDate} → post ${postDate} ${TIME} UTC)`);
    if (past) { console.log(`   ⚠ that time is in the past — skipping; post this one manually. \n`); continue; }

    let videoUrl = null;
    for (const service of targets) {
      const key = `${puzzleDate}|${service}`;
      if (ledger[key] && !FORCE) { console.log(`   ${service.padEnd(9)} already booked (ledger) — skip`); continue; }

      const commentNote = AUTO_COMMENT && service !== "youtube" ? "+ auto-comment" : "(comment: manual)";
      if (!COMMIT) { console.log(`   ${service.padEnd(9)} would schedule ${commentNote}`); continue; }

      // upload once per clip, lazily; one channel's failure must not abort the batch
      try {
        if (!videoUrl) videoUrl = await uploadClip(path.join(OUT, file), file);
        const post = await schedulePost({
          service, channelId: byService[service].id, text, videoUrl, dueAtISO, commentText, category: puz.category,
        });
        ledger[key] = { postId: post.id, dueAt: post.dueAt, at: new Date().toISOString() };
        fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
        console.log(`   ${service.padEnd(9)} ✓ scheduled  (post ${post.id})`);
        booked++;
      } catch (e) {
        failures.push(`${postDate} ${service}: ${e.message}`);
        console.log(`   ${service.padEnd(9)} ✗ ${e.message}`);
      }
    }
    // Comments that must be posted by hand: YouTube always; IG/FB too unless auto-comment.
    const manual = AUTO_COMMENT ? ["youtube"] : [...targets];
    if (manual.length) manualComments.push({ postDate, platforms: manual, commentText });
    console.log("");
  }

  if (manualComments.length) {
    console.log("── Post these comments by hand when live (YouTube: also PIN it) ──");
    for (const p of manualComments) console.log(`  ${p.postDate}  [${p.platforms.join("/")}]  ${p.commentText}`);
    console.log("");
  }
  if (failures.length) {
    console.log("── FAILURES (not booked; safe to re-run) ──");
    for (const f of failures) console.log(`  ✗ ${f}`);
    console.log("");
  }
  console.log(COMMIT ? `Done. ${booked} post(s) scheduled.` : "Dry run complete — re-run with --commit to schedule.");
}

main().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
