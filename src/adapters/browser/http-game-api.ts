// ADAPTER: the GameApi port, implemented with fetch() against our own routes.
//
// Its other job is translation. The server speaks the wire format in
// src/adapters/http/wire.ts (e.g. "puzzle_date"); the rest of the browser code
// speaks domain types (e.g. "date"). Converting here, at the edge, means a
// rename on either side is a one-line change in one file.
import type { GameApi } from "@/src/application/client-ports";
import type {
  DistributionJson,
  GuessRequestJson,
  GuessResponseJson,
  PlayerStatsJson,
  PuzzleSummaryJson,
  RecordRequestJson,
  RevealResponseJson,
} from "@/src/adapters/http/wire";
import type { PuzzleSummary } from "@/src/domain/puzzle";

const toSummary = (j: PuzzleSummaryJson): PuzzleSummary => ({
  id: j.id,
  date: j.puzzle_date,
  category: j.category,
  license: j.license,
});

/**
 * `base` is "" on the website (same-origin) and the Vercel address inside the
 * Android app. `fetchImpl` is swappable so tests can answer requests themselves.
 */
export function httpGameApi(base = "", fetchImpl: typeof fetch = (...a) => fetch(...a)): GameApi {
  const url = (path: string) => `${base}${path}`;
  const q = encodeURIComponent;

  /** GET some JSON; throws on a network failure OR an error status. */
  async function getJson<T>(path: string): Promise<T> {
    const res = await fetchImpl(url(path));
    if (!res.ok) throw new Error(`${path} -> ${res.status}`);
    return (await res.json()) as T;
  }

  const post = (path: string, body: unknown) =>
    fetchImpl(url(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  return {
    async todayPuzzle() {
      const res = await fetchImpl(url("/api/puzzle/today")); // offline -> throws
      if (!res.ok) return null; // 404 = no puzzle today
      return toSummary((await res.json()) as PuzzleSummaryJson);
    },

    async yesterdayPuzzle() {
      try {
        return toSummary(await getJson<PuzzleSummaryJson>("/api/puzzle/yesterday"));
      } catch {
        return null;
      }
    },

    async submitGuess(puzzleId, playerId, input) {
      const body: GuessRequestJson = { puzzleId, playerId, ...input };
      try {
        const res = await post("/api/guess", body);
        if (!res.ok) return null;
        const { correct, guessNumber } = (await res.json()) as GuessResponseJson;
        return { correct, guessNumber };
      } catch {
        return null;
      }
    },

    async reveal(puzzleId, playerId) {
      const j = await getJson<RevealResponseJson>(`/api/puzzle/reveal?puzzleId=${q(puzzleId)}&playerId=${q(playerId)}`);
      return { answer: j.answer ?? null, attribution: j.attribution ?? null };
    },

    puzzleStats: (puzzleId) => getJson<DistributionJson>(`/api/stats/today?puzzleId=${q(puzzleId)}`),

    playerStats: (playerId) => getJson<PlayerStatsJson>(`/api/stats/streak?playerId=${q(playerId)}`),

    async recordCompletion(c) {
      const body: RecordRequestJson = c;
      await post("/api/stats/record", body);
    },

    imageUrl: (puzzleId) => url(`/api/puzzle/image?puzzleId=${q(puzzleId)}`),
  };
}
