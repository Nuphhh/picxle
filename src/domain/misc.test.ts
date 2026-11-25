// Smaller domain modules: dates, sharing, suggestions, credits.
import { describe, expect, it } from "vitest";
import { creditList, isPicxleOriginal, publicAttribution, sourceLink } from "./credits.ts";
import { addDays, daysBetween, formatCountdown, isIsoDay, msUntilNextPuzzle, utcDay } from "./dates.ts";
import { addGuess, guessRow, NEW_GAME, SKIP_ROW } from "./game.ts";
import { isUuid } from "./ids.ts";
import { buildShareText, emojiRow } from "./share.ts";
import { suggestAnswers } from "./suggestions.ts";

describe("dates", () => {
  it("uses the UTC day, whatever the local time zone", () => {
    expect(utcDay(new Date("2026-11-25T23:59:59Z"))).toBe("2026-11-25");
  });

  it("adds and counts days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
  });

  it("validates day strings", () => {
    expect(isIsoDay("2026-11-25")).toBe(true);
    expect(isIsoDay("25/11/2026")).toBe(false);
    expect(isIsoDay(20261125)).toBe(false);
  });

  it("counts down to the next UTC midnight", () => {
    const ms = msUntilNextPuzzle(new Date("2026-11-25T22:58:57Z"));
    expect(formatCountdown(ms)).toBe("01:01:03");
    expect(formatCountdown(-5)).toBe("00:00:00");
  });
});

describe("isUuid", () => {
  it("accepts UUIDs and rejects query-string tricks", () => {
    expect(isUuid("3f2b8c1e-0a4d-4e8f-9b7a-1c2d3e4f5a6b")).toBe(true);
    expect(isUuid("3f2b8c1e-0a4d-4e8f-9b7a-1c2d3e4f5a6b&select=answer")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("share text", () => {
  const p = [guessRow("a", false), SKIP_ROW, guessRow("b", true)].reduce(addGuess, NEW_GAME);

  it("draws one square per guess slot", () => {
    expect(emojiRow(p)).toBe("🟥⬜🟩⬛⬛");
  });

  it("builds the message players paste", () => {
    expect(buildShareText(p, "2026-11-25")).toBe("Picxle 3/5\n🟥⬜🟩⬛⬛\nhttps://picxle.vercel.app/s/2026-11-25");
  });

  it("shows X/5 for a loss", () => {
    const lost = Array(5).fill(guessRow("a", false)).reduce(addGuess, NEW_GAME);
    expect(buildShareText(lost, "2026-11-25").split("\n")[0]).toBe("Picxle X/5");
  });
});

describe("suggestAnswers", () => {
  const dictionary = ["cat", "caterpillar", "antelope canyon", "pelican", "dog", "water lilies", "the old guitarist"];
  const artists = { "claude monet": ["water lilies"], "pablo picasso": ["the old guitarist"] };

  it("needs at least two letters", () => {
    expect(suggestAnswers("c", dictionary, artists)).toEqual([]);
  });

  it("ranks starts-with, then word-start, then contains; shorter first on ties", () => {
    expect(suggestAnswers("ca", dictionary, artists).slice(0, 4)).toEqual([
      "cat",
      "caterpillar",
      "antelope canyon",
      "pelican",
    ]);
  });

  it("finds works by their artist", () => {
    expect(suggestAnswers("monet", dictionary, artists)).toEqual(["water lilies"]);
  });

  it("ranks an artist match like any other, so mid-word hits stay at the back", () => {
    // "ca" is in the middle of "picasso": same rank as "pelican", but a direct
    // name match wins the tie, so the Picasso painting comes last.
    expect(suggestAnswers("ca", dictionary, artists).at(-1)).toBe("the old guitarist");
  });

  it("respects the limit", () => {
    expect(suggestAnswers("ca", dictionary, artists, 2)).toEqual(["cat", "caterpillar"]);
  });
});

describe("credits", () => {
  it("spots Picxle's own images and hides their credit line", () => {
    expect(isPicxleOriginal("Picxle original — sunflower")).toBe(true);
    expect(publicAttribution("Picxle original")).toBeNull();
    expect(publicAttribution("Jane Doe, CC BY 4.0")).toBe("Jane Doe, CC BY 4.0");
  });

  it("links Wikimedia uploads to their Commons file page", () => {
    expect(sourceLink("https://upload.wikimedia.org/wikipedia/commons/d/df/Axolotl%20pink.jpg")).toBe(
      "https://commons.wikimedia.org/wiki/File:Axolotl%20pink.jpg",
    );
    expect(sourceLink("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
  });

  it("dedupes, drops originals and blanks, and sorts by author", () => {
    const list = creditList([
      { imageSrc: "b.jpg", license: "CC-BY", attribution: "Zed" },
      { imageSrc: "a.jpg", license: "PD", attribution: "Amy" },
      { imageSrc: "a.jpg", license: "PD", attribution: "Amy" },
      { imageSrc: "c.jpg", license: "CC0", attribution: "Picxle original" },
      { imageSrc: "", license: "CC0", attribution: "Nobody" },
    ]);
    expect(list.map((c) => c.attribution)).toEqual(["Amy", "Zed"]);
  });
});
