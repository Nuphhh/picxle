// ADAPTER: TeaserStore over the teasers.json file written by
// scripts/build-teasers.mjs: { "YYYY-MM-DD": base64(8×8×3 RGB bytes) }.
import type { TeaserStore } from "@/src/application/ports";

export function jsonTeaserStore(teasers: Readonly<Record<string, string>>): TeaserStore {
  return {
    get(day) {
      // Object.hasOwn so a "day" like "constructor" can't reach Object.prototype.
      if (!Object.hasOwn(teasers, day)) return null;
      return new Uint8Array(Buffer.from(teasers[day], "base64"));
    },
  };
}
