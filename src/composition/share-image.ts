// COMPOSITION ROOT for /api/og only. Kept apart from ./server.ts so that
// `sharp` (a native image library) and the teasers file are bundled into this
// one serverless function rather than every API route.
import teasers from "@/app/api/og/teasers.json";
import { createShareImageHandler } from "@/src/adapters/http/handlers";
import { httpImageFetcher } from "@/src/adapters/images/http-image-fetcher";
import { jsonTeaserStore } from "@/src/adapters/images/json-teaser-store";
import { sharpShareRenderer } from "@/src/adapters/images/sharp-renderer";
import { serverDeps } from "./server";

export const shareImageHandler = createShareImageHandler({
  puzzles: serverDeps.puzzles,
  clock: serverDeps.clock,
  images: httpImageFetcher("PicxleGame/1.0 (og; picxlebypenrose@gmail.com)"),
  teasers: jsonTeaserStore(teasers),
  renderer: sharpShareRenderer,
});
