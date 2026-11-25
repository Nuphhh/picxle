// localStorage-backed progress. A tiny fake Storage stands in for the browser's,
// so these run in plain Node.
import { describe, expect, it } from "vitest";
import { addGuess, guessRow, NEW_GAME } from "@/src/domain/game";
import { localProgressStore } from "./local-progress-store";

/** Just enough of the Storage interface, backed by a Map. */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    storage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    } as Storage,
  };
}

/** Storage that throws on every call, like Safari private mode used to. */
const brokenStorage = {
  getItem() { throw new Error("SecurityError"); },
  setItem() { throw new Error("QuotaExceededError"); },
} as unknown as Storage;

const ID = "puzzle-1";

describe("localProgressStore", () => {
  it("saves and loads progress under the same key the JS version used", () => {
    const { map, storage } = fakeStorage();
    const store = localProgressStore(() => storage);
    const p = addGuess(NEW_GAME, guessRow("France", false));
    store.save(ID, p);
    expect(JSON.parse(map.get("picxle-puzzle-1")!)).toEqual(p);
    expect(store.load(ID)).toEqual(p);
  });

  it("reads progress saved by the old JavaScript app", () => {
    const old = JSON.stringify({ guesses: [{ text: null, correct: false, skipped: true }], status: "playing" });
    const store = localProgressStore(() => fakeStorage({ "picxle-puzzle-1": old }).storage);
    expect(store.load(ID)?.guesses[0].skipped).toBe(true);
  });

  it("treats missing, corrupt or wrongly-shaped saves as no save", () => {
    const { storage } = fakeStorage({
      "picxle-bad-json": "{not json",
      "picxle-bad-shape": JSON.stringify({ guesses: "lots", status: "won" }),
    });
    const store = localProgressStore(() => storage);
    expect(store.load("never-played")).toBeNull();
    expect(store.load("bad-json")).toBeNull();
    expect(store.load("bad-shape")).toBeNull();
  });

  it("remembers recorded and declined puzzles", () => {
    const { map, storage } = fakeStorage();
    const store = localProgressStore(() => storage);
    expect(store.isRecorded(ID)).toBe(false);
    store.markRecorded(ID);
    store.markDeclined(ID);
    expect(store.isRecorded(ID)).toBe(true);
    expect(store.isDeclined(ID)).toBe(true);
    expect([...map.keys()].sort()).toEqual(["picxle-declined-puzzle-1", "picxle-recorded-puzzle-1"]);
  });

  it("never throws when storage is blocked — the game just doesn't remember", () => {
    const store = localProgressStore(() => brokenStorage);
    expect(() => store.save(ID, NEW_GAME)).not.toThrow();
    expect(store.load(ID)).toBeNull();
    expect(() => store.markRecorded(ID)).not.toThrow();
    expect(store.isRecorded(ID)).toBe(false);
  });
});
