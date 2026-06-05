// scripts/build-new-puzzles.mjs
// Queries Wikipedia's pageimages API to get a verified image URL for each
// new subject, combines them with the 29 existing unique puzzles, shuffles
// the full 180, and writes data/puzzles-new.json for review before seeding.
//
// Usage (from picxle-app/):   node scripts/build-new-puzzles.mjs

import { readFileSync, writeFileSync } from "fs";

// ── Seeded shuffle so the order is reproducible ───────────────────────────────
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Query Wikipedia pageimages API (batches of 50) ────────────────────────────
async function fetchImages(titleList) {
  const results = {};
  for (let i = 0; i < titleList.length; i += 50) {
    const batch = titleList.slice(i, i + 50);
    const qs = `action=query&titles=${batch.map(encodeURIComponent).join("|")}&prop=pageimages&piprop=original&format=json&origin=*`;
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${qs}`, {
      headers: { "User-Agent": "PicxleGame/1.0 (image-fetch script)" },
    });
    const data = await res.json();
    for (const page of Object.values(data.query.pages)) {
      results[page.title] = page.original?.source ?? null;
    }
    await new Promise((r) => setTimeout(r, 300)); // polite rate-limit
  }
  return results;
}

// ── 151 new subjects ──────────────────────────────────────────────────────────
// wikiTitle = Wikipedia article title used to fetch the lead image.
// accepts   = all strings the server should treat as correct (lowercase).
const NEW_SUBJECTS = [
  // ── Landmarks (22) ──────────────────────────────────────────────────────────
  { answer: "eiffel tower",         wikiTitle: "Eiffel Tower",              accepts: ["eiffel tower", "eiffel"],                   category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "big ben",              wikiTitle: "Big Ben",                   accepts: ["big ben"],                                  category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "sydney opera house",   wikiTitle: "Sydney Opera House",        accepts: ["sydney opera house", "opera house"],        category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "stonehenge",           wikiTitle: "Stonehenge",                accepts: ["stonehenge"],                               category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "sagrada familia",      wikiTitle: "Sagrada Família",           accepts: ["sagrada familia", "sagrada família"],       category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "burj khalifa",         wikiTitle: "Burj Khalifa",              accepts: ["burj khalifa"],                             category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "empire state building",wikiTitle: "Empire State Building",     accepts: ["empire state building", "empire state"],    category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "statue of liberty",    wikiTitle: "Statue of Liberty",         accepts: ["statue of liberty", "liberty"],             category: "Landmark",        license: "PD",       attribution: "Public domain" },
  { answer: "golden gate bridge",   wikiTitle: "Golden Gate Bridge",        accepts: ["golden gate bridge", "golden gate"],        category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "angkor wat",           wikiTitle: "Angkor Wat",                accepts: ["angkor wat"],                               category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "leaning tower of pisa",wikiTitle: "Leaning Tower of Pisa",     accepts: ["leaning tower of pisa", "tower of pisa"],   category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "neuschwanstein castle",wikiTitle: "Neuschwanstein Castle",     accepts: ["neuschwanstein castle", "neuschwanstein"],  category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "chichen itza",         wikiTitle: "Chichen Itza",              accepts: ["chichen itza"],                             category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "notre dame",           wikiTitle: "Notre-Dame de Paris",       accepts: ["notre dame", "notre-dame"],                 category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "alhambra",             wikiTitle: "Alhambra",                  accepts: ["alhambra"],                                 category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "mont saint michel",    wikiTitle: "Mont Saint-Michel",         accepts: ["mont saint michel", "mont-saint-michel"],   category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "christ the redeemer",  wikiTitle: "Christ the Redeemer (statue)", accepts: ["christ the redeemer", "redeemer"],     category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "tower bridge",         wikiTitle: "Tower Bridge",              accepts: ["tower bridge"],                             category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "kremlin",              wikiTitle: "Moscow Kremlin",            accepts: ["kremlin", "moscow kremlin"],                category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "st basils cathedral",  wikiTitle: "Saint Basil's Cathedral",   accepts: ["st basils cathedral", "saint basil's cathedral"], category: "Landmark", license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "palace of versailles", wikiTitle: "Palace of Versailles",      accepts: ["palace of versailles", "versailles"],       category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "trevi fountain",       wikiTitle: "Trevi Fountain",            accepts: ["trevi fountain"],                           category: "Landmark",        license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },

  // ── Animals (16) ────────────────────────────────────────────────────────────
  { answer: "zebra",                wikiTitle: "Zebra",                     accepts: ["zebra"],                                    category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "polar bear",           wikiTitle: "Polar bear",                accepts: ["polar bear"],                               category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "koala",                wikiTitle: "Koala",                     accepts: ["koala"],                                    category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "kangaroo",             wikiTitle: "Kangaroo",                  accepts: ["kangaroo"],                                 category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "penguin",              wikiTitle: "Penguin",                   accepts: ["penguin"],                                  category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "octopus",              wikiTitle: "Octopus",                   accepts: ["octopus"],                                  category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "gorilla",              wikiTitle: "Gorilla",                   accepts: ["gorilla"],                                  category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "snow leopard",         wikiTitle: "Snow leopard",              accepts: ["snow leopard"],                             category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "dolphin",              wikiTitle: "Dolphin",                   accepts: ["dolphin"],                                  category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "red panda",            wikiTitle: "Red panda",                 accepts: ["red panda"],                                category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "meerkat",              wikiTitle: "Meerkat",                   accepts: ["meerkat"],                                  category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "hippopotamus",         wikiTitle: "Hippopotamus",              accepts: ["hippopotamus", "hippo"],                    category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "komodo dragon",        wikiTitle: "Komodo dragon",             accepts: ["komodo dragon"],                            category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "cheetah",              wikiTitle: "Cheetah",                   accepts: ["cheetah"],                                  category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },

  // ── Natural Wonders (8) ─────────────────────────────────────────────────────
  { answer: "victoria falls",       wikiTitle: "Victoria Falls",            accepts: ["victoria falls"],                           category: "Natural Wonder",  license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "mount everest",        wikiTitle: "Mount Everest",             accepts: ["mount everest", "everest"],                 category: "Natural Wonder",  license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "great barrier reef",   wikiTitle: "Great Barrier Reef",        accepts: ["great barrier reef"],                       category: "Natural Wonder",  license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "sahara desert",        wikiTitle: "Sahara",                    accepts: ["sahara desert", "sahara"],                  category: "Natural Wonder",  license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "iguazu falls",         wikiTitle: "Iguazu Falls",              accepts: ["iguazu falls", "iguaçu falls"],             category: "Natural Wonder",  license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "uluru",                wikiTitle: "Uluru",                     accepts: ["uluru", "ayers rock"],                      category: "Natural Wonder",  license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "giants causeway",      wikiTitle: "Giant's Causeway",          accepts: ["giants causeway", "giant's causeway"],      category: "Natural Wonder",  license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "pamukkale",            wikiTitle: "Pamukkale",                 accepts: ["pamukkale"],                                category: "Natural Wonder",  license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },

  // ── Fruits & Vegetables (20) ────────────────────────────────────────────────
  { answer: "banana",               wikiTitle: "Banana",                    accepts: ["banana"],                                   category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "watermelon",           wikiTitle: "Watermelon",                accepts: ["watermelon"],                               category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "pineapple",            wikiTitle: "Pineapple",                 accepts: ["pineapple"],                                category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "strawberry",           wikiTitle: "Strawberry",                accepts: ["strawberry"],                               category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "broccoli",             wikiTitle: "Broccoli",                  accepts: ["broccoli"],                                 category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "lemon",                wikiTitle: "Lemon",                     accepts: ["lemon"],                                    category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "avocado",              wikiTitle: "Avocado",                   accepts: ["avocado"],                                  category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "mango",                wikiTitle: "Mango",                     accepts: ["mango"],                                    category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "carrot",               wikiTitle: "Carrot",                    accepts: ["carrot"],                                   category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "tomato",               wikiTitle: "Tomato",                    accepts: ["tomato"],                                   category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "corn",                 wikiTitle: "Maize",                     accepts: ["corn", "maize"],                            category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "grapes",               wikiTitle: "Grape",                     accepts: ["grapes", "grape"],                          category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "cherry",               wikiTitle: "Cherry",                    accepts: ["cherry", "cherries"],                       category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "pumpkin",              wikiTitle: "Pumpkin",                   accepts: ["pumpkin"],                                  category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "kiwi",                 wikiTitle: "Kiwifruit",                 accepts: ["kiwi", "kiwifruit"],                        category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "cauliflower",          wikiTitle: "Cauliflower",               accepts: ["cauliflower"],                              category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "eggplant",             wikiTitle: "Eggplant",                  accepts: ["eggplant", "aubergine"],                    category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "pear",                 wikiTitle: "Pear",                      accepts: ["pear"],                                     category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "peach",                wikiTitle: "Peach",                     accepts: ["peach"],                                    category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "raspberry",            wikiTitle: "Raspberry",                 accepts: ["raspberry", "raspberries"],                 category: "Food",            license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },

  // ── Flags (15) ──────────────────────────────────────────────────────────────
  { answer: "japan",                wikiTitle: "Japan",                     accepts: ["japan"],                                    category: "Flag",            license: "PD",       attribution: "Public domain" },
  { answer: "switzerland",          wikiTitle: "Switzerland",               accepts: ["switzerland"],                              category: "Flag",            license: "PD",       attribution: "Public domain" },
  { answer: "brazil",               wikiTitle: "Brazil",                    accepts: ["brazil"],                                   category: "Flag",            license: "PD",       attribution: "Public domain" },
  { answer: "united kingdom",       wikiTitle: "United Kingdom",            accepts: ["united kingdom", "uk", "britain"],         category: "Flag",            license: "PD",       attribution: "Public domain" },
  { answer: "france",               wikiTitle: "France",                    accepts: ["france"],                                   category: "Flag",            license: "PD",       attribution: "Public domain" },
  { answer: "south korea",          wikiTitle: "South Korea",               accepts: ["south korea", "korea"],                     category: "Flag",            license: "PD",       attribution: "Public domain" },
  { answer: "canada",               wikiTitle: "Canada",                    accepts: ["canada"],                                   category: "Flag",            license: "PD",       attribution: "Public domain" },
  { answer: "australia",            wikiTitle: "Australia",                 accepts: ["australia"],                                category: "Flag",            license: "PD",       attribution: "Public domain" },
  { answer: "germany",              wikiTitle: "Germany",                   accepts: ["germany"],                                  category: "Flag",            license: "PD",       attribution: "Public domain" },
  { answer: "jamaica",              wikiTitle: "Jamaica",                   accepts: ["jamaica"],                                  category: "Flag",            license: "PD",       attribution: "Public domain" },
  { answer: "norway",               wikiTitle: "Norway",                    accepts: ["norway"],                                   category: "Flag",            license: "PD",       attribution: "Public domain" },
  { answer: "turkey",               wikiTitle: "Turkey",                    accepts: ["turkey"],                                   category: "Flag",            license: "PD",       attribution: "Public domain" },
  { answer: "india",                wikiTitle: "India",                     accepts: ["india"],                                    category: "Flag",            license: "PD",       attribution: "Public domain" },
  { answer: "greece",               wikiTitle: "Greece",                    accepts: ["greece"],                                   category: "Flag",            license: "PD",       attribution: "Public domain" },
  { answer: "south africa",         wikiTitle: "South Africa",              accepts: ["south africa"],                             category: "Flag",            license: "PD",       attribution: "Public domain" },

  // ── Everyday Objects (15) ───────────────────────────────────────────────────
  { answer: "umbrella",             wikiTitle: "Umbrella",                  accepts: ["umbrella"],                                 category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "scissors",             wikiTitle: "Scissors",                  accepts: ["scissors"],                                 category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "key",                  wikiTitle: "Key (lock)",                accepts: ["key"],                                      category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "light bulb",           wikiTitle: "Incandescent light bulb",   accepts: ["light bulb", "lightbulb"],                  category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "headphones",           wikiTitle: "Headphones",                accepts: ["headphones"],                               category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "camera",               wikiTitle: "Camera",                    accepts: ["camera"],                                   category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "compass",              wikiTitle: "Compass",                   accepts: ["compass"],                                  category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "pencil",               wikiTitle: "Pencil",                    accepts: ["pencil"],                                   category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "padlock",              wikiTitle: "Padlock",                   accepts: ["padlock", "lock"],                          category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "hammer",               wikiTitle: "Hammer",                    accepts: ["hammer"],                                   category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "magnifying glass",     wikiTitle: "Magnifying glass",          accepts: ["magnifying glass"],                         category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "alarm clock",          wikiTitle: "Alarm clock",               accepts: ["alarm clock", "clock"],                     category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "telescope",            wikiTitle: "Telescope",                 accepts: ["telescope"],                                category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "thermometer",          wikiTitle: "Thermometer",               accepts: ["thermometer"],                              category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "hourglass",            wikiTitle: "Hourglass",                 accepts: ["hourglass", "sand timer"],                  category: "Object",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },

  // ── Musical Instruments (10) ────────────────────────────────────────────────
  { answer: "guitar",               wikiTitle: "Guitar",                    accepts: ["guitar"],                                   category: "Instrument",      license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "piano",                wikiTitle: "Piano",                     accepts: ["piano"],                                    category: "Instrument",      license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "violin",               wikiTitle: "Violin",                    accepts: ["violin"],                                   category: "Instrument",      license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "trumpet",              wikiTitle: "Trumpet",                   accepts: ["trumpet"],                                  category: "Instrument",      license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "harp",                 wikiTitle: "Harp",                      accepts: ["harp"],                                     category: "Instrument",      license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "saxophone",            wikiTitle: "Saxophone",                 accepts: ["saxophone", "sax"],                         category: "Instrument",      license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "cello",                wikiTitle: "Cello",                     accepts: ["cello"],                                    category: "Instrument",      license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "drums",                wikiTitle: "Drum kit",                  accepts: ["drums", "drum kit"],                        category: "Instrument",      license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "accordion",            wikiTitle: "Accordion",                 accepts: ["accordion"],                                category: "Instrument",      license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "flute",                wikiTitle: "Flute",                     accepts: ["flute"],                                    category: "Instrument",      license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },

  // ── Vehicles & Transport (12) ───────────────────────────────────────────────
  { answer: "hot air balloon",      wikiTitle: "Hot air balloon",           accepts: ["hot air balloon", "balloon"],               category: "Vehicle",         license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "sailboat",             wikiTitle: "Sailboat",                  accepts: ["sailboat", "sailing boat"],                 category: "Vehicle",         license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "helicopter",           wikiTitle: "Helicopter",                accepts: ["helicopter"],                               category: "Vehicle",         license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "submarine",            wikiTitle: "Submarine",                 accepts: ["submarine"],                                category: "Vehicle",         license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "bicycle",              wikiTitle: "Bicycle",                   accepts: ["bicycle", "bike"],                          category: "Vehicle",         license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "steam locomotive",     wikiTitle: "Steam locomotive",          accepts: ["steam locomotive", "locomotive", "steam train"], category: "Vehicle",    license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "double decker bus",    wikiTitle: "Double-decker bus",         accepts: ["double decker bus", "double-decker bus"],   category: "Vehicle",         license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "gondola",              wikiTitle: "Gondola (boat)",            accepts: ["gondola"],                                  category: "Vehicle",         license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "tractor",              wikiTitle: "Tractor",                   accepts: ["tractor"],                                  category: "Vehicle",         license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "fire truck",           wikiTitle: "Fire engine",               accepts: ["fire truck", "fire engine"],                category: "Vehicle",         license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "motorcycle",           wikiTitle: "Motorcycle",                accepts: ["motorcycle", "motorbike"],                  category: "Vehicle",         license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "ambulance",            wikiTitle: "Ambulance",                 accepts: ["ambulance"],                                category: "Vehicle",         license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },

  // ── Flowers & Plants (15) ───────────────────────────────────────────────────
  { answer: "sunflower",            wikiTitle: "Sunflower",                 accepts: ["sunflower"],                                category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "rose",                 wikiTitle: "Rose",                      accepts: ["rose"],                                     category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "cactus",               wikiTitle: "Cactus",                    accepts: ["cactus"],                                   category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "dandelion",            wikiTitle: "Dandelion",                 accepts: ["dandelion"],                                category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "tulip",                wikiTitle: "Tulip",                     accepts: ["tulip"],                                    category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "cherry blossom",       wikiTitle: "Cherry blossom",            accepts: ["cherry blossom", "sakura"],                 category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "lotus",                wikiTitle: "Nelumbo nucifera",          accepts: ["lotus", "lotus flower"],                    category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "lavender",             wikiTitle: "Lavender",                  accepts: ["lavender"],                                 category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "daisy",                wikiTitle: "Bellis perennis",           accepts: ["daisy"],                                    category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "orchid",               wikiTitle: "Orchid",                    accepts: ["orchid"],                                   category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "poppy",                wikiTitle: "Poppy",                     accepts: ["poppy"],                                    category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "hibiscus",             wikiTitle: "Hibiscus",                  accepts: ["hibiscus"],                                 category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "iris",                 wikiTitle: "Iris (plant)",              accepts: ["iris"],                                     category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "venus flytrap",        wikiTitle: "Venus flytrap",             accepts: ["venus flytrap", "venus fly trap"],          category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "bonsai",               wikiTitle: "Bonsai",                    accepts: ["bonsai"],                                   category: "Plant",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },

  // ── Extra Animals — compensate for 5 played puzzles + 4 DB duplicates ───────
  { answer: "crocodile",            wikiTitle: "Crocodile",                 accepts: ["crocodile"],                                category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "narwhal",              wikiTitle: "Narwhal",                   accepts: ["narwhal"],                                  category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "seahorse",             wikiTitle: "Seahorse",                  accepts: ["seahorse", "sea horse"],                    category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "capybara",             wikiTitle: "Capybara",                  accepts: ["capybara"],                                 category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "platypus",             wikiTitle: "Platypus",                  accepts: ["platypus"],                                 category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "pangolin",             wikiTitle: "Pangolin",                  accepts: ["pangolin"],                                 category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "sloth",                wikiTitle: "Sloth",                     accepts: ["sloth"],                                    category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "quokka",               wikiTitle: "Quokka",                    accepts: ["quokka"],                                   category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "axolotl",              wikiTitle: "Axolotl",                   accepts: ["axolotl"],                                  category: "Animal",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },

  // ── Insects (10) ────────────────────────────────────────────────────────────
  { answer: "ladybug",              wikiTitle: "Coccinellidae",             accepts: ["ladybug", "ladybird"],                      category: "Insect",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "butterfly",            wikiTitle: "Butterfly",                 accepts: ["butterfly"],                                category: "Insect",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "honeybee",             wikiTitle: "Western honey bee",         accepts: ["honeybee", "honey bee", "bee"],             category: "Insect",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "dragonfly",            wikiTitle: "Dragonfly",                 accepts: ["dragonfly"],                                category: "Insect",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "praying mantis",       wikiTitle: "Praying mantis",            accepts: ["praying mantis", "mantis"],                 category: "Insect",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "grasshopper",          wikiTitle: "Grasshopper",               accepts: ["grasshopper"],                              category: "Insect",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "stag beetle",          wikiTitle: "Stag beetle",               accepts: ["stag beetle"],                              category: "Insect",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "moth",                 wikiTitle: "Moth",                      accepts: ["moth"],                                     category: "Insect",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "caterpillar",          wikiTitle: "Caterpillar",               accepts: ["caterpillar"],                              category: "Insect",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "firefly",              wikiTitle: "Firefly",                   accepts: ["firefly", "lightning bug"],                 category: "Insect",          license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },

  // ── Space & Astronomy (8) ───────────────────────────────────────────────────
  { answer: "saturn",               wikiTitle: "Saturn",                    accepts: ["saturn"],                                   category: "Space",           license: "PD",       attribution: "NASA/JPL, public domain" },
  { answer: "moon",                 wikiTitle: "Moon",                      accepts: ["moon"],                                     category: "Space",           license: "PD",       attribution: "NASA, public domain" },
  { answer: "earth",                wikiTitle: "Earth",                     accepts: ["earth"],                                    category: "Space",           license: "PD",       attribution: "NASA, public domain" },
  { answer: "mars",                 wikiTitle: "Mars",                      accepts: ["mars"],                                     category: "Space",           license: "PD",       attribution: "NASA/ESA, public domain" },
  { answer: "jupiter",              wikiTitle: "Jupiter",                   accepts: ["jupiter"],                                  category: "Space",           license: "PD",       attribution: "NASA/JPL, public domain" },
  { answer: "milky way",            wikiTitle: "Milky Way",                 accepts: ["milky way"],                                category: "Space",           license: "CC-BY-SA", attribution: "Wikimedia Commons, CC BY-SA" },
  { answer: "international space station", wikiTitle: "International Space Station", accepts: ["international space station", "space station", "iss"], category: "Space", license: "PD", attribution: "NASA, public domain" },
  { answer: "pillars of creation",  wikiTitle: "Pillars of Creation",       accepts: ["pillars of creation"],                      category: "Space",           license: "PD",       attribution: "NASA/ESA/Hubble, public domain" },
];

// Puzzles already played — exclude these from the forward schedule entirely.
// (June 1–5 were mona lisa, giant panda, the starry night, flamingo, colosseum)
const ALREADY_PLAYED = new Set([
  "mona lisa", "giant panda", "the starry night", "flamingo", "colosseum",
]);

// ── Pull usable existing puzzles (existing 29 minus already-played) ───────────
function getExistingUsable() {
  const all = JSON.parse(readFileSync("data/puzzles.json", "utf8"));
  const seen = new Set();
  const unique = [];
  for (const row of all) {
    if (!seen.has(row.answer) && !ALREADY_PLAYED.has(row.answer)) {
      seen.add(row.answer);
      unique.push({
        answer:      row.answer,
        image_src:   row.image_src,
        accepts:     row.accepts,
        category:    row.category,
        license:     row.license,
        attribution: row.attribution,
      });
    }
  }
  return unique; // 24 entries (29 minus 5 played)
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Fetching Wikipedia images for ${NEW_SUBJECTS.length} new subjects…\n`);

  const titles = NEW_SUBJECTS.map((s) => s.wikiTitle);
  const imageMap = await fetchImages(titles);

  const failed = [];
  const newEntries = NEW_SUBJECTS.map((s) => {
    const src = imageMap[s.wikiTitle];
    if (!src) failed.push(s.answer);
    return { answer: s.answer, image_src: src ?? "MISSING", accepts: s.accepts, category: s.category, license: s.license, attribution: s.attribution };
  });

  if (failed.length) {
    console.warn(`\n⚠  No image found for: ${failed.join(", ")}`);
    console.warn("   Update those image_src values manually in data/puzzles-new.json before seeding.\n");
  }

  // Combine existing (excl. played) + new, deduplicating on answer
  const existing = getExistingUsable();
  const existingAnswers = new Set(existing.map((e) => e.answer));
  const dedupedNew = newEntries.filter((e) => {
    if (existingAnswers.has(e.answer)) {
      console.warn(`  skipping duplicate: "${e.answer}" already in existing pool`);
      return false;
    }
    return true;
  });
  const allPuzzles = [...existing, ...dedupedNew];
  console.log(`Combined pool: ${existing.length} existing (excl. played) + ${dedupedNew.length} new = ${allPuzzles.length} total`);

  // Shuffle with a fixed seed (change seed to get a different order)
  const shuffled = seededShuffle(allPuzzles, 99);

  // Assign dates starting 2026-06-06
  const START = new Date("2026-06-06T00:00:00Z");
  const rows = shuffled.map((p, i) => {
    const d = new Date(START);
    d.setUTCDate(d.getUTCDate() + i);
    return {
      puzzle_number: i + 6,   // #1–5 are the already-played June 1–5 puzzles
      puzzle_date:   d.toISOString().slice(0, 10),
      image_src:     p.image_src,
      answer:        p.answer,
      accepts:       p.accepts,
      category:      p.category,
      license:       p.license,
      attribution:   p.attribution,
    };
  });

  writeFileSync("data/puzzles-new.json", JSON.stringify(rows, null, 2));
  console.log(`\n✓ Written ${rows.length} rows to data/puzzles-new.json`);
  console.log(`  Dates: ${rows[0].puzzle_date} → ${rows[rows.length - 1].puzzle_date}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review data/puzzles-new.json (spot-check some image_src URLs in your browser)`);
  console.log(`  2. Fix any "MISSING" entries`);
  console.log(`  3. Run the DELETE SQL in Supabase (clears future rows from 2026-06-06 onwards)`);
  console.log(`  4. Copy puzzles-new.json over puzzles.json and run: npm run seed`);
}

main().catch((err) => { console.error(err); process.exit(1); });
