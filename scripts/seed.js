// Run once: node scripts/seed.js
// Populates the Supabase puzzles table and inserts 6 months of daily dates.

import "dotenv/config";
import { readFileSync } from "fs";

// Manually load .env.local since dotenv/config only reads .env by default
const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const [k, ...rest] = line.split("=");
  if (k && rest.length) process.env[k.trim()] = rest.join("=").trim();
}

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PUZZLES = [
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/8/8d/Lightmatter_panda.jpg",
    answer: "giant panda",
    accepts: ["giant panda"],
    category: "Animal",
    license: "CC-BY",
    attribution: "Aaron Logan / Lightmatter, CC BY 1.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1280px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",
    answer: "the starry night",
    accepts: ["the starry night"],
    category: "Painting",
    license: "PD",
    attribution: "Vincent van Gogh, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/9/96/Greater_flamingoes_%40_Jurong_Bird_Park_%2816101891605%29.jpg",
    answer: "flamingo",
    accepts: ["flamingo"],
    category: "Animal",
    license: "CC-BY",
    attribution: "_paVan_, CC BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/8/85/Roma_coliseo.JPG",
    answer: "colosseum",
    accepts: ["colosseum"],
    category: "Landmark",
    license: "CC0",
    attribution: "Gisela Huerta, CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/d/df/Axolotl.jpg",
    answer: "axolotl",
    accepts: ["axolotl"],
    category: "Animal",
    license: "PD",
    attribution: "Erzengel, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/c/c4/Frederic_Edwin_Church_-_Niagara_Falls_-_WGA04867.jpg",
    answer: "niagara falls",
    accepts: ["niagara falls"],
    category: "Natural Wonder",
    license: "PD",
    attribution: "Frederic Edwin Church, 1857, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/7/73/Indian_Peacock.jpg",
    answer: "peacock",
    accepts: ["peacock"],
    category: "Animal",
    license: "CC-BY",
    attribution: "William Warby, CC BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg",
    answer: "mona lisa",
    accepts: ["mona lisa"],
    category: "Painting",
    license: "PD",
    attribution: "Leonardo da Vinci, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/2/2b/Hawksbill_sea_turtle.jpg",
    answer: "sea turtle",
    accepts: ["sea turtle"],
    category: "Animal",
    license: "PD",
    attribution: "Colin Johnson, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Great_Wall_of_China_at_Mutianyu.JPG",
    answer: "great wall of china",
    accepts: ["great wall of china"],
    category: "Landmark",
    license: "CC0",
    attribution: "CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/0/07/Sword-billed_hummingbird_in_Ecuador_-_%2854572220117%29.jpg",
    answer: "hummingbird",
    accepts: ["hummingbird"],
    category: "Animal",
    license: "CC-BY",
    attribution: "Andy Morffew, CC BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/0/0a/The_Great_Wave_off_Kanagawa.jpg",
    answer: "the great wave off kanagawa",
    accepts: ["the great wave off kanagawa"],
    category: "Painting",
    license: "PD",
    attribution: "Katsushika Hokusai, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/7/73/Lion_waiting_in_Namibia.jpg",
    answer: "lion",
    accepts: ["lion"],
    category: "Animal",
    license: "CC-BY",
    attribution: "Kevin Pluck, CC BY 2.0",
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
    image_src: "https://upload.wikimedia.org/wikipedia/commons/6/6b/Amphiprion_percula.jpg",
    answer: "clownfish",
    accepts: ["clownfish"],
    category: "Animal",
    license: "PD",
    attribution: "ZooFari, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/e/ee/Restoration_Parthenon_Acropolis_Athens.jpg",
    answer: "parthenon",
    accepts: ["parthenon", "acropolis of athens"],
    category: "Landmark",
    license: "CC0",
    attribution: "CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Okinawa_Churaumi_aquarium_Manta_hdsr_Vlux5_01.jpg",
    answer: "manta ray",
    accepts: ["manta ray"],
    category: "Animal",
    license: "CC-BY",
    attribution: "Hyppolyte de Saint-Rambert, CC BY 4.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/4/47/La_nascita_di_Venere_%28Botticelli%29.jpg",
    answer: "the birth of venus",
    accepts: ["the birth of venus"],
    category: "Painting",
    license: "PD",
    attribution: "Sandro Botticelli, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/2/2d/Giraffe_at_Nairobi_National_Park%2C_Kenya.jpg",
    answer: "giraffe",
    accepts: ["giraffe"],
    category: "Animal",
    license: "PD",
    attribution: "Andrea Hanks / White House, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Aurora_borealis_over_Lapland_%28Unsplash%29.jpg",
    answer: "aurora borealis",
    accepts: ["aurora borealis", "northern lights"],
    category: "Natural Wonder",
    license: "CC0",
    attribution: "CC0 public domain (Unsplash)",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/3/37/Toucanet.jpg",
    answer: "toucan",
    accepts: ["toucan"],
    category: "Animal",
    license: "CC-BY",
    attribution: "Rossysphotos, CC BY 4.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Fuji_Kawaguchi_465.JPG",
    answer: "mount fuji",
    accepts: ["mount fuji"],
    category: "Natural Wonder",
    license: "CC0",
    attribution: "Aistleitner, CC0 public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/7/7a/Chameleon_portrait.jpg",
    answer: "chameleon",
    accepts: ["chameleon"],
    category: "Animal",
    license: "CC-BY",
    attribution: "CC BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/9/9d/Vincent_van_Gogh_-_Sunflowers_-_VGM_F458.jpg",
    answer: "sunflowers",
    accepts: ["sunflowers"],
    category: "Painting",
    license: "PD",
    attribution: "Vincent van Gogh, 1888, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/b/b5/Elephas_maximus.jpg",
    answer: "elephant",
    accepts: ["elephant"],
    category: "Animal",
    license: "PD",
    attribution: "G King, public domain",
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
    image_src: "https://upload.wikimedia.org/wikipedia/commons/d/dd/Poison_dart_Frog._Dendrobates_auratus_%2843568138571%29.jpg",
    answer: "poison dart frog",
    accepts: ["poison dart frog"],
    category: "Animal",
    license: "CC-BY",
    attribution: "gailhampshire, CC BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/d/d9/Grand_Canyon_by_Gunnar_Widiorss%2C_c._1928%2C_watercolor.jpg",
    answer: "grand canyon",
    accepts: ["grand canyon"],
    category: "Natural Wonder",
    license: "PD",
    attribution: "Gunnar Widiorss, c.1928, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Johannes_Vermeer_-_Girl_with_a_Pearl_Earring_-_670_-_Mauritshuis.jpg",
    answer: "girl with a pearl earring",
    accepts: ["girl with a pearl earring"],
    category: "Painting",
    license: "PD",
    attribution: "Johannes Vermeer, c.1665, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/8/8d/Lightmatter_panda.jpg",
    answer: "giant panda",
    accepts: ["giant panda"],
    category: "Animal",
    license: "CC-BY",
    attribution: "Aaron Logan / Lightmatter, CC BY 1.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/7/73/Indian_Peacock.jpg",
    answer: "peacock",
    accepts: ["peacock"],
    category: "Animal",
    license: "CC-BY",
    attribution: "William Warby, CC BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/3/37/Toucanet.jpg",
    answer: "toucan",
    accepts: ["toucan"],
    category: "Animal",
    license: "CC-BY",
    attribution: "Rossysphotos, CC BY 4.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/6/6b/Amphiprion_percula.jpg",
    answer: "clownfish",
    accepts: ["clownfish"],
    category: "Animal",
    license: "PD",
    attribution: "ZooFari, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/2/2b/Hawksbill_sea_turtle.jpg",
    answer: "sea turtle",
    accepts: ["sea turtle"],
    category: "Animal",
    license: "PD",
    attribution: "Colin Johnson, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/d/dd/Poison_dart_Frog._Dendrobates_auratus_%2843568138571%29.jpg",
    answer: "poison dart frog",
    accepts: ["poison dart frog"],
    category: "Animal",
    license: "CC-BY",
    attribution: "gailhampshire, CC BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/7/73/Lion_waiting_in_Namibia.jpg",
    answer: "lion",
    accepts: ["lion"],
    category: "Animal",
    license: "CC-BY",
    attribution: "Kevin Pluck, CC BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/b/b5/Elephas_maximus.jpg",
    answer: "elephant",
    accepts: ["elephant"],
    category: "Animal",
    license: "PD",
    attribution: "G King, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/2/2d/Giraffe_at_Nairobi_National_Park%2C_Kenya.jpg",
    answer: "giraffe",
    accepts: ["giraffe"],
    category: "Animal",
    license: "PD",
    attribution: "Andrea Hanks / White House, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/d/df/Axolotl.jpg",
    answer: "axolotl",
    accepts: ["axolotl"],
    category: "Animal",
    license: "PD",
    attribution: "Erzengel, public domain",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/7/7a/Chameleon_portrait.jpg",
    answer: "chameleon",
    accepts: ["chameleon"],
    category: "Animal",
    license: "CC-BY",
    attribution: "CC BY 2.0",
  },
  {
    image_src: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg",
    answer: "mona lisa",
    accepts: ["mona lisa"],
    category: "Painting",
    license: "PD",
    attribution: "Leonardo da Vinci, public domain",
  },
];

// Build 6 months of daily puzzle_date rows starting from today,
// cycling through the puzzle pool so the game never runs out.
function buildRows() {
  const launch = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const rows = [];
  for (let i = 0; i < 180; i++) {
    const d = new Date(launch);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const puzzle = PUZZLES[i % PUZZLES.length];
    rows.push({ puzzle_date: dateStr, ...puzzle });
  }
  return rows;
}

async function seed() {
  // Clear all past completions so streaks and stats start fresh
  console.log("Clearing completions…");
  const { error: clearError } = await supabase
    .from("completions")
    .delete()
    .gte("id", 0);
  if (clearError) console.warn("Could not clear completions:", clearError.message);
  else console.log("✓ Completions cleared.");

  // Wipe old puzzle rows and insert fresh ones from today
  console.log("Seeding puzzles table…");
  const rows = buildRows();

  const { error } = await supabase
    .from("puzzles")
    .upsert(rows, { onConflict: "puzzle_date" });

  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }

  console.log(`✓ Inserted/updated ${rows.length} puzzle rows starting from today.`);
}

seed();
