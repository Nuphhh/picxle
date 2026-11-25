// The smaller browser adapters: sharing, theme, pixelation maths.
// `vi.stubGlobal` swaps in a fake `navigator`/`localStorage` for one test;
// `vi.unstubAllGlobals` (in afterEach) puts the real ones back.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fitRect } from "./pixelate";
import { shareText } from "./share";
import { getThemeMode, nextThemeMode, resolveDark, themeGlyph } from "./theme";

afterEach(() => vi.unstubAllGlobals());

describe("shareText", () => {
  function fakeNavigator(share?: () => Promise<void>) {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    return writeText;
  }

  it("uses the share sheet when asked to", async () => {
    const share = vi.fn(async () => {});
    const writeText = fakeNavigator(share);
    expect(await shareText("Picxle 2/5", true)).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "Picxle", text: "Picxle 2/5" });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("does nothing more when the player dismisses the sheet", async () => {
    const writeText = fakeNavigator(async () => { throw new DOMException("cancelled", "AbortError"); });
    expect(await shareText("x", true)).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to the clipboard if the sheet fails for another reason", async () => {
    const writeText = fakeNavigator(async () => { throw new DOMException("nope", "NotAllowedError"); });
    expect(await shareText("x", true)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("x");
  });

  it("copies on desktop, and still reports 'copied' if the clipboard is blocked", async () => {
    const writeText = fakeNavigator();
    writeText.mockRejectedValueOnce(new Error("denied"));
    expect(await shareText("x", false)).toBe("copied");
  });
});

describe("theme", () => {
  it("cycles light -> dark -> system -> light", () => {
    expect(nextThemeMode("light")).toBe("dark");
    expect(nextThemeMode("dark")).toBe("system");
    expect(nextThemeMode("system")).toBe("light");
    expect(themeGlyph("system")).toBe("◐");
  });

  it("explicit modes ignore the OS setting", () => {
    expect(resolveDark("dark")).toBe(true);
    expect(resolveDark("light")).toBe(false);
  });

  it("reads the saved mode, defaulting to system for junk or blocked storage", () => {
    vi.stubGlobal("localStorage", { getItem: () => "light" });
    expect(getThemeMode()).toBe("light");
    vi.stubGlobal("localStorage", { getItem: () => "purple" });
    expect(getThemeMode()).toBe("system");
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
    expect(getThemeMode()).toBe("system");
  });
});

describe("fitRect", () => {
  it("cover: crops the middle square out of a wide photo", () => {
    expect(fitRect(1000, 600, "cover", 440)).toEqual({ sx: 200, sy: 0, sw: 600, sh: 600, dx: 0, dy: 0, dw: 440, dh: 440 });
  });

  it("contain: shrinks a 3:2 flag to fit whole, centred, on whole pixels", () => {
    expect(fitRect(900, 600, "contain", 440)).toEqual({ sx: 0, sy: 0, sw: 900, sh: 600, dx: 0, dy: 74, dw: 440, dh: 293 });
  });
});
