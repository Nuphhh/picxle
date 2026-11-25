// USE CASE: fetch a puzzle's image without telling the browser where it came from.
//
// Image addresses give the answer away (".../commons/d/df/Axolotl.jpg"), so
// the browser only ever asks for the image by puzzle ID, and the server fetches
// the real file and passes the bytes straight through, unchanged. (The share
// teasers were built from those exact originals — resizing here would make the
// first stage subtly different from the share image.)
import { utcDay } from "@/src/domain/dates";
import { isUuid } from "@/src/domain/ids";
import type { Clock, ImageFetcher, PuzzleRepository } from "./ports";

export type PuzzleImageResult =
  | { kind: "image"; contentType: string; body: ReadableStream<Uint8Array> | null }
  | { kind: "invalid" }
  | { kind: "not-found" }
  | { kind: "unavailable" };

export async function getPuzzleImage(
  deps: { puzzles: PuzzleRepository; images: ImageFetcher; clock: Clock },
  puzzleId: unknown,
): Promise<PuzzleImageResult> {
  if (!isUuid(puzzleId)) return { kind: "invalid" };

  const puzzle = await deps.puzzles.image(puzzleId);
  // Future puzzles are never served — not even pixelated, since this is the
  // full-resolution file.
  if (!puzzle?.imageSrc || puzzle.date > utcDay(deps.clock.now())) return { kind: "not-found" };

  const upstream = await deps.images.fetch(puzzle.imageSrc);
  if (!upstream?.ok || !upstream.contentType.startsWith("image/")) return { kind: "unavailable" };

  return { kind: "image", contentType: upstream.contentType, body: upstream.body };
}
