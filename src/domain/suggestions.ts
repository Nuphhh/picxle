// Autocomplete for the guess box. Players can only guess words from the
// dictionary, so good suggestions are what make guessing feel fair.
import { normaliseGuess } from "./guess.ts";

// How well a name matches what was typed — lower is better:
//   0  starts with it                "ca" -> "cat"
//   1  a later word starts with it   "ca" -> "antelope canyon"
//   2  contains it anywhere          "ca" -> "pelican"
//   NO_MATCH                         "ca" -> "dog"
const NO_MATCH = 9;
const matchRank = (name: string, q: string): number =>
  name.startsWith(q) ? 0 : name.includes(" " + q) ? 1 : name.includes(q) ? 2 : NO_MATCH;

/**
 * Best suggestions for `input`, at most `limit` of them.
 *
 * Every matching answer gets its best rank: either from its own name, or from
 * its artist's name (typing "monet" offers "water lilies"). Ranking artists the
 * same way stops "ca" filling every slot with Picasso paintings just because
 * "ca" sits in the middle of "picasso".
 */
export function suggestAnswers(
  input: string,
  dictionary: readonly string[],
  artistMap: Readonly<Record<string, readonly string[]>>,
  limit = 6,
): string[] {
  const q = normaliseGuess(input);
  if (q.length < 2) return [];

  // answer -> [rank, viaArtist (0 = own name, 1 = artist's name)]
  const best = new Map<string, [number, number]>();
  for (const w of dictionary) {
    const r = matchRank(w, q);
    if (r < NO_MATCH) best.set(w, [r, 0]);
  }
  for (const [artist, works] of Object.entries(artistMap)) {
    const r = matchRank(artist, q);
    if (r === NO_MATCH) continue;
    for (const w of works) {
      const prev = best.get(w);
      if (!prev || r < prev[0]) best.set(w, [r, 1]);
    }
  }

  // Sort by rank; on a tie a direct name match beats an artist match, then
  // shorter beats longer ("cat" is a likelier guess than "caterpillar").
  return [...best.entries()]
    .sort(([a, [ra, va]], [b, [rb, vb]]) => ra - rb || va - vb || a.length - b.length)
    .slice(0, limit)
    .map(([w]) => w);
}
