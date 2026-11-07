// Everything you'll want to tweak while you find the format. No logic here.

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
};

// The GIF is a SEPARATE RENDER, not a transcode of the vertical video.
//
// Two reasons, both of which the vertical clip gets wrong as a GIF:
//   1. YOU CANNOT PAUSE A GIF. It autoplays, loops, and has no controls on most
//      surfaces, so a "PAUSE IF YOU KNOW IT" beat instructs the viewer to do
//      something they physically cannot do. That beat is dropped entirely; the loop
//      is the second look.
//   2. GIFs live on DESKTOP surfaces — X, Reddit, Discord, a README, a press kit —
//      where a 9:16 frame is a tall skinny sliver with the puzzle tiny in the
//      middle. Square uses the space.
export const GIF = {
  width: 1080,
  height: 1080,
  fps: 15,
  scale: 600,      // final GIF is 600x600 — bigger balloons the file size
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
  // The default (no-reveal) ending. No emoji in the video text — the bundled fonts
  // have no 👇 glyph, so a downward chevron is drawn as vector instead; the caption
  // keeps the emoji.
  // THE ASK MUST ASK THEM TO WRITE — IT MUST NEVER PROMISE A REPLY.
  // This used to read "Answer in the comments", which a viewer reads as "the answer is
  // already down there". It is not: Buffer's firstComment is a PAID feature on this
  // account, so nothing posts it unattended and the post reads as abandoned. The
  // Sept 2026 timing test ran the asking form on all nine clips and took 13 comments
  // across 9 posts against 3 across 10 in August. Do not "tidy" this back to one line.
  // Two lines because the full phrase overflows 1080px at display ExtraBold 60.
  commentCTA: "Leave your answer",
  commentCTA2: "in the comments",
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

  // NOTE the caption does NOT name the answer, unlike the daily post.
  //
  // The caption sits directly under the video and is read BEFORE people watch. On a
  // daily post naming the answer is fine — it is yesterday's puzzle, already public,
  // and it drives the "did you get it?" reply. In an ADVERT, whose whole job is to
  // make someone try to guess, printing the answer beside the video defeats the
  // hook entirely.
  caption: () => [
    `One image. Five guesses. It sharpens every time you miss.`,
    ``,
    `Did you get it before the last guess? A new picture every day.`,
    ``,
    `Play free at picxle.vercel.app`,
  ],
};

// Beat timings in seconds.
//
// The holds ACCELERATE — a long dwell on the first stage, tightening after — so the
// clip gathers pace instead of ticking like a metronome.
//
// TikTok target (the DEFAULT) does NOT reveal the answer: it plays the first stages
// and holds on the last pixelated one with a "comment your guess" prompt. Stopping
// short is what pushes people into the comments and keeps completion-rate high — a
// full reveal + logo card is dead air at the exact point TikTok measures whether
// they watched to the end. --reveal restores the full pause + reveal + end card.
export const BEATS = {
  // First (blockiest) stage — still the longest hold, but only just. A viewer decides
  // whether to keep watching at roughly 1.7s, and at 3.0s NOTHING MOVED until well
  // after that: the first sharpen landed outside the window that decides watch time.
  // 2.0 puts the first flash+sharpen just inside it. Do not go below ~1.9 — the hold
  // has to stay longer than stages[0] or the clip opens tighter than it continues,
  // which reads as a stutter rather than as gathering pace.
  hook: 2.0,                       // frame 0 is already full — see the flash note below
  stages: [1.9, 1.7, 1.5, 1.3],    // sharpen transitions, tightening
  finalHold: 3.0,                  // DEFAULT ending: held on the last pixelated stage with the comment CTA
  pause: 1.5,                      // --reveal only: "pause if you know it"
  reveal: 2.8,                     // --reveal only: fully sharp, no answer text
  endCard: 2.0,                    // --reveal only

  // Each sharpen opens with a quick flash, mirroring the game's own canvas flash. A
  // cross-dissolve would blend the pixel blocks into mush, and the hard blocks ARE
  // the brand — so the punch is a flash, never a blend. The HOOK beat gets flash 0:
  // frame 0 must already contain the puzzle, or TikTok shows a blank opening and
  // kills the hook.
  flash: 0.09,
  revealFlash: 0.2,
};

// Multi-subject "gauntlet" clips: the SPEED ROUND (five mixed subjects) and the
// CATEGORY RUN (five from one category).
//
// This is a genuinely different format from the daily, not a re-cut of it. The daily
// teases ONE subject across five sharpens and deliberately never resolves it. A gauntlet
// fires through FIVE subjects and answers each one on the spot.
//
// The per-subject reveal is the whole point. Withholding the answer works once, at the
// end of a slow clip, where it converts into a comment. Withholding it five times in
// eighteen seconds just reads as a cheat, and there is nowhere to put five answers that
// a viewer could match back to five images. Resolving each one immediately also gives
// the clip its rhythm: guess, snap, guess, snap.
export const GAUNTLET = {
  subjects: 5,
  resIndex: [0, 2],   // into RES_STEPS: 8x8, then 19x19 — one sharpen per subject, not four
  blocky: 1.15,       // hold on the 8x8 — the guess window
  mid: 1.15,          // hold on the 19x19 — the "oh, it's…" window
  answer: 0.95,       // sharp image + the name. Short: the payoff reads instantly
  endCard: 1.8,
  flash: 0.09,
  revealFlash: 0.2,
  // 5 x (1.15 + 1.15 + 0.95) + 1.8 = 18.05s. Deliberately under 20s — Reels and Shorts
  // both measure completion, and five subjects is already the most a viewer will track.
};

// H.264 export tuned for platform upload. Bitrate-based (not CRF) so the source
// TikTok re-encodes from is high quality; high profile / level 4.0 for broad
// compatibility. Prefer H.264 over HEVC — some upload paths choke on HEVC.
export const ENCODE = {
  bitrate: "10M", maxrate: "12M", bufsize: "16M",
  profile: "high", level: "4.0",
};

// loudnorm target when audio is baked in (platform norm ≈ -14 LUFS). Most posts go
// out SILENT so sound can be added natively in TikTok; this only applies to --music.
export const LOUDNORM = "loudnorm=I=-14:LRA=11:TP=-1.0";

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

// Square layout for the GIF. Same furniture, tighter — there is no 9:16 dead space
// to fill, so the image dominates and the text hugs it.
export const GIF_LAYOUT = {
  imageSize: 720,
  imageTop: 190,
  cornerRadius: 24,
  scrimOpacity: 0.55,
  titleY: 70,
  categoryY: 140,
  barsBaseline: 985,
  counterY: 1005,
  footerY: 1042,
};

// GIF beats: no pause (you cannot pause a GIF — the LOOP is the second look), and
// a longer hold on the reveal so the payoff lands before it cycles back.
export const GIF_BEATS = {
  hook: 2.4,
  stages: [1.4, 1.3, 1.2, 1.1],
  reveal: 2.6,
  endCard: 1.8,
  flash: 0.09,
  revealFlash: 0.2,
};

// --music. Drop a track in tools/clipgen/music/ and pass --music <file>.
//
// See music/README.md before you use anything: "copyright free" almost never means
// no conditions. The track is looped if it is shorter than the clip, trimmed to
// length, and faded out under the end card.
export const MUSIC = {
  volume: 0.8,   // 0..1 — there is no voiceover to duck under, so it can sit up
  fadeOut: 1.6,  // seconds, ending on the last frame
  fadeIn: 0.3,
};

// The game's SHARPNESS row, scaled up for video: five bars of ascending height that
// fill as the picture resolves. Lifted from PicxleGame.jsx (width 20, heights
// 8,11,14,17,20) so the clip shows the same progress cue as the real thing.
export const BARS = {
  width: 34,
  gap: 14,
  heights: [22, 30, 38, 46, 54],
};
