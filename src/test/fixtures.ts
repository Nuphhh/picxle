// Shared test data: three puzzles (yesterday, today, tomorrow) around a fixed
// "now" of 2026-11-25 at noon UTC.
import type { ImageFetcher, RemoteImage, ShareImageRenderer, TeaserStore } from "@/src/application/ports";
import { memoryServerDeps, type PuzzleRecord } from "@/src/adapters/memory";

export const NOW = "2026-11-25T12:00:00Z";
export const PLAYER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const OTHER_PLAYER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const MISSING_ID = "99999999-9999-4999-8999-999999999999";

export const YESTERDAY: PuzzleRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  date: "2026-11-24",
  category: "Landmark",
  license: "CC-BY",
  attribution: "Jane Doe, CC BY 4.0",
  imageSrc: "https://upload.wikimedia.org/x/Big_Ben.jpg",
  answer: "Big Ben",
  accepts: ["Big Ben", "Elizabeth Tower"],
};

export const TODAY: PuzzleRecord = {
  id: "22222222-2222-4222-8222-222222222222",
  date: "2026-11-25",
  category: "Flag",
  license: "PD",
  attribution: "Picxle original",
  imageSrc: "https://upload.wikimedia.org/x/Flag_of_Japan.svg",
  answer: "Japan",
  accepts: ["Japan", "Nippon"],
};

export const TOMORROW: PuzzleRecord = {
  id: "33333333-3333-4333-8333-333333333333",
  date: "2026-11-26",
  category: "Animal",
  license: "CC0",
  attribution: "Someone",
  imageSrc: "https://upload.wikimedia.org/x/Axolotl.jpg",
  answer: "Axolotl",
  accepts: ["Axolotl"],
};

export const allPuzzles = (): PuzzleRecord[] => [YESTERDAY, TODAY, TOMORROW].map((p) => ({ ...p }));

/** Fresh in-memory deps for one test. */
export const testDeps = () => memoryServerDeps(allPuzzles(), NOW);

/** An ImageFetcher that answers every URL with the same fake image, and
 *  remembers which URLs were asked for. */
export function fakeImages(contentType = "image/jpeg", ok = true): ImageFetcher & { requested: string[] } {
  const requested: string[] = [];
  return {
    requested,
    async fetch(url) {
      requested.push(url);
      const bytes = new Uint8Array([1, 2, 3]);
      const image: RemoteImage = {
        ok,
        contentType,
        body: new Response(bytes).body,
        bytes: async () => bytes,
      };
      return image;
    },
  };
}

/** A renderer that labels its output instead of drawing, so tests can see which path ran. */
export const fakeRenderer: ShareImageRenderer = {
  fromTeaser: async () => new TextEncoder().encode("teaser"),
  fromImage: async (_bytes, fit) => new TextEncoder().encode(`image:${fit}`),
  blank: async () => new TextEncoder().encode("blank"),
};

export const teasersFor = (...days: string[]): TeaserStore => ({
  get: (day) => (days.includes(day) ? new Uint8Array(192) : null),
});
