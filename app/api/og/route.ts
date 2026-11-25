// Link-preview image: the puzzle's true 8×8 first stage.
//   /api/og              -> today's puzzle
//   /api/og?d=2026-07-01 -> that day's puzzle
// Logic: src/application/share-image.ts. teasers.json (next to this file) is
// written by scripts/build-teasers.mjs.
import { shareImageHandler } from "@/src/composition/share-image";

export const runtime = "nodejs";

export const GET = shareImageHandler;
