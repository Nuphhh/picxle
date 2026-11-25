// ADAPTER: ShareImageRenderer using the `sharp` image library (server only).
import sharp from "sharp";
import type { ShareImageRenderer } from "@/src/application/ports";
import { RES_STEPS } from "@/src/domain/rules";

const SIZE = 1200; // square, full-bleed link preview
const RES = RES_STEPS[0]; // the game's first stage (8)
const MASTER = 440; // the game draws every image onto a 440×440 square first
const CREAM = { r: 237, g: 232, b: 222 };
const DARK_TILE = { r: 0x17, g: 0x13, b: 0x0d };

// Turn RES×RES RGB pixels into crisp SIZE×SIZE blocks — the server-side
// version of the canvas's imageSmoothingEnabled = false.
const upscale = async (raw: Uint8Array): Promise<Uint8Array> =>
  sharp(raw, { raw: { width: RES, height: RES, channels: 3 } })
    .resize(SIZE, SIZE, { kernel: "nearest" })
    .png()
    .toBuffer();

export const sharpShareRenderer: ShareImageRenderer = {
  fromTeaser: upscale,

  async fromImage(bytes, fit) {
    const master = await sharp(bytes)
      .resize(MASTER, MASTER, { fit, position: "centre", background: CREAM })
      .flatten({ background: CREAM })
      .toBuffer();
    const small = await sharp(master).resize(RES, RES, { fit: "fill" }).removeAlpha().raw().toBuffer();
    return upscale(small);
  },

  blank: () => sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: DARK_TILE } }).png().toBuffer(),
};
