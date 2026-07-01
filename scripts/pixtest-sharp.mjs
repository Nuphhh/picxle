import sharp from "sharp";
const OUT = "C:/Users/Nath/AppData/Local/Temp/claude/C--Users-Nath/d16d015c-ca8e-4839-a477-0a5c16d09a93/scratchpad";
const today = await fetch("https://picxle.vercel.app/api/puzzle/today").then((r) => r.json());
const buf = Buffer.from(await fetch(today.image_src, { headers: { "User-Agent": "px-test" } }).then((r) => r.arrayBuffer()));
// TWO passes: sharp collapses chained .resize() calls, so downscale to a buffer first...
const small = await sharp(buf).resize(8, 8, { fit: "fill" }).png().toBuffer();
// ...then upscale that 8x8 buffer with crisp nearest-neighbour.
await sharp(small).resize(512, 512, { kernel: "nearest" }).png().toFile(`${OUT}/px-nearest.png`);
console.log("wrote px-nearest.png (8x8 crisp)");
