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

// Beat timings in seconds. Total should land ~13-15s.
export const BEATS = {
  hook: 2.0,      // stage 1, most pixelated, with the hook
  stage: 1.6,     // each of stages 2..5
  pause: 1.3,     // "pause if you know it", held on the last pixelated stage
  reveal: 2.6,    // fully sharp image, no answer text
  endCard: 2.0,
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
  counterY: 1420,     // just under the image
  footerY: 1500,      // brand line — see COPY.footer
};
