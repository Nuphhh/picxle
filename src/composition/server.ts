// COMPOSITION ROOT (server): the one place that picks the REAL adapters and
// plugs them into the ports.
//
// Everything else in src/ is written against interfaces. This file is where
// "PuzzleRepository" becomes "the Supabase puzzles table" and "Clock" becomes
// "the actual time". Tests never import this file — they build their own deps
// from src/adapters/memory instead.
//
// Building the objects at import time is safe: supabaseRest reads the env vars
// on every request, not now (see src/adapters/supabase/rest.ts).
import { createHandlers } from "@/src/adapters/http/handlers";
import { httpImageFetcher } from "@/src/adapters/images/http-image-fetcher";
import { supabaseCompletionRepository } from "@/src/adapters/supabase/completion-repository";
import { supabaseGuessRepository } from "@/src/adapters/supabase/guess-repository";
import { supabasePuzzleRepository } from "@/src/adapters/supabase/puzzle-repository";
import { supabaseRest } from "@/src/adapters/supabase/rest";
import type { Clock, ServerDeps } from "@/src/application/ports";

const rest = supabaseRest();

export const systemClock: Clock = { now: () => new Date() };

export const serverDeps: ServerDeps = {
  puzzles: supabasePuzzleRepository(rest),
  guesses: supabaseGuessRepository(rest),
  completions: supabaseCompletionRepository(rest),
  clock: systemClock,
};

/** Every API route handler except the share image (see ./share-image.ts). */
export const handlers = createHandlers({
  ...serverDeps,
  images: httpImageFetcher("PicxleGame/1.0 (image proxy; picxlebypenrose@gmail.com)"),
});
