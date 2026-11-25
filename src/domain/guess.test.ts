// How to read a test file:
//   describe(...) groups related tests under a heading.
//   it("does X", ...) is one test; it fails if any expect(...) inside fails.
//   expect(actual).toBe(expected) is the check itself.
// Run them all with `npm test`, or `npm run test:watch` to re-run on save.
import { describe, expect, it } from "vitest";
import { isCorrectGuess, isFinished, normaliseGuess } from "./guess.ts";

describe("normaliseGuess", () => {
  it("lowercases and trims", () => {
    expect(normaliseGuess("  Eiffel Tower ")).toBe("eiffel tower");
  });

  it("folds accents instead of deleting the letter", () => {
    expect(normaliseGuess("Sagrada Família")).toBe("sagrada familia");
    expect(normaliseGuess("Curaçao")).toBe("curacao");
  });

  it("joins words across apostrophes, including the curly one", () => {
    expect(normaliseGuess("St Basil's")).toBe("st basils");
    expect(normaliseGuess("St Basil’s")).toBe("st basils");
  });

  it("splits on hyphens and other punctuation", () => {
    expect(normaliseGuess("Mont-Saint-Michel")).toBe("mont saint michel");
    expect(normaliseGuess("rock,  paper...scissors")).toBe("rock paper scissors");
  });

  it("copes with null and undefined", () => {
    expect(normaliseGuess(null)).toBe("");
    expect(normaliseGuess(undefined)).toBe("");
  });
});

describe("isCorrectGuess", () => {
  const accepts = ["Taj Mahal", "the taj mahal", "Taj"];

  it("accepts any listed spelling, however it's typed", () => {
    expect(isCorrectGuess(accepts, "TAJ MAHAL")).toBe(true);
    expect(isCorrectGuess(accepts, "taj-mahal")).toBe(true);
    expect(isCorrectGuess(accepts, "Taj")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isCorrectGuess(accepts, "Red Fort")).toBe(false);
    expect(isCorrectGuess(accepts, "taj mahal palace")).toBe(false);
  });

  it("never accepts an empty guess, even against an empty accept", () => {
    expect(isCorrectGuess([""], "")).toBe(false);
    expect(isCorrectGuess(["!!!"], "???")).toBe(false);
  });
});

describe("isFinished", () => {
  const wrong = (n: number) => ({ guessNumber: n, correct: false });

  it("is false while guesses remain", () => {
    expect(isFinished([])).toBe(false);
    expect(isFinished([wrong(1), wrong(2), wrong(3), wrong(4)])).toBe(false);
  });

  it("is true once solved", () => {
    expect(isFinished([wrong(1), { guessNumber: 2, correct: true }])).toBe(true);
  });

  it("is true after five guesses", () => {
    expect(isFinished([1, 2, 3, 4, 5].map(wrong))).toBe(true);
  });
});
