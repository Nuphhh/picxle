// ADAPTER: an in-memory ProgressStore for tests — localStorage's stand-in.
import type { ProgressStore } from "@/src/application/client-ports";
import type { GameProgress } from "@/src/domain/game";

export function memoryProgressStore(initial: Record<string, GameProgress> = {}) {
  const saved = new Map(Object.entries(initial));
  const recorded = new Set<string>();
  const declined = new Set<string>();
  const store: ProgressStore = {
    load: (id) => saved.get(id) ?? null,
    save: (id, p) => void saved.set(id, p),
    isRecorded: (id) => recorded.has(id),
    markRecorded: (id) => void recorded.add(id),
    isDeclined: (id) => declined.has(id),
    markDeclined: (id) => void declined.add(id),
  };
  // The sets are exposed too, so tests can look inside.
  return Object.assign(store, { saved, recorded, declined });
}
