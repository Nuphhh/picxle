// node scripts/seed.cjs
// Upserts 29 puzzles (15 originals + 14 animals) in shuffled order, then
// fills 180 days of puzzle_date rows cycling through the pool.

const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("fs");

const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const eq = line.indexOf("=");
  if (eq > 0) process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Existing puzzles (paintings, landmarks, natural wonders) ──────────────────
const ORIGINALS = [
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg",
    answer: "mona lisa", accepts: ["mona lisa"], category: "Painting",
    license: "PD", attribution: "Leonardo da Vinci, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/0/0a/The_Great_Wave_off_Kanagawa.jpg",
    answer: "great wave", accepts: ["great wave", "the great wave", "great wave off kanagawa"], category: "Painting",
    license: "PD", attribution: "Katsushika Hokusai, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1280px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",
    answer: "starry night", accepts: ["starry night", "the starry night"], category: "Painting",
    license: "PD", attribution: "Vincent van Gogh, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/4/47/La_nascita_di_Venere_%28Botticelli%29.jpg",
    answer: "birth of venus", accepts: ["birth of venus", "venus"], category: "Painting",
    license: "PD", attribution: "Sandro Botticelli, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/9/9d/Vincent_van_Gogh_-_Sunflowers_-_VGM_F458.jpg",
    answer: "sunflowers", accepts: ["sunflowers", "sunflower"], category: "Painting",
    license: "PD", attribution: "Vincent van Gogh, 1888, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/e/ee/Restoration_Parthenon_Acropolis_Athens.jpg",
    answer: "parthenon", accepts: ["parthenon", "acropolis"], category: "Landmark",
    license: "CC0", attribution: "CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Johannes_Vermeer_-_Girl_with_a_Pearl_Earring_-_670_-_Mauritshuis.jpg",
    answer: "girl with a pearl earring", accepts: ["girl with a pearl earring", "pearl earring"], category: "Painting",
    license: "PD", attribution: "Johannes Vermeer, c.1665, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Fuji_Kawaguchi_465.JPG",
    answer: "mount fuji", accepts: ["mount fuji", "fuji", "mt fuji"], category: "Natural Wonder",
    license: "CC0", attribution: "Aistleitner, CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/c/c5/%27Taj_Mahal%2C_Sunset%27%2C_woodblock_by_Charles_W._Bartlett%2C_1920.jpg",
    answer: "taj mahal", accepts: ["taj mahal"], category: "Landmark",
    license: "PD", attribution: "Charles W. Bartlett, 1920, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Great_Wall_of_China_at_Mutianyu.JPG",
    answer: "great wall", accepts: ["great wall", "great wall of china"], category: "Landmark",
    license: "CC0", attribution: "CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/8/85/Roma_coliseo.JPG",
    answer: "colosseum", accepts: ["colosseum", "coliseum"], category: "Landmark",
    license: "CC0", attribution: "Gisela Huerta, CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/b/b0/Machu_picchu_grande.jpg",
    answer: "machu picchu", accepts: ["machu picchu"], category: "Landmark",
    license: "CC-BY", attribution: "Thomas Quine, CC-BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Aurora_borealis_over_Lapland_%28Unsplash%29.jpg",
    answer: "aurora borealis", accepts: ["aurora borealis", "northern lights", "aurora"], category: "Natural Wonder",
    license: "CC0", attribution: "CC0 public domain (Unsplash)",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/c/c4/Frederic_Edwin_Church_-_Niagara_Falls_-_WGA04867.jpg",
    answer: "niagara falls", accepts: ["niagara falls", "niagara"], category: "Natural Wonder",
    license: "PD", attribution: "Frederic Edwin Church, 1857, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/d/d9/Grand_Canyon_by_Gunnar_Widiorss%2C_c._1928%2C_watercolor.jpg",
    answer: "grand canyon", accepts: ["grand canyon"], category: "Natural Wonder",
    license: "PD", attribution: "Gunnar Widiorss, c.1928, public domain",
  },
];

// ── New animal puzzles ────────────────────────────────────────────────────────
const ANIMALS = [
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/9/9b/American_Flamingo_%28Phoeniconais_ruber_ruber%29.jpg",
    answer: "flamingo", accepts: ["flamingo"], category: "Animal",
    license: "CC-BY", attribution: "cliff1066, CC-BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/b/b8/GFP-axolotl.jpg",
    answer: "axolotl", accepts: ["axolotl"], category: "Animal",
    license: "CC0", attribution: "CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/b/b2/Panda_-_Aibao.jpg",
    answer: "giant panda", accepts: ["giant panda", "panda"], category: "Animal",
    license: "CC0", attribution: "CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/c/c8/Bengal_Tiger.jpg",
    answer: "tiger", accepts: ["tiger", "bengal tiger"], category: "Animal",
    license: "CC-BY", attribution: "Hafiz Issadeen, CC-BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/1/16/School_of_Clownfish.jpg",
    answer: "clownfish", accepts: ["clownfish", "clown fish"], category: "Animal",
    license: "CC0", attribution: "CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/5/52/Yellow-throated_Toucan_%2832697940868%29.jpg",
    answer: "toucan", accepts: ["toucan"], category: "Animal",
    license: "CC-BY", attribution: "Becky Matsubara, CC-BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Hummingbird.jpg",
    answer: "hummingbird", accepts: ["hummingbird", "humming bird"], category: "Animal",
    license: "PD", attribution: "Jon Sullivan, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/f/fd/Floating_jellyfish_%28Unsplash%29.jpg",
    answer: "jellyfish", accepts: ["jellyfish", "jelly fish"], category: "Animal",
    license: "CC0", attribution: "Alberto Montalesi, CC0 (Unsplash)",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/9/97/Green_sea_turtle_FWS_6630.JPG",
    answer: "sea turtle", accepts: ["sea turtle", "turtle", "green turtle"], category: "Animal",
    license: "PD", attribution: "USFWS, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/6/6d/Bald_eagle_FWS.jpg",
    answer: "bald eagle", accepts: ["bald eagle", "eagle"], category: "Animal",
    license: "PD", attribution: "USFWS, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/8/87/Manta_ray_face_%40_Ocean%C3%A1rio_de_Lisboa.jpg",
    answer: "manta ray", accepts: ["manta ray", "manta"], category: "Animal",
    license: "CC-BY", attribution: "David Sim, CC-BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/e/e3/Red-eyed_Tree_Frog_%28Agalychnis_callidryas%29_1.png",
    answer: "tree frog", accepts: ["tree frog", "red-eyed tree frog", "red eyed tree frog"], category: "Animal",
    license: "CC-BY", attribution: "Geoff Gallice, CC-BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/f/f2/Peacock_crest_%2824697301410%29.jpg",
    answer: "peacock", accepts: ["peacock"], category: "Animal",
    license: "CC-BY", attribution: "Thomas Quine, CC-BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/2/20/Poison_dart_frog_229.JPG",
    answer: "poison dart frog", accepts: ["poison dart frog", "dart frog", "poison frog"], category: "Animal",
    license: "PD", attribution: "Public domain",
  },
];

const ALL_PUZZLES = [...ORIGINALS, ...ANIMALS]; // 29 total

// Fisher-Yates shuffle with a fixed seed so the order is consistent each run.
// Change the seed number if you want a different ordering.
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SHUFFLED = seededShuffle(ALL_PUZZLES, 42);

function buildRows() {
  const launch = new Date("2026-06-01T00:00:00Z");
  const rows = [];
  for (let i = 0; i < 180; i++) {
    const d = new Date(launch);
    d.setUTCDate(d.getUTCDate() + i);
    rows.push({
      puzzle_date: d.toISOString().slice(0, 10),
      ...SHUFFLED[i % SHUFFLED.length],
    });
  }
  return rows;
}

async function seed() {
  console.log(`Seeding ${SHUFFLED.length} unique puzzles across 180 days…`);
  const rows = buildRows();
  const { error } = await supabase
    .from("puzzles")
    .upsert(rows, { onConflict: "puzzle_date" });
  if (error) { console.error("Failed:", error.message); process.exit(1); }
  console.log(`✓ ${rows.length} rows upserted.`);
  console.log("Puzzle order (day 1 → day 29):");
  SHUFFLED.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}.  ${p.answer}  [${p.category}]`));
}

seed();
