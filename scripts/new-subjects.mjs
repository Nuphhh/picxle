// 60 new puzzle subjects, spread across the existing categories.
//
// search   - Wikimedia Commons search term (we source a REAL, commercially
//            licensed image first; CC0/PD/CC-BY only, never share-alike/NC/ND)
// prompt   - fallback for Higgsfield, used ONLY if no real image passes the
//            colour + stage-1 tests. Contrast must stay PLAUSIBLE: a fox on
//            green grass, not a lion in a blue ocean.
// decoys   - plausible wrong answers, added to the dictionary so the
//            autocomplete stays interesting and the guess isn't a giveaway.
export const SUBJECTS = [
  // ── Animals (12) ──
  // Poses are deliberately varied per animal — an earlier pass used "side profile,
  // standing" on nearly all of them and every picture came out identical. Each
  // pose still has to be one the animal would actually adopt.
  { answer: "red fox", accepts: ["red fox", "fox"], category: "Animal", search: "red fox vulpes vulpes grass",
    prompt: "Candid wildlife photograph of a red fox mid-pounce, leaping forward with front paws outstretched and bushy tail streaming behind, vivid orange-red fur against green meadow grass, caught in motion, filling most of the frame, natural daylight, real telephoto snapshot, no text",
    decoys: ["coyote", "jackal", "dingo", "fennec fox"] },
  { answer: "snowy owl", accepts: ["snowy owl", "owl"], category: "Animal", search: "snowy owl perched",
    prompt: "Candid wildlife photograph of a snowy owl in flight coming straight toward the camera, huge white wings spread wide, yellow eyes fixed forward, against a clear blue sky, filling most of the frame, natural daylight, real telephoto snapshot, no text",
    decoys: ["barn owl", "eagle owl", "tawny owl", "kestrel"] },
  { answer: "grey wolf", accepts: ["grey wolf", "gray wolf", "wolf"], category: "Animal", search: "grey wolf canis lupus",
    prompt: "Candid wildlife photograph of a grey wolf howling, head tilted back and muzzle raised to the sky, thick grey and tan fur, seen from a low angle against dark green forest, filling most of the frame, natural daylight, real telephoto snapshot, no text",
    decoys: ["husky", "malamute", "coyote", "german shepherd"] },
  { answer: "tiger", accepts: ["tiger", "bengal tiger"], category: "Animal", search: "bengal tiger",
    prompt: "Candid wildlife photograph of a Bengal tiger wading through a shallow green river, water streaming off its bold orange and black striped coat, seen head on from slightly above, filling most of the frame, natural daylight, real telephoto snapshot, no text",
    decoys: ["jaguar", "leopard", "puma", "lynx"] },
  { answer: "rhinoceros", accepts: ["rhinoceros", "rhino"], category: "Animal", search: "white rhinoceros",
    prompt: "Candid wildlife photograph of a rhinoceros charging directly toward the camera, head lowered and horn forward, dust kicking up from green savannah grass, dramatic head-on angle, filling most of the frame, bright natural daylight, real telephoto snapshot, no text",
    decoys: ["hippopotamus", "water buffalo", "warthog", "tapir"] },
  // SLOTH DROPPED. Four generations, four anatomy failures (three limbs, three
  // limbs, two heads, ambiguous limb count) and no usable commercially-licensed
  // photo existed either. Sloths are a known failure mode for this model: shaggy
  // fur hides where limbs attach, so it loses count. Swapped for a swan — one
  // head, one neck, two wings, high contrast on water: anatomy I can verify at a
  // glance. Better a subject I can ship correctly than a re-roll lottery.
  { answer: "swan", accepts: ["swan", "mute swan"], category: "Animal", search: "mute swan water",
    prompt: "Candid wildlife photograph of a single white mute swan gliding on dark blue water, its long neck curved into an elegant S, bright orange and black beak, wings slightly raised, exactly one head and one neck, filling most of the frame, natural daylight, real telephoto snapshot, no text",
    decoys: ["goose", "pelican", "heron", "egret"] },
  { answer: "sea otter", accepts: ["sea otter", "otter"], category: "Animal", search: "sea otter floating",
    prompt: "Candid wildlife photograph of a sea otter floating on its back in blue-green water, cracking a shell open on its chest with both paws, seen from directly above, filling most of the frame, natural daylight, real telephoto snapshot, no text",
    decoys: ["beaver", "mink", "seal", "platypus"] },
  { answer: "raccoon", accepts: ["raccoon"], category: "Animal", search: "raccoon procyon lotor",
    prompt: "Candid wildlife photograph of a raccoon standing up on its hind legs and reaching upward with its front paws, grey fur with the black bandit mask and ringed tail, on green grass in a garden, filling most of the frame, natural daylight, real snapshot, no text",
    decoys: ["badger", "possum", "skunk", "coati"] },
  { answer: "hedgehog", accepts: ["hedgehog"], category: "Animal", search: "hedgehog erinaceus",
    prompt: "Candid photograph of a hedgehog curled into a tight defensive ball on green grass, brown and cream spines bristling outward in all directions, seen from above, filling most of the frame, natural daylight, real snapshot, no text",
    decoys: ["porcupine", "echidna", "shrew", "mole"] },
  { answer: "jellyfish", accepts: ["jellyfish"], category: "Animal", search: "jellyfish medusa",
    prompt: "Photograph of a translucent orange jellyfish seen from below, looking up through its glowing bell with long tentacles trailing down past the camera, deep blue water above, filling most of the frame, natural underwater light, real snapshot, no text",
    decoys: ["squid", "anemone", "coral", "nautilus"] },
  { answer: "orca", accepts: ["orca", "killer whale"], category: "Animal", search: "orca killer whale breaching",
    prompt: "Candid wildlife photograph of an orca exploding out of the blue-grey sea in a full breach, whole glossy black and white body clear of the water and twisting sideways, spray flying, filling most of the frame, natural daylight, real telephoto snapshot, no text",
    decoys: ["dolphin", "humpback whale", "porpoise", "beluga"] },
  { answer: "camel", accepts: ["camel", "dromedary"], category: "Animal", search: "dromedary camel desert",
    prompt: "Candid photograph of a camel sitting down resting on golden desert sand with its legs folded beneath it, long neck curving round and head turned toward the camera, single hump, deep blue sky, filling most of the frame, natural daylight, real snapshot, no text",
    decoys: ["llama", "alpaca", "dromedary", "horse"] },

  // ── Food (8) ──
  { answer: "pineapple", accepts: ["pineapple"], category: "Food", search: "pineapple fruit whole",
    prompt: "Candid photograph of a whole ripe pineapple standing on a dark slate kitchen counter, golden-brown textured skin and a spiky green crown, centred and filling most of the frame, soft natural window light, real everyday snapshot, no text",
    decoys: ["jackfruit", "durian", "papaya", "coconut"] },
  { answer: "pomegranate", accepts: ["pomegranate"], category: "Food", search: "pomegranate fruit cut open",
    prompt: "Candid photograph of a pomegranate cut open on a white plate, deep red leathery skin and a burst of glistening crimson seeds, centred and filling most of the frame, soft natural window light, real everyday snapshot, no text",
    decoys: ["fig", "persimmon", "guava", "dragon fruit"] },
  { answer: "blueberry", accepts: ["blueberry", "blueberries"], category: "Food", search: "blueberries fruit",
    prompt: "Candid photograph of a pile of fresh blueberries in a pale ceramic bowl on a wooden table, deep blue-purple berries with a dusty bloom, centred and filling most of the frame, soft natural window light, real everyday snapshot, no text",
    decoys: ["blackcurrant", "elderberry", "bilberry", "sloe"] },
  { answer: "garlic", accepts: ["garlic"], category: "Food", search: "garlic bulb cloves",
    prompt: "Candid photograph of a bulb of garlic with a few loose cloves on a dark wooden chopping board, papery white and cream skin, centred and filling most of the frame, warm natural window light, real everyday snapshot, no text",
    decoys: ["shallot", "onion", "ginger", "leek"] },
  { answer: "chilli pepper", accepts: ["chilli pepper", "chili pepper", "chilli", "chili"], category: "Food", search: "red chili peppers",
    prompt: "Candid photograph of several bright red chilli peppers on a pale grey stone worktop, glossy scarlet skin and green stems, centred and filling most of the frame, natural window light, real everyday snapshot, no text",
    decoys: ["bell pepper", "jalapeno", "paprika", "cayenne"] },
  { answer: "mushroom", accepts: ["mushroom", "mushrooms"], category: "Food", search: "fly agaric mushroom",
    prompt: "Candid photograph of a red and white spotted fly agaric mushroom growing on green mossy forest floor, bright scarlet cap with white flecks and a pale stem, centred and filling most of the frame, dappled natural daylight, real snapshot, no text",
    decoys: ["toadstool", "truffle", "puffball", "chanterelle"] },
  { answer: "croissant", accepts: ["croissant"], category: "Food", search: "croissant pastry",
    prompt: "Candid photograph of a golden flaky croissant on a dark slate plate, crisp curved layers and a burnished brown crust, centred and filling most of the frame, warm morning window light in a cafe, real everyday snapshot, no text",
    decoys: ["baguette", "brioche", "danish pastry", "pain au chocolat"] },
  { answer: "sushi", accepts: ["sushi"], category: "Food", search: "sushi nigiri",
    prompt: "Candid photograph of several pieces of sushi on a dark slate plate, orange salmon and pink tuna on white rice wrapped with black nori, centred and filling most of the frame, natural light in a restaurant, real everyday snapshot, no text",
    decoys: ["sashimi", "onigiri", "dumpling", "spring roll"] },

  // ── Landmarks (8) ──
  { answer: "pyramids of giza", accepts: ["pyramids of giza", "great pyramid", "pyramids"], category: "Landmark", search: "Great Pyramid of Giza",
    prompt: "Photograph of the Great Pyramids of Giza rising from golden desert sand under a deep blue sky, massive triangular stone silhouettes, centred and filling most of the frame, bright natural daylight, real travel snapshot, no text",
    decoys: ["ziggurat", "mayan pyramid", "sphinx", "obelisk"] },
  { answer: "petra", accepts: ["petra", "al khazneh", "treasury"], category: "Landmark", search: "Al Khazneh Petra treasury",
    prompt: "Photograph of the rose-red rock-cut facade of Al-Khazneh at Petra, ornate columns carved into warm pink sandstone, framed by the dark canyon walls, centred and filling most of the frame, bright natural daylight, real travel snapshot, no text",
    decoys: ["abu simbel", "ellora caves", "luxor temple", "palmyra"] },
  { answer: "hagia sophia", accepts: ["hagia sophia"], category: "Landmark", search: "Hagia Sophia Istanbul exterior",
    prompt: "Photograph of the Hagia Sophia in Istanbul, huge terracotta-pink domed basilica with four pale stone minarets, set against a clear blue sky, centred and filling most of the frame, bright natural daylight, real travel snapshot, no text",
    decoys: ["blue mosque", "st peters basilica", "dome of the rock", "st marks basilica"] },
  { answer: "moai", accepts: ["moai", "easter island heads", "easter island"], category: "Landmark", search: "Moai Easter Island statues",
    prompt: "Photograph of the Moai stone head statues on Easter Island standing on green grass under a blue sky, tall dark grey volcanic stone figures with long faces, centred and filling most of the frame, bright natural daylight, real travel snapshot, no text",
    decoys: ["stonehenge", "totem pole", "terracotta army", "olmec head"] },
  { answer: "arc de triomphe", accepts: ["arc de triomphe"], category: "Landmark", search: "Arc de Triomphe Paris",
    prompt: "Photograph of the Arc de Triomphe in Paris, a huge pale cream stone triumphal arch with carved reliefs, set against a bright blue sky, centred and filling most of the frame, natural daylight, real travel snapshot, no text",
    decoys: ["brandenburg gate", "washington square arch", "marble arch", "india gate"] },
  { answer: "brandenburg gate", accepts: ["brandenburg gate"], category: "Landmark", search: "Brandenburg Gate Berlin",
    prompt: "Photograph of the Brandenburg Gate in Berlin, a neoclassical sandstone gateway with tall columns and the bronze green quadriga chariot on top, against a blue sky, centred and filling most of the frame, natural daylight, real travel snapshot, no text",
    decoys: ["arc de triomphe", "propylaea", "marble arch", "arch of titus"] },
  { answer: "buckingham palace", accepts: ["buckingham palace"], category: "Landmark", search: "Buckingham Palace facade",
    prompt: "Photograph of the facade of Buckingham Palace in London, a long pale grey stone building with rows of windows and gold-tipped black railings in front, under a blue sky, centred and filling most of the frame, natural daylight, real travel snapshot, no text",
    decoys: ["white house", "elysee palace", "schonbrunn", "windsor castle"] },
  { answer: "sphinx", accepts: ["sphinx", "great sphinx"], category: "Landmark", search: "Great Sphinx of Giza",
    prompt: "Photograph of the Great Sphinx of Giza, a huge weathered limestone lion-bodied statue with a human head, warm sandy stone against a deep blue sky, centred and filling most of the frame, bright natural daylight, real travel snapshot, no text",
    decoys: ["lamassu", "griffin", "moai", "colossus"] },

  // ── Plants (6) ──
  { answer: "bamboo", accepts: ["bamboo"], category: "Plant", search: "bamboo grove stalks",
    prompt: "Photograph of a dense grove of tall green bamboo stalks, vivid green segmented canes with narrow leaves, filling the frame, soft dappled daylight in a bamboo forest, real snapshot, no text",
    decoys: ["sugarcane", "reed", "papyrus", "rattan"] },
  { answer: "fern", accepts: ["fern"], category: "Plant", search: "fern frond unfurling",
    prompt: "Close-up photograph of a bright green fern frond unfurling, delicate symmetrical leaflets, set against dark brown forest floor so the green stands out, filling most of the frame, soft dappled daylight, real snapshot, no text",
    decoys: ["bracken", "palm frond", "moss", "cycad"] },
  { answer: "maple leaf", accepts: ["maple leaf", "maple"], category: "Plant", search: "red maple leaf autumn",
    prompt: "Close-up photograph of a single bright red maple leaf resting on damp dark grey stone, crisp pointed lobes and visible veins, centred and filling most of the frame, soft overcast autumn daylight, real snapshot, no text",
    decoys: ["oak leaf", "sycamore leaf", "ivy leaf", "plane leaf"] },
  { answer: "pine cone", accepts: ["pine cone", "pinecone"], category: "Plant", search: "pine cone conifer",
    prompt: "Close-up photograph of a brown pine cone lying on green moss, overlapping woody scales in a spiral, centred and filling most of the frame, soft natural woodland light, real snapshot, no text",
    decoys: ["acorn", "conker", "chestnut", "seed pod"] },
  { answer: "aloe vera", accepts: ["aloe vera", "aloe"], category: "Plant", search: "aloe vera plant",
    prompt: "Photograph of an aloe vera plant in a terracotta pot, thick fleshy blue-green spiked leaves, centred and filling most of the frame, set against a plain warm white wall, soft natural window light, real everyday snapshot, no text",
    decoys: ["agave", "yucca", "succulent", "cactus"] },
  { answer: "wisteria", accepts: ["wisteria"], category: "Plant", search: "wisteria flowers hanging",
    prompt: "Photograph of cascading purple wisteria flowers hanging from a wooden pergola, long drooping lilac blossom clusters against green leaves, filling most of the frame, soft natural daylight in a garden, real snapshot, no text",
    decoys: ["laburnum", "lilac", "bluebell", "foxglove"] },

  // ── Objects (6) ──
  { answer: "typewriter", accepts: ["typewriter"], category: "Object", search: "vintage typewriter",
    prompt: "Candid photograph of a vintage black typewriter on a wooden desk, round metal keys with white letters and a chrome carriage, centred and filling most of the frame, warm natural window light, real everyday snapshot, no text",
    decoys: ["cash register", "adding machine", "printing press", "telegraph"] },
  { answer: "rotary telephone", accepts: ["rotary telephone", "telephone", "rotary phone"], category: "Object", search: "rotary dial telephone",
    prompt: "Candid photograph of a red vintage rotary dial telephone on a pale wooden table, glossy red body, circular finger dial and a curved handset, centred and filling most of the frame, warm natural window light, real everyday snapshot, no text",
    decoys: ["payphone", "intercom", "switchboard", "radio"] },
  { answer: "teapot", accepts: ["teapot"], category: "Object", search: "ceramic teapot",
    prompt: "Candid photograph of a blue ceramic teapot on a wooden kitchen table, rounded glazed body with a curved spout and handle, centred and filling most of the frame, warm natural window light, real everyday snapshot, no text",
    decoys: ["kettle", "coffee pot", "watering can", "jug"] },
  { answer: "binoculars", accepts: ["binoculars"], category: "Object", search: "binoculars",
    prompt: "Candid photograph of a pair of black binoculars resting on a mossy green log outdoors, twin barrels with glass lenses catching the light, centred and filling most of the frame, natural daylight, real everyday snapshot, no text",
    decoys: ["telescope", "camera", "microscope", "periscope"] },
  { answer: "anchor", accepts: ["anchor"], category: "Object", search: "ship anchor",
    prompt: "Photograph of a large rusted iron ship's anchor resting on a stone harbour wall, dark orange-brown rusted metal with curved flukes, centred and filling most of the frame, bright coastal daylight with blue sea behind, real snapshot, no text",
    decoys: ["hook", "grappling hook", "chain", "harpoon"] },
  { answer: "lantern", accepts: ["lantern"], category: "Object", search: "hanging lantern lamp",
    prompt: "Candid photograph of a warm glowing orange paper lantern hanging outdoors at dusk, softly lit from within, against a deep blue evening sky, centred and filling most of the frame, real snapshot, no text",
    decoys: ["torch", "candle", "oil lamp", "chandelier"] },

  // ── Vehicles (5) ──
  { answer: "tram", accepts: ["tram", "streetcar"], category: "Vehicle", search: "tram streetcar city",
    prompt: "Candid photograph of a bright yellow tram on rails in a European city street, boxy carriage with large windows and overhead cables, centred and filling most of the frame, grey cobbled street and buildings behind, natural daylight, real travel snapshot, no text",
    decoys: ["trolleybus", "funicular", "monorail", "cable car"] },
  { answer: "canoe", accepts: ["canoe"], category: "Vehicle", search: "wooden canoe lake",
    prompt: "Photograph of a red wooden canoe floating on a calm blue lake, slender curved hull with a wooden paddle across it, centred and filling most of the frame, green forested shore behind, bright natural daylight, real snapshot, no text",
    decoys: ["kayak", "rowboat", "punt", "raft"] },
  { answer: "skateboard", accepts: ["skateboard"], category: "Vehicle", search: "skateboard deck wheels",
    prompt: "Candid photograph of a skateboard with a bright blue deck lying on grey concrete, orange wheels and metal trucks visible, centred and filling most of the frame, natural daylight at a skate park, real everyday snapshot, no text",
    decoys: ["longboard", "scooter", "roller skates", "snowboard"] },
  { answer: "forklift", accepts: ["forklift"], category: "Vehicle", search: "forklift truck warehouse",
    prompt: "Photograph of a bright yellow forklift truck in a warehouse, boxy body with a tall mast and two steel forks at the front, centred and filling most of the frame, grey concrete floor and shelving behind, natural light, real snapshot, no text",
    decoys: ["bulldozer", "excavator", "crane", "tractor"] },
  { answer: "cable car", accepts: ["cable car", "gondola lift"], category: "Vehicle", search: "cable car mountain aerial",
    prompt: "Photograph of a red cable car cabin hanging from a steel cable high above a green alpine valley, boxy glazed gondola, centred and filling most of the frame, blue sky and green mountains behind, bright daylight, real travel snapshot, no text",
    decoys: ["chairlift", "funicular", "ski lift", "tram"] },

  // ── Insects (4) ──
  { answer: "ant", accepts: ["ant"], category: "Insect", search: "ant macro",
    prompt: "Macro photograph of a single reddish-brown ant on a bright green leaf, segmented body, thin legs and antennae clearly visible, centred and filling most of the frame, sharp focus, natural daylight, real macro snapshot, no text",
    decoys: ["termite", "beetle", "weevil", "aphid"] },
  { answer: "wasp", accepts: ["wasp"], category: "Insect", search: "wasp macro yellow",
    prompt: "Macro photograph of a wasp on a green leaf, bold yellow and black striped body, translucent wings and slender waist, centred and filling most of the frame, sharp focus, natural daylight, real macro snapshot, no text",
    decoys: ["hornet", "bee", "yellowjacket", "hoverfly"] },
  { answer: "spider", accepts: ["spider"], category: "Insect", search: "garden spider web",
    prompt: "Macro photograph of a garden spider sitting in the centre of its web, yellow and black patterned body with long legs, set against a dark blurred green background, centred and filling most of the frame, natural daylight, real macro snapshot, no text",
    decoys: ["tarantula", "harvestman", "scorpion", "tick"] },
  { answer: "scorpion", accepts: ["scorpion"], category: "Insect", search: "scorpion",
    prompt: "Macro photograph of a dark brown scorpion on pale golden desert sand, curved segmented tail with a sting raised and two front pincers, centred and filling most of the frame, sharp focus, bright natural daylight, real macro snapshot, no text",
    decoys: ["spider", "crab", "lobster", "crayfish"] },

  // ── Instruments (4) ──
  { answer: "banjo", accepts: ["banjo"], category: "Instrument", search: "banjo instrument",
    prompt: "Candid photograph of a banjo resting on green grass outdoors, round white drum-like body with a metal rim and a long wooden neck with strings, centred and filling most of the frame, natural daylight, real everyday snapshot, no text",
    decoys: ["mandolin", "ukulele", "lute", "sitar"] },
  { answer: "harmonica", accepts: ["harmonica", "mouth organ"], category: "Instrument", search: "harmonica",
    prompt: "Close-up photograph of a silver harmonica lying on a deep red cloth, chrome cover plates with rows of holes, centred and filling most of the frame, warm natural light, real everyday snapshot, no text",
    decoys: ["kazoo", "melodica", "accordion", "pan flute"] },
  // NEVER put a person in a generated image. The first attempt here said only
  // "held upright", the model added a piper, and it came back HEADLESS. Human
  // anatomy is where generation fails hardest, and the person is not the answer
  // anyway — the instrument is.
  { answer: "bagpipes", accepts: ["bagpipes"], category: "Instrument", search: "bagpipes highland",
    prompt: "Photograph of a set of Scottish highland bagpipes lying on green grass beside a low stone wall, red tartan bag and dark wooden drone pipes with ivory-coloured mounts fanned out, centred and filling most of the frame, natural daylight in the Scottish hills, real snapshot, absolutely no people, no hands, no human figures, no text",
    decoys: ["oboe", "clarinet", "shawm", "uilleann pipes"] },
  { answer: "xylophone", accepts: ["xylophone"], category: "Instrument", search: "xylophone bars mallets",
    prompt: "Photograph of a xylophone with rows of pale wooden bars and two mallets resting on it, dark frame beneath, shot from above, centred and filling most of the frame, natural light, real snapshot, no text",
    decoys: ["marimba", "glockenspiel", "vibraphone", "celesta"] },

  // ── Space (3) ──
  { answer: "solar eclipse", accepts: ["solar eclipse", "eclipse"], category: "Space", search: "total solar eclipse corona",
    prompt: "Photograph of a total solar eclipse, a black disc of the moon fully covering the sun with a glowing white corona flaring around it, against a pitch black sky, centred and filling most of the frame, real astronomy photograph, no text",
    decoys: ["lunar eclipse", "sunspot", "corona", "black hole"] },
  { answer: "neptune", accepts: ["neptune"], category: "Space", search: "Neptune planet Voyager",
    prompt: "Astronomical image of the planet Neptune, a deep vivid blue sphere with faint white cloud streaks, against the black of space, centred and filling most of the frame, real space photograph, no text",
    decoys: ["uranus", "jupiter", "saturn", "earth"] },
  { answer: "comet", accepts: ["comet"], category: "Space", search: "comet tail",
    prompt: "Astronomical photograph of a comet in the night sky, a bright glowing white-blue nucleus with a long sweeping tail streaming behind it, against a deep dark starry sky, centred and filling most of the frame, real astrophotography, no text",
    decoys: ["meteor", "asteroid", "shooting star", "nebula"] },

  // ── Natural Wonders (3) ──
  { answer: "volcano", accepts: ["volcano"], category: "Natural Wonder", search: "volcano erupting lava",
    prompt: "Photograph of a volcano erupting at night, bright orange molten lava fountaining from the dark cone with glowing red rivers running down its black slopes, centred and filling most of the frame, real photograph, no text",
    decoys: ["geyser", "crater", "caldera", "fumarole"] },
  { answer: "geyser", accepts: ["geyser"], category: "Natural Wonder", search: "geyser erupting",
    prompt: "Photograph of a geyser erupting, a tall white column of steam and water bursting upward from orange mineral rock, against a clear blue sky, centred and filling most of the frame, bright natural daylight, real snapshot, no text",
    decoys: ["hot spring", "volcano", "fumarole", "waterfall"] },
  { answer: "glacier", accepts: ["glacier"], category: "Natural Wonder", search: "glacier ice blue",
    prompt: "Photograph of a glacier, a vast wall of cracked blue-white ice meeting dark grey rock and deep blue water, centred and filling most of the frame, bright natural daylight, real travel snapshot, no text",
    decoys: ["iceberg", "ice shelf", "snowdrift", "fjord"] },

  // ── Flags (3) ──
  { answer: "italy", accepts: ["italy", "italian flag", "flag of italy"], category: "Flag", search: "Flag of Italy",
    prompt: "The flag of Italy, three equal vertical bands of green, white and red, filling the whole frame, flat and clear, no text",
    decoys: ["ireland", "mexico", "hungary", "bulgaria"] },
  { answer: "mexico", accepts: ["mexico", "mexican flag", "flag of mexico"], category: "Flag", search: "Flag of Mexico",
    prompt: "The flag of Mexico, three equal vertical bands of green, white and red with a detailed eagle and serpent coat of arms in the centre, filling the whole frame, flat and clear, no text",
    decoys: ["italy", "peru", "colombia", "portugal"] },
  { answer: "nepal", accepts: ["nepal", "nepalese flag", "flag of nepal"], category: "Flag", search: "Flag of Nepal",
    prompt: "The flag of Nepal, a unique double-pennant shape made of two stacked crimson triangles with blue borders, showing a white moon and a white sun, filling the frame, flat and clear, no text",
    decoys: ["bhutan", "switzerland", "denmark", "tibet"] },

  // ── Paintings (2, public domain) ──
  { answer: "the scream", accepts: ["the scream", "scream"], category: "Painting", search: "The Scream Munch",
    prompt: null, // public-domain artwork: never generate a fake substitute
    decoys: ["the shriek", "anxiety", "despair", "melancholy"] },
  { answer: "the kiss", accepts: ["the kiss", "klimt the kiss"], category: "Painting", search: "The Kiss Klimt 1908",
    prompt: null,
    decoys: ["the embrace", "danae", "judith", "the lovers"] },
];
