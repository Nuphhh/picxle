// USE CASE: the link-preview image for a day — that puzzle's TRUE first stage
// (8×8), byte-identical to what the game shows on guess one. Safe to expose:
// 8×8 never reveals the answer.
//
// The exact block colours come from Chrome's canvas downscaler, which
// server-side tools can't reproduce, so they're precomputed per puzzle
// (scripts/build-teasers.mjs) and served by the TeaserStore.
import { isIsoDay, utcDay } from "@/src/domain/dates";
import { imageFit } from "@/src/domain/puzzle";
import type { Clock, ImageFetcher, PuzzleRepository, ShareImageRenderer, TeaserStore } from "./ports";

export async function getShareImage(
  deps: {
    teasers: TeaserStore;
    renderer: ShareImageRenderer;
    puzzles: PuzzleRepository;
    images: ImageFetcher;
    clock: Clock;
  },
  dayParam: string | null,
): Promise<Uint8Array> {
  const day = dayParam || utcDay(deps.clock.now());
  try {
    // Anything that isn't a real date just gets the plain tile.
    if (!isIsoDay(day)) return await deps.renderer.blank();

    const teaser = deps.teasers.get(day);
    if (teaser) return await deps.renderer.fromTeaser(teaser);

    // Fallback only for dates missing a teaser (shouldn't happen for real
    // puzzles): best-effort pixelation. Not colour-identical to the game.
    const puzzle = await deps.puzzles.imageByDate(day);
    if (puzzle?.imageSrc) {
      const upstream = await deps.images.fetch(puzzle.imageSrc);
      if (upstream) return await deps.renderer.fromImage(await upstream.bytes(), imageFit(puzzle.category));
    }
  } catch {
    /* fall through to a plain tile */
  }
  return deps.renderer.blank();
}
