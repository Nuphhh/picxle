// The signature mechanic, on a <canvas>.
//
// 1. prepareMaster: draw the downloaded image ONCE onto a 440×440 "master"
//    canvas — flags shrunk to fit whole, everything else centre-cropped square.
// 2. drawPixelated: shrink the master to a tiny N×N canvas (that averages the
//    colours into N×N blocks), then stretch it back up with smoothing OFF, so
//    each block stays a crisp square. N grows with every wrong guess.
import { imageFit } from "@/src/domain/puzzle";
import { FULL_RES } from "@/src/domain/rules";

export const MASTER_SIZE = 440;

/** Source rectangle (s*) and destination rectangle (d*) for drawImage. */
export interface DrawRect {
  sx: number; sy: number; sw: number; sh: number;
  dx: number; dy: number; dw: number; dh: number;
}

/**
 * Where to copy from and to, for an image of `w`×`h` on a `size`×`size` square.
 * Pure arithmetic, kept separate from the drawing so it can be tested.
 */
export function fitRect(w: number, h: number, fit: "contain" | "cover", size = MASTER_SIZE): DrawRect {
  if (fit === "contain") {
    // Scale so the LONGER side fits; the rest is empty margin. Rounded so the
    // flag's edges land on whole pixels and stay sharp.
    const scale = Math.min(size / w, size / h);
    const dw = Math.round(w * scale);
    const dh = Math.round(h * scale);
    return { sx: 0, sy: 0, sw: w, sh: h, dx: Math.round((size - dw) / 2), dy: Math.round((size - dh) / 2), dw, dh };
  }
  // Take the biggest centred square from the source and fill the canvas with it.
  const side = Math.min(w, h);
  return { sx: (w - side) / 2, sy: (h - side) / 2, sw: side, sh: side, dx: 0, dy: 0, dw: size, dh: size };
}

/** Draw a loaded image onto a fresh master canvas. */
export function prepareMaster(img: HTMLImageElement, category: string): HTMLCanvasElement {
  const master = document.createElement("canvas");
  master.width = MASTER_SIZE;
  master.height = MASTER_SIZE;
  const ctx = master.getContext("2d");
  if (!ctx) return master;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const r = fitRect(img.naturalWidth, img.naturalHeight, imageFit(category));
  ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
  return master;
}

/** Paint `src` onto `target` as a `res`×`res` grid (or smoothly at FULL_RES). */
export function drawPixelated(target: HTMLCanvasElement, src: CanvasImageSource, res: number): void {
  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, target.width, target.height);
  if (res === FULL_RES) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, target.width, target.height);
    return;
  }
  const tiny = document.createElement("canvas");
  tiny.width = res;
  tiny.height = res;
  const tctx = tiny.getContext("2d");
  if (!tctx) return;
  tctx.imageSmoothingEnabled = true; // average the colours when shrinking...
  tctx.drawImage(src, 0, 0, res, res);
  ctx.imageSmoothingEnabled = false; // ...but keep hard block edges when enlarging
  ctx.drawImage(tiny, 0, 0, res, res, 0, 0, target.width, target.height);
}

/** The "image failed to load" placeholder. */
export function drawImageError(target: HTMLCanvasElement): void {
  const ctx = target.getContext("2d");
  if (!ctx) return;
  // Canvas needs concrete colours, so resolve the theme vars at draw time.
  const cs = getComputedStyle(document.documentElement);
  ctx.fillStyle = cs.getPropertyValue("--ink2").trim() || "#ede8de";
  ctx.fillRect(0, 0, target.width, target.height);
  ctx.fillStyle = cs.getPropertyValue("--creamDim").trim() || "#7a6548";
  ctx.font = "13px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("image failed to load", target.width / 2, target.height / 2);
}
