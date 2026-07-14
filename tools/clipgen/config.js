// Everything you'll want to tweak while you find the format. No logic here.

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
};

// Brand palette — lifted from app/globals.css. NOTE the app's variable names read
// inverted (--ink is the light background, --cream is the dark text) because the
// light theme is the default; these are the ACTUAL colours.
export const COLOUR = {
  bg: "#17130d",        // dark backdrop — video reads better dark on every feed
  panel: "#231c13",     // image panel surround
  text: "#faf6ef",      // cream
  textDim: "#a08a68",
  blue: "#3b82f6",      // the X in the wordmark, and the accent
  green: "#16a34a",
  coral: "#c23b3b",
  line: "#3a2f22",
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
export const LAYOUT = {
  imageSize: 980,     // the puzzle is a centred square
  imageTop: 470,      // leaves room for hook above, counter below
  cornerRadius: 28,
  scrimOpacity: 0.55, // behind text, so it reads on both light and dark images
};
