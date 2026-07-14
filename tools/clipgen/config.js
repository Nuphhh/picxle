// Everything you'll want to tweak while you find the format. No logic here.

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
};

// Brand palette — the app's DEFAULT (light) theme, straight from app/globals.css.
//
// The variable names read backwards: --ink is the light BACKGROUND and --cream is
// the dark TEXT, because the light theme is the default. Taking them at face value
// gives you an inverted, off-brand card.
export const COLOUR = {
  bg: "#faf6ef",        // --ink   : the page background
  panel: "#ede8de",     // --ink2  : raised surface behind the image
  text: "#1c1208",      // --cream : body/headline text
  textDim: "#7a6548",   // --creamDim
  blue: "#3b82f6",      // --blue  : the X in the wordmark, and the accent
  green: "#16a34a",     // --green
  coral: "#c23b3b",     // --coral
  line: "#d4c4b0",      // --line
};

export const FONT = {
  display: "fonts/BricolageGrotesque-ExtraBold.ttf", // wordmark + headlines
  mono: "fonts/SpaceMono-Bold.ttf",                  // labels, counters, CTA
  monoLight: "fonts/SpaceMono-Regular.ttf",
};

// Copy. Keep the hook short — it has to land in under a second on a scroll.
export const COPY = {
  hook: "Can you guess it?",
  categoryPrefix: "CATEGORY",
  guessLabel: (n, total) => `GUESS ${n}/${total}`,
  pause: "PAUSE IF YOU KNOW IT",
  revealKicker: "YESTERDAY'S PICXLE",
  // End card. Answer text is deliberately NOT drawn on the reveal frame: platforms
  // often lift a late frame as the grid thumbnail, which would spoil the puzzle in
  // the feed before anyone taps — and leaving it unsaid is what makes people
  // comment their guess. The answer goes in the caption instead.
  ctaTitle: "Play today's puzzle",
  ctaUrl: "picxle.vercel.app",
  footerSep: "·", // brand line on the puzzle beats: PICXLE · picxle.vercel.app
};

// --promo: an evergreen advert, not a daily post.
//
// The daily clip is tied to a specific day ("YESTERDAY'S PICXLE"), which is
// meaningless in an ad that runs for weeks. This version sells the mechanic
// instead: one image, five guesses, it sharpens every time you miss.
export const PROMO = {
  hook: "Can you name it?",
  revealKicker: "A NEW PUZZLE EVERY DAY",
  pause: "PAUSE IF YOU KNOW IT",
  ctaTitle: "Play the daily puzzle",
  caption: (answer, category) => [
    `One image. Five guesses. It sharpens every time you miss.`,
    ``,
    `Could you have got ${answer}? A new picture every day.`,
    ``,
    `Play free at picxle.vercel.app`,
    category ? `` : null,
  ].filter((l) => l !== null),
};

// Beat timings in seconds.
//
// The holds ACCELERATE. Every stage previously held for the same 1.6s, which beat
// like a metronome and was the real reason the clip felt flat — not a shortage of
// effects. A long dwell on stage 1 gives people time to actually look and commit to
// a guess; each stage after that is shorter, so the clip gathers pace and pulls
// into the reveal.
export const BEATS = {
  hook: 2.8,                       // stage 1 — longest hold: this is where they decide to stay
  stages: [1.7, 1.5, 1.35, 1.2],   // stages 2..5, tightening
  pause: 1.5,                      // "pause if you know it", on the last pixelated stage
  reveal: 2.8,                     // fully sharp, no answer text
  endCard: 2.0,

  // Each beat opens with a quick flash, mirroring the game's own canvas flash on
  // sharpen. A cross-dissolve would blend the pixel blocks into mush, and the hard
  // blocks ARE the brand — so the punch comes from a flash, never a blend.
  flash: 0.10,
  revealFlash: 0.22,               // the payoff gets a bigger one
};

// Layout of the 1080x1920 frame.
//
// Everything is composed inside the SAFE AREA, not the raw frame: TikTok and Reels
// paint their own UI over roughly the top 130px and the bottom 320px (caption,
// buttons), so anything down there is sat on by the interface. The block is
// centred within 130..1600, which is why it does not look centred if you measure
// against the full 1920.
export const LAYOUT = {
  safeTop: 130,
  safeBottom: 1600,

  imageSize: 1000,    // the puzzle is the point — near edge to edge
  imageTop: 380,
  cornerRadius: 28,
  scrimOpacity: 0.55, // behind text, so it reads on both light and dark images

  titleY: 190,        // hook headline (drawtext y = top of the text box)
  categoryY: 300,
  barsBaseline: 1470, // SHARPNESS bars sit on this line and grow upward
  counterY: 1495,     // label under the bars
  footerY: 1560,      // brand line — see COPY.footer
};

// The game's SHARPNESS row, scaled up for video: five bars of ascending height that
// fill as the picture resolves. Lifted from PicxleGame.jsx (width 20, heights
// 8,11,14,17,20) so the clip shows the same progress cue as the real thing.
export const BARS = {
  width: 34,
  gap: 14,
  heights: [22, 30, 38, 46, 54],
};
