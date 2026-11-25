// ADAPTER: the ProgressStore port, backed by localStorage.
//
// The key names are the same ones the JavaScript version used, so players keep
// their in-progress games across the update.
//
// Every access is wrapped in try/catch: localStorage throws in some private
// browsing modes, and a storage hiccup must never crash the game — at worst,
// progress isn't remembered.
import type { ProgressStore } from "@/src/application/client-ports";
import { parseProgress } from "@/src/domain/game";

const progressKey = (id: string) => `picxle-${id}`;
const recordedKey = (id: string) => `picxle-recorded-${id}`;
const declinedKey = (id: string) => `picxle-declined-${id}`;

/** `storage` is a function so tests can pass a fake (and so nothing touches
 *  localStorage until it's actually used — it doesn't exist on the server). */
export function localProgressStore(storage: () => Storage = () => window.localStorage): ProgressStore {
  const get = (key: string): string | null => {
    try {
      return storage().getItem(key);
    } catch {
      return null;
    }
  };
  const set = (key: string, value: string) => {
    try {
      storage().setItem(key, value);
    } catch {
      /* storage full or blocked: carry on without saving */
    }
  };

  return {
    load(id) {
      const raw = get(progressKey(id));
      if (!raw) return null;
      try {
        // parseProgress checks the shape — saved data is user-editable.
        return parseProgress(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    save: (id, p) => set(progressKey(id), JSON.stringify(p)),
    isRecorded: (id) => !!get(recordedKey(id)),
    markRecorded: (id) => set(recordedKey(id), "1"),
    isDeclined: (id) => !!get(declinedKey(id)),
    markDeclined: (id) => set(declinedKey(id), "1"),
  };
}
