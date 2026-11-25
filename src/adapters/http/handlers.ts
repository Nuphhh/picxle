// ADAPTER (driving side): turns HTTP requests into use-case calls, and use-case
// results back into HTTP responses.
//
// This is the ONLY place that knows about status codes and JSON field names.
// The app/api/**/route.ts files are one-liners that pick a handler from here.
//
// createHandlers takes its dependencies as an argument, so tests can pass in
// in-memory repositories and call a handler with a hand-made Request.
import { todaysPuzzle, yesterdaysPuzzle } from "@/src/application/daily-puzzle";
import type { ImageFetcher, ServerDeps, ShareImageRenderer, TeaserStore } from "@/src/application/ports";
import { getPuzzleImage } from "@/src/application/puzzle-image";
import { revealAnswer } from "@/src/application/reveal-answer";
import { getShareImage } from "@/src/application/share-image";
import { playerStatsFor, puzzleStats, recordCompletion } from "@/src/application/stats";
import { submitGuess } from "@/src/application/submit-guess";
import type { PuzzleSummary } from "@/src/domain/puzzle";
import type {
  DistributionJson,
  ErrorJson,
  GuessResponseJson,
  PlayerStatsJson,
  PuzzleSummaryJson,
  RevealResponseJson,
} from "./wire";

export type Handler = (request: Request) => Promise<Response>;

export interface HttpDeps extends ServerDeps {
  /** Fetches puzzle images for the image proxy. */
  images: ImageFetcher;
}

/** The share-image route needs more than the others (sharp + teasers.json), so
 *  it gets its own factory and those heavy modules only load in that route. */
export interface ShareImageDeps {
  puzzles: ServerDeps["puzzles"];
  clock: ServerDeps["clock"];
  images: ImageFetcher;
  teasers: TeaserStore;
  renderer: ShareImageRenderer;
}

// `Response.json<T>` would accept anything; these helpers make each handler
// say which wire type it is sending, so TypeScript checks the shape.
const ok = <T>(body: T): Response => Response.json(body);
const fail = (status: number, error: string): Response => Response.json({ error } satisfies ErrorJson, { status });

const toJson = (p: PuzzleSummary): PuzzleSummaryJson => ({
  id: p.id,
  puzzle_date: p.date,
  category: p.category,
  license: p.license,
});

// A body that isn't valid JSON is treated like an empty one (→ 400), rather
// than crashing the function (→ 500).
async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const param = (request: Request, name: string): string | null => new URL(request.url).searchParams.get(name);

export function createHandlers(deps: HttpDeps) {
  const guess: Handler = async (request) => {
    const body = await readJson(request);
    const r = await submitGuess(deps, body);
    switch (r.kind) {
      case "graded":
        return ok<GuessResponseJson>({ correct: r.correct, guessNumber: r.guessNumber });
      case "invalid":
        return fail(400, "Missing or invalid fields.");
      case "not-found":
        return fail(404, "Puzzle not found.");
      case "already-finished":
        return fail(409, "Puzzle already finished.");
      case "not-recorded":
        return fail(409, "Guess not recorded, try again.");
    }
  };

  const reveal: Handler = async (request) => {
    const r = await revealAnswer(deps, { puzzleId: param(request, "puzzleId"), playerId: param(request, "playerId") });
    switch (r.kind) {
      case "revealed":
        return ok<RevealResponseJson>({ answer: r.answer, license: r.license, attribution: r.attribution });
      case "invalid":
        return fail(400, "Missing or invalid puzzleId.");
      case "not-found":
        return fail(404, "Not found.");
      case "forbidden":
        return fail(403, "Finish the puzzle first.");
    }
  };

  const today: Handler = async () => {
    const p = await todaysPuzzle(deps);
    return p ? ok(toJson(p)) : fail(404, "No puzzle found for today.");
  };

  const yesterday: Handler = async () => {
    const p = await yesterdaysPuzzle(deps);
    return p ? ok(toJson(p)) : fail(404, "No puzzle found.");
  };

  const image: Handler = async (request) => {
    const r = await getPuzzleImage(deps, param(request, "puzzleId"));
    switch (r.kind) {
      case "invalid":
        return fail(400, "Missing or invalid puzzleId.");
      case "not-found":
        return fail(404, "Not found.");
      case "unavailable":
        return fail(502, "Image unavailable.");
      case "image":
        return new Response(r.body, {
          headers: {
            "Content-Type": r.contentType,
            // A puzzle's image never changes, so let Vercel's CDN keep it for a
            // week (s-maxage) and browsers for a day.
            "Cache-Control": "public, max-age=86400, s-maxage=604800",
            // The mobile app loads from a different origin and draws the image
            // onto a canvas; without this the canvas is "tainted" and
            // pixelation fails.
            "Access-Control-Allow-Origin": "*",
            // Some flags are SVGs. If someone opened this URL directly, an SVG
            // could run script on our domain — this header stops that.
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            "X-Content-Type-Options": "nosniff",
          },
        });
    }
  };

  const recordStats: Handler = async (request) => {
    const body = await readJson(request);
    const r = await recordCompletion(deps, body);
    return r.kind === "recorded" ? ok({ ok: true }) : fail(400, "Missing fields.");
  };

  const playerStreak: Handler = async (request) => {
    const r = await playerStatsFor(deps, param(request, "playerId"));
    if (r.kind === "invalid") return fail(400, "Missing playerId.");
    const { current, max, played, winPct, counts } = r;
    return ok<PlayerStatsJson>({ current, max, played, winPct, counts });
  };

  const puzzleDistribution: Handler = async (request) => {
    const r = await puzzleStats(deps, param(request, "puzzleId"));
    if (r.kind === "invalid") return fail(400, "Invalid puzzleId.");
    if (r.kind === "no-puzzle") return fail(404, "No puzzle today.");
    return ok<DistributionJson>({ counts: r.counts, total: r.total });
  };

  return { guess, reveal, today, yesterday, image, recordStats, playerStreak, puzzleDistribution };
}

export function createShareImageHandler(deps: ShareImageDeps): Handler {
  return async (request) => {
    const png = await getShareImage(deps, param(request, "d"));
    // new Uint8Array(...) copies into a plain ArrayBuffer, which Response accepts
    // whatever kind of buffer sharp handed back.
    return new Response(new Uint8Array(png), {
      headers: { "content-type": "image/png", "cache-control": "public, max-age=3600, s-maxage=86400" },
    });
  };
}
