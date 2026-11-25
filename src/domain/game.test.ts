import { describe, expect, it } from "vitest";
import {
  addGuess,
  completionScore,
  guessRow,
  NEW_GAME,
  parseProgress,
  resolutionFor,
  resultMessage,
  SKIP_ROW,
  type GameProgress,
} from "./game.ts";
import { FULL_RES, RES_STEPS } from "./rules.ts";

const wrong = guessRow("nope", false);
const right = guessRow("yes", true);

/** Play a list of rows from a fresh game. */
const play = (...rows: (typeof wrong)[]): GameProgress => rows.reduce(addGuess, NEW_GAME);

describe("addGuess", () => {
  it("keeps playing after a wrong guess", () => {
    expect(play(wrong)).toEqual({ guesses: [wrong], status: "playing" });
  });

  it("wins on a correct guess", () => {
    expect(play(wrong, right).status).toBe("won");
  });

  it("loses after the fifth wrong guess (skips count too)", () => {
    expect(play(wrong, SKIP_ROW, wrong, wrong).status).toBe("playing");
    expect(play(wrong, SKIP_ROW, wrong, wrong, wrong).status).toBe("lost");
  });

  it("ignores guesses once the game is over", () => {
    const won = play(right);
    expect(addGuess(won, wrong)).toBe(won);
  });

  it("never changes the progress it was given", () => {
    const before = play(wrong);
    addGuess(before, right);
    expect(before.guesses).toHaveLength(1);
  });
});

describe("resolutionFor — the image sharpens as you fail", () => {
  it("steps through RES_STEPS, one per guess", () => {
    expect(resolutionFor(NEW_GAME)).toBe(RES_STEPS[0]);
    expect(resolutionFor(play(wrong))).toBe(RES_STEPS[1]);
    expect(resolutionFor(play(wrong, wrong, wrong, wrong))).toBe(RES_STEPS[4]);
  });

  it("gets sharper every step", () => {
    const sizes = [0, 1, 2, 3, 4].map((n) => resolutionFor(play(...Array(n).fill(wrong))));
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
    expect(new Set(sizes).size).toBe(5);
  });

  it("shows the full image once the game is over", () => {
    expect(resolutionFor(play(right))).toBe(FULL_RES);
    expect(resolutionFor(play(wrong, wrong, wrong, wrong, wrong))).toBe(FULL_RES);
  });
});

describe("completionScore", () => {
  it("is the number of guesses for a win, 6 for a loss", () => {
    expect(completionScore(play(wrong, right))).toBe(2);
    expect(completionScore(play(wrong, wrong, wrong, wrong, wrong))).toBe(6);
  });
});

describe("resultMessage", () => {
  it("praises a first-guess win most", () => {
    expect(resultMessage(play(right))).toEqual({ text: "Absolutely unreal.", tone: "blue" });
  });

  it("is gentler for a fifth-guess win", () => {
    expect(resultMessage(play(wrong, wrong, wrong, wrong, right)).text).toBe("That was close.");
  });

  it("commiserates on a loss", () => {
    expect(resultMessage(play(wrong, wrong, wrong, wrong, wrong))).toEqual({
      text: "Better luck tomorrow.",
      tone: "coral",
    });
  });
});

describe("parseProgress — reading a save that anyone could have edited", () => {
  it("accepts a real save", () => {
    const saved = JSON.parse(JSON.stringify(play(wrong, SKIP_ROW)));
    expect(parseProgress(saved)).toEqual(play(wrong, SKIP_ROW));
  });

  it("rejects junk", () => {
    expect(parseProgress(null)).toBeNull();
    expect(parseProgress("hello")).toBeNull();
    expect(parseProgress({ guesses: [], status: "cheating" })).toBeNull();
    expect(parseProgress({ guesses: "no", status: "playing" })).toBeNull();
    expect(parseProgress({ guesses: [null], status: "playing" })).toBeNull();
  });

  it("fills in odd fields with safe values", () => {
    expect(parseProgress({ guesses: [{ text: 5, correct: "yes" }], status: "playing" })).toEqual({
      guesses: [{ text: null, correct: false, skipped: false }],
      status: "playing",
    });
  });
});
