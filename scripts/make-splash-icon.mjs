// Build the splash icon: recolor the launcher art (cream X + blue pixel on dark)
// into a DARK X + blue pixel on TRANSPARENT, so it sits cleanly on the cream
// (#faf6ef) light-mode splash background. Output -> android drawable-nodpi.
import sharp from "sharp";

const SRC = "./assets/icon-foreground.png"; // cream X + blue pixel on #18120C
const OUT = "./android/app/src/main/res/drawable-nodpi/splash_icon.png";

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info; // channels = 4
const out = Buffer.alloc(data.length);

const DARK = [28, 18, 8];      // #1c1208 light-mode foreground
const BLUE = [59, 130, 246];   // #3b82f6 accent
for (let i = 0; i < data.length; i += channels) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const isBlue = b > 140 && b > r + 40 && b > g + 20;
  if (isBlue) {
    out[i] = BLUE[0]; out[i + 1] = BLUE[1]; out[i + 2] = BLUE[2]; out[i + 3] = 255;
  } else if (lum < 55) {
    out[i] = DARK[0]; out[i + 1] = DARK[1]; out[i + 2] = DARK[2]; out[i + 3] = 0; // dark bg -> transparent
  } else {
    // cream X -> dark, alpha ramps with luminance for smooth edges
    const a = lum >= 90 ? 255 : Math.max(0, Math.round(((lum - 55) / 35) * 255));
    out[i] = DARK[0]; out[i + 1] = DARK[1]; out[i + 2] = DARK[2]; out[i + 3] = a;
  }
}

await sharp(out, { raw: { width, height, channels } }).png().toFile(OUT);
console.log(`wrote ${OUT} (${width}x${height})`);
