// Run once: node scripts/seed.cjs
// Populates the Supabase puzzles table with 6 months of daily puzzle dates.

const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("fs");

// Load .env.local manually
const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const eq = line.indexOf("=");
  if (eq > 0) process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PUZZLES = [
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg",
    answer: "mona lisa",
    accepts: ["mona lisa"],
    category: "Painting",
    license: "PD",
    attribution: "Leonardo da Vinci, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/0/0a/The_Great_Wave_off_Kanagawa.jpg",
    answer: "great wave",
    accepts: ["great wave", "the great wave", "great wave off kanagawa"],
    category: "Painting",
    license: "PD",
    attribution: "Katsushika Hokusai, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1280px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",
    answer: "starry night",
    accepts: ["starry night", "the starry night"],
    category: "Painting",
    license: "PD",
    attribution: "Vincent van Gogh, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/4/47/La_nascita_di_Venere_%28Botticelli%29.jpg",
    answer: "birth of venus",
    accepts: ["birth of venus", "venus"],
    category: "Painting",
    license: "PD",
    attribution: "Sandro Botticelli, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/9/9d/Vincent_van_Gogh_-_Sunflowers_-_VGM_F458.jpg",
    answer: "sunflowers",
    accepts: ["sunflowers", "sunflower"],
    category: "Painting",
    license: "PD",
    attribution: "Vincent van Gogh, 1888, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/e/ee/Restoration_Parthenon_Acropolis_Athens.jpg",
    answer: "parthenon",
    accepts: ["parthenon", "acropolis"],
    category: "Landmark",
    license: "CC0",
    attribution: "CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Johannes_Vermeer_-_Girl_with_a_Pearl_Earring_-_670_-_Mauritshuis.jpg",
    answer: "girl with a pearl earring",
    accepts: ["girl with a pearl earring", "pearl earring"],
    category: "Painting",
    license: "PD",
    attribution: "Johannes Vermeer, c.1665, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Fuji_Kawaguchi_465.JPG",
    answer: "mount fuji",
    accepts: ["mount fuji", "fuji", "mt fuji"],
    category: "Natural Wonder",
    license: "CC0",
    attribution: "Aistleitner, CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/c/c5/%27Taj_Mahal%2C_Sunset%27%2C_woodblock_by_Charles_W._Bartlett%2C_1920.jpg",
    answer: "taj mahal",
    accepts: ["taj mahal"],
    category: "Landmark",
    license: "PD",
    attribution: "Charles W. Bartlett, 1920, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Great_Wall_of_China_at_Mutianyu.JPG",
    answer: "great wall",
    accepts: ["great wall", "great wall of china"],
    category: "Landmark",
    license: "CC0",
    attribution: "CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/8/85/Roma_coliseo.JPG",
    answer: "colosseum",
    accepts: ["colosseum", "coliseum"],
    category: "Landmark",
    license: "CC0",
    attribution: "Gisela Huerta, CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/b/b0/Machu_picchu_grande.jpg",
    answer: "machu picchu",
    accepts: ["machu picchu"],
    category: "Landmark",
    license: "CC-BY",
    attribution: "Thomas Quine, CC-BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Aurora_borealis_over_Lapland_%28Unsplash%29.jpg",
    answer: "aurora borealis",
    accepts: ["aurora borealis", "northern lights", "aurora"],
    category: "Natural Wonder",
    license: "CC0",
    attribution: "CC0 public domain (Unsplash)",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/c/c4/Frederic_Edwin_Church_-_Niagara_Falls_-_WGA04867.jpg",
    answer: "niagara falls",
    accepts: ["niagara falls", "niagara"],
    category: "Natural Wonder",
    license: "PD",
    attribution: "Frederic Edwin Church, 1857, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/d/d9/Grand_Canyon_by_Gunnar_Widiorss%2C_c._1928%2C_watercolor.jpg",
    answer: "grand canyon",
    accepts: ["grand canyon"],
    category: "Natural Wonder",
    license: "PD",
    attribution: "Gunnar Widiorss, c.1928, public domain",
  },
];

function buildRows() {
  const launch = new Date("2026-06-01T00:00:00Z");
  const rows = [];
  for (let i = 0; i < 180; i++) {
    const d = new Date(launch);
    d.setUTCDate(d.getUTCDate() + i);
    rows.push({
      puzzle_date: d.toISOString().slice(0, 10),
      ...PUZZLES[i % PUZZLES.length],
    });
  }
  return rows;
}

async function seed() {
  console.log("Seeding puzzles…");
  const rows = buildRows();
  const { error } = await supabase
    .from("puzzles")
    .upsert(rows, { onConflict: "puzzle_date" });
  if (error) { console.error("Failed:", error.message); process.exit(1); }
  console.log(`✓ ${rows.length} rows inserted/updated.`);
}

seed();
