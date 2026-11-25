// What a puzzle looks like inside the app. Note the split: the browser only
// ever gets a PuzzleSummary. The answer, the accepted spellings and the image
// address all stay on the server — image filenames usually ARE the answer
// ("Axolotl.jpg"), and a few attributions name the subject.
import type { IsoDay } from "./dates.ts";

/** Safe to send to the browser before the puzzle is finished. */
export interface PuzzleSummary {
  id: string;
  date: IsoDay;
  category: string;
  license: string | null;
}

/** Server-only: what's needed to show the answer once allowed. */
export interface PuzzleReveal {
  answer: string;
  date: IsoDay;
  license: string | null;
  attribution: string | null;
}

/** Server-only: where the image lives. */
export interface PuzzleImage {
  imageSrc: string;
  date: IsoDay;
  category: string;
}

// Flags are drawn whole ("contain"); everything else is centre-cropped square.
export const imageFit = (category: string): "contain" | "cover" =>
  category === "Flag" ? "contain" : "cover";
