// Source an image for each new subject. Real image first, generate only as a
// last resort.
//
//   1. Wikipedia LEAD image - reliably depicts the article's subject (Commons
//      full-text search does not: it returns a wooden chair for "canoe").
//   2. Openverse, filtered to CC0 / public-domain / CC-BY only. Openverse's own
//      "commercial" filter still lets through BY-SA and BY-ND, which CLAUDE.md
//      excludes, so we filter on the licence code ourselves.
//   3. Higgsfield, only if no real image passes. Stops when credits run out.
//
// Every candidate must pass BOTH tests: colour (not B&W / not one flat tint) and
// stage-one (is the subject findable in the 8x8 the player actually sees?).
// Neither test can tell whether the picture shows the RIGHT THING - so every
// result is visually verified afterwards.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { execSync } from "node:child_process";
import { SUBJECTS } from "./new-subjects.mjs";

const OUT = path.join(process.cwd(), "..", "new-puzzles.json");
const PUB = path.join(process.cwd(), "public", "puzzles");
const UA = "PicxleBot/1.0 (puzzle sourcing; picxlebypenrose@gmail.com)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const WIKI = {
  "red fox": "Red fox", "snowy owl": "Snowy owl", "grey wolf": "Wolf", "tiger": "Tiger",
  "rhinoceros": "Rhinoceros", "sloth": "Sloth", "sea otter": "Sea otter", "raccoon": "Raccoon",
  "hedgehog": "Hedgehog", "jellyfish": "Jellyfish", "orca": "Orca", "camel": "Dromedary",
  "pineapple": "Pineapple", "pomegranate": "Pomegranate", "blueberry": "Blueberry", "garlic": "Garlic",
  "chilli pepper": "Chili pepper", "mushroom": "Amanita muscaria", "croissant": "Croissant", "sushi": "Sushi",
  "pyramids of giza": "Giza pyramid complex", "petra": "Petra", "hagia sophia": "Hagia Sophia",
  "moai": "Moai", "arc de triomphe": "Arc de Triomphe", "brandenburg gate": "Brandenburg Gate",
  "buckingham palace": "Buckingham Palace", "sphinx": "Great Sphinx of Giza",
  "bamboo": "Bamboo", "fern": "Fern", "maple leaf": "Maple leaf", "pine cone": "Conifer cone",
  "aloe vera": "Aloe vera", "wisteria": "Wisteria",
  "typewriter": "Typewriter", "rotary telephone": "Rotary dial", "teapot": "Teapot",
  "binoculars": "Binoculars", "anchor": "Anchor", "lantern": "Lantern",
  "tram": "Tram", "canoe": "Canoe", "skateboard": "Skateboard", "forklift": "Forklift", "cable car": "Aerial lift",
  "ant": "Ant", "wasp": "Wasp", "spider": "Spider", "scorpion": "Scorpion",
  "banjo": "Banjo", "harmonica": "Harmonica", "bagpipes": "Bagpipes", "xylophone": "Xylophone",
  "solar eclipse": "Solar eclipse", "neptune": "Neptune", "comet": "Comet",
  "volcano": "Volcano", "geyser": "Geyser", "glacier": "Glacier",
  "italy": "Flag of Italy", "mexico": "Flag of Mexico", "nepal": "Flag of Nepal",
  "the scream": "The Scream", "the kiss": "The Kiss (Klimt)",
};

// ── downloading (node fetch is flaky against the CDN; fall back to curl) ─────
async function fetchBuf(url) {
  if (!url) throw new Error("no url");
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/*" } });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * a); continue; }
      throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (a === 3) break;
      await sleep(1200 * a);
    }
  }
  // last resort: curl (proved reliable against the generation CDN)
  const tmp = path.join(PUB, `_dl_${Date.now()}.bin`);
  try {
    execSync(`curl -sL --max-time 90 -A ${JSON.stringify(UA)} -o ${JSON.stringify(tmp)} ${JSON.stringify(url)}`, { timeout: 100000 });
    const b = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);
    if (b.length < 1000) throw new Error("download too small");
    return b;
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch {}
    throw new Error("download failed");
  }
}

// ── licences ────────────────────────────────────────────────────────────────
const stripTags = (h) => (h || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
function commonsLicence(meta) {
  const code = (meta?.License?.value || "").toLowerCase().trim();
  const short = (meta?.LicenseShortName?.value || "").trim();
  const blob = `${code} ${short}`.toLowerCase();
  if (/share.?alike|-sa|\bsa\b|\bnc\b|noncommercial|non-commercial|\bnd\b|noderiv/.test(blob)) return null;
  if (/^cc0/.test(code) || /cc0/i.test(short)) return { license: "CC0", short: short || "CC0" };
  if (code === "pd" || /^pd-/.test(code) || /public domain/i.test(short)) return { license: "PD", short: short || "Public domain" };
  if (/^cc-by-[\d.]+$/.test(code) || /^cc by [\d.]+$/i.test(short)) return { license: "CC-BY", short: short || "CC BY" };
  return null;
}
// Openverse codes: cc0, pdm, by (allowed) — by-sa / by-nc* / by-nd (rejected)
function openverseLicence(code) {
  const c = (code || "").toLowerCase();
  if (c === "cc0") return { license: "CC0", short: "CC0" };
  if (c === "pdm") return { license: "PD", short: "Public Domain Mark" };
  if (c === "by") return { license: "CC-BY", short: "CC BY" };
  return null;
}

async function leadImage(title) {
  const u = "https://en.wikipedia.org/w/api.php?" + new URLSearchParams({
    action: "query", titles: title, prop: "pageimages", piprop: "original|name",
    format: "json", origin: "*", redirects: "1",
  });
  const d = await (await fetch(u, { headers: { "User-Agent": UA } })).json();
  const page = Object.values(d?.query?.pages || {})[0];
  return page?.pageimage ? `File:${page.pageimage}` : null;
}
async function commonsFile(fileTitle) {
  const u = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({
    action: "query", titles: fileTitle, prop: "imageinfo",
    iiprop: "url|extmetadata|size|mime", iiurlwidth: "1600", format: "json", origin: "*",
  });
  const d = await (await fetch(u, { headers: { "User-Agent": UA } })).json();
  const ii = Object.values(d?.query?.pages || {})[0]?.imageinfo?.[0];
  if (!ii) return null;
  const lic = commonsLicence(ii.extmetadata);
  if (!lic) return { blocked: ii.extmetadata?.LicenseShortName?.value || "unknown" };
  return {
    url: ii.thumburl || ii.url, license: lic.license, title: fileTitle,
    attribution: `${stripTags(ii.extmetadata?.Artist?.value) || "Wikimedia Commons"}, ${lic.short}`,
  };
}
async function openverse(term) {
  const u = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(term)}&license=cc0,pdm,by&page_size=12`;
  const d = await (await fetch(u, { headers: { "User-Agent": UA } })).json();
  const out = [];
  for (const r of d?.results || []) {
    const lic = openverseLicence(r.license);
    if (!lic || !r.url) continue;
    if ((r.width || 0) < 700) continue;
    out.push({
      url: r.url, license: lic.license, title: r.title || term,
      attribution: `${r.creator || "Unknown"} via ${r.source || "Openverse"}, ${lic.short}`,
    });
  }
  return out;
}

// ── tests ───────────────────────────────────────────────────────────────────
const hueOf = (r, g, b) => {
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  if (d === 0) return -1;
  let h = max === r ? ((g-b)/d) % 6 : max === g ? (b-r)/d + 2 : (r-g)/d + 4;
  h *= 60; return h < 0 ? h + 360 : h;
};
const std = (a) => { const m = a.reduce((x,y)=>x+y,0)/a.length; return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length); };
async function testImage(buf, category) {
  const { data, info } = await sharp(buf, { limitInputPixels: false })
    .resize(200, 200, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0; const n = info.width * info.height;
  for (let i = 0; i < n; i++) sum += Math.max(data[i*3],data[i*3+1],data[i*3+2]) - Math.min(data[i*3],data[i*3+1],data[i*3+2]);
  const sat = sum / n;
  const master = await sharp(buf, { limitInputPixels: false }).resize(440, 440, { fit: "cover" }).toBuffer();
  const small = await sharp(master).resize(8, 8, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const lums = [], hist = new Array(36).fill(0);
  let coloured = 0;
  for (let i = 0; i < 64; i++) {
    const r = small[i*3], g = small[i*3+1], b = small[i*3+2];
    lums.push(0.2126*r + 0.7152*g + 0.0722*b);
    if (Math.max(r,g,b) - Math.min(r,g,b) > 25) { coloured++; const h = hueOf(r,g,b); if (h>=0) hist[Math.floor(h/10)%36]++; }
  }
  let best = 0;
  for (let s = 0; s < 36; s++) { let w = 0; for (let k = 0; k < 6; k++) w += hist[(s+k)%36]; if (w > best) best = w; }
  const hue90 = coloured ? (best/coloured)*100 : 0;
  let hues = 0;
  for (let s = 0; s < 36; s += 3) { const w = hist[s]+hist[(s+1)%36]+hist[(s+2)%36]; if (coloured && w/coloured >= 0.05) hues++; }
  const lumStd = std(lums), pctCol = (coloured/64)*100;

  // Calibrated against known-bad puzzles. These rules deliberately only catch
  // what they can catch RELIABLY — the old (unusable) cheetah scored lumStd 26.0
  // while the perfectly readable Statue of Liberty scores 26.3, so any threshold
  // sharp enough to separate those would reject good images too. Visual
  // verification is the real gate; this just filters the egregious cases.
  //
  //   sat < 15                -> greyscale (christ the redeemer, headphones: sat ~0)
  //   hues<=1 && pctCol>90    -> the WHOLE frame is one colour (the orange pumpkin
  //                              on an orange jumper). A white owl against blue sky
  //                              passes: its achromatic subject leaves uncoloured
  //                              blocks, so pctCol stays well under 90.
  //   lumStd<22 && hues<=1    -> nothing to see: no brightness shape AND no colour
  //                              separation (brown key on brown wood: lumStd 16.6).
  //                              The hues clause matters — a red fox on flat green
  //                              grass has lumStd ~16 because the grass is evenly
  //                              lit, but the fox reads perfectly well as ORANGE on
  //                              GREEN. Brightness is not the only way to see a
  //                              subject; judging on lumStd alone rejects it wrongly.
  const flat = category === "Flag" || category === "Painting"; // flat by nature
  const fails = [];
  if (sat < 15) fails.push(`B&W (sat ${sat.toFixed(0)})`);
  if (!flat && hues <= 1 && pctCol > 90) fails.push(`one flat colour (pctCol ${pctCol.toFixed(0)}%)`);
  if (!flat && lumStd < 22 && hues <= 1) fails.push(`no shape or colour (lumStd ${lumStd.toFixed(0)})`);
  return { ok: fails.length === 0, fails, sat, hue90, hues, lumStd, pctCol };
}

// ── generation ──────────────────────────────────────────────────────────────
// Cached credit balance. A failed status call must NOT read as "out of credits"
// (a transient 403 once aborted a whole run), so we keep the last known value and
// decrement locally, only re-checking against the API every few generations.
let _credits = null, _sinceCheck = 0;
const COST = 0.15; // z_image
function credits({ force = false } = {}) {
  if (_credits !== null && !force && _sinceCheck < 8) return _credits;
  for (let a = 1; a <= 3; a++) {
    try {
      const m = execSync("higgsfield account status", { encoding: "utf8" }).match(/([\d.]+)\s*credits/);
      if (m) { _credits = parseFloat(m[1]); _sinceCheck = 0; return _credits; }
    } catch { /* transient — retry */ }
  }
  return _credits ?? 99; // unknown: assume we still have credits rather than abort
}
// Never allow a person into a generated image. Human anatomy is where generation
// fails hardest (the first bagpipes attempt came back with a HEADLESS piper), and
// the person is never the answer — the subject is. Enforced centrally so no
// individual prompt can forget it.
const NO_PEOPLE = "absolutely no people, no person, no hands, no human figures, no body parts";

function generate(prompt) {
  const full = /no people/i.test(prompt) ? prompt : `${prompt}, ${NO_PEOPLE}`;
  const out = execSync(`higgsfield generate create z_image --prompt ${JSON.stringify(full)} --aspect_ratio 1:1 --wait`,
    { encoding: "utf8", timeout: 600000 });
  if (_credits !== null) { _credits -= COST; _sinceCheck++; } // spent, track locally
  const url = (out.match(/https?:\/\/\S+\.png/) || [])[0];
  if (!url) throw new Error("no image url returned");
  return url;
}

// ── run ─────────────────────────────────────────────────────────────────────
const results = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
const done = new Set(results.map((r) => r.answer));
console.log(`${SUBJECTS.length} subjects, ${done.size} done. Credits: ${credits()}\n`);

for (const s of SUBJECTS) {
  if (done.has(s.answer)) continue;
  let chosen = null; const why = [];

  // 1. Wikipedia lead image
  try {
    const f = WIKI[s.answer] && await leadImage(WIKI[s.answer]);
    const info = f && await commonsFile(f);
    if (info?.blocked) why.push(`lead=${info.blocked}`);
    else if (info) {
      const t = await testImage(await fetchBuf(info.url), s.category);
      if (t.ok) chosen = { source: "wikipedia", image_src: info.url, license: info.license, attribution: info.attribution, test: t, title: info.title };
      else why.push(`lead ${t.fails.join("/")}`);
    }
  } catch (e) { why.push(`lead err`); }

  // 2. Openverse (real, commercially licensed)
  if (!chosen) {
    try {
      for (const c of await openverse(s.search)) {
        try {
          const t = await testImage(await fetchBuf(c.url), s.category);
          if (t.ok) { chosen = { source: "openverse", image_src: c.url, license: c.license, attribution: c.attribution, test: t, title: c.title }; break; }
        } catch {}
        await sleep(200);
      }
      if (!chosen) why.push("openverse none passed");
    } catch { why.push("openverse err"); }
  }

  // 2b. Reuse an image we already generated for this subject. Re-running the
  // pipeline must never pay for an image we already have: earlier runs
  // regenerated the camel from scratch each time and the fresh one came back
  // with two heads. Generation is not idempotent, so a good result is worth
  // keeping.
  if (!chosen) {
    const cached = path.join(PUB, `${slug(s.answer)}.jpg`);
    if (fs.existsSync(cached)) {
      const t = await testImage(fs.readFileSync(cached), s.category);
      chosen = { source: "generated", image_src: `https://picxle.vercel.app/puzzles/${slug(s.answer)}.jpg`,
                 license: "CC0", attribution: "Picxle original (AI-generated)", test: t, title: `${s.answer} (cached)` };
      console.log(`CACHE ${s.answer.padEnd(18)} reusing existing generated image`);
    }
  }

  // 3. generate
  if (!chosen) {
    if (!s.prompt) { console.log(`SKIP  ${s.answer.padEnd(18)} ${why.join("; ")} (artwork — will not fake it)`); continue; }
    if (credits() < 0.3) { console.log(`\n*** OUT OF CREDITS — stopping at "${s.answer}" ***`); break; }
    // ONE generation per subject. Never auto-retry: a failed test used to trigger
    // a second paid generation, and re-running the pipeline paid again from
    // scratch — that burned 7+ tigers, all of which were perfectly good images
    // rejected by a bad test. Always KEEP the image, record any test warning, and
    // let visual verification decide. Credits are the scarce resource here.
    try {
      const buf = await fetchBuf(generate(s.prompt));
      const t = await testImage(buf, s.category);
      const file = `${slug(s.answer)}.jpg`;
      await sharp(buf).resize(1200, 1200, { fit: "cover" }).jpeg({ quality: 88 }).toFile(path.join(PUB, file));
      chosen = { source: "generated", image_src: `https://picxle.vercel.app/puzzles/${file}`, license: "CC0", attribution: "Picxle original (AI-generated)", test: t, title: s.answer };
      if (!t.ok) console.log(`WARN  ${s.answer.padEnd(18)} generated but flagged: ${t.fails.join(", ")} (kept — verify by eye)`);
    } catch (e) { console.log(`FAIL  ${s.answer.padEnd(18)} ${e.message}`); }
  }

  if (chosen) {
    const tag = chosen.source === "generated" ? "GEN " : "REAL";
    console.log(`${tag}  ${s.answer.padEnd(18)} ${chosen.license.padEnd(5)} ${chosen.source.padEnd(9)} sat=${chosen.test.sat.toFixed(0).padStart(3)} lum=${chosen.test.lumStd.toFixed(0).padStart(2)}  ${String(chosen.title).replace(/^File:/,"").slice(0,38)}`);
    results.push({ answer: s.answer, accepts: s.accepts, category: s.category, decoys: s.decoys, ...chosen });
    fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  }
  await sleep(300);
}

const real = results.filter((r) => r.source !== "generated").length;
console.log(`\n${results.length}/${SUBJECTS.length} sourced — ${real} real, ${results.length - real} generated. Credits: ${credits()}`);
