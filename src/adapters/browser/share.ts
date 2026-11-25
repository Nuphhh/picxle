// Sharing a result: the OS share sheet on a phone, the clipboard on a desktop.
import type { ShareOutcome } from "@/src/application/client-ports";
import { getPlatform } from "./analytics";

// `userAgentData` is newer than TypeScript's built-in DOM types, so describe
// the one field we read.
type NavigatorWithUAData = Navigator & { userAgentData?: { mobile?: boolean } };

/**
 * Should sharing open the OS share sheet, or just copy to the clipboard?
 *
 * `navigator.share` exists on desktop Chrome too, so testing for it alone is not
 * enough: on Windows it pops the OS share dialog and makes you choose an app just
 * to hand over a few emoji. The sheet is genuinely good on a phone (one tap into
 * WhatsApp) and a nuisance on a desktop, so decide on the DEVICE, not the API.
 */
export function shouldUseShareSheet(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  if (!navigator.share) return false;

  // Inside the installed app the native sheet is exactly what we want.
  if (getPlatform() !== "web") return true;

  // Chromium states outright whether this is a mobile device — trust it. This is
  // what tells Windows/macOS Chrome (false) apart from Android Chrome (true).
  const uaMobile = (navigator as NavigatorWithUAData).userAgentData?.mobile;
  if (typeof uaMobile === "boolean") return uaMobile;

  // Safari and Firefox do not expose User-Agent Client Hints, so fall back to the
  // pointer: a touch-primary device (phone, iPad) is one where the sheet belongs,
  // a mouse-driven one is not.
  return window.matchMedia?.("(any-pointer: coarse)")?.matches ?? false;
}

/** Share `text`, falling back to the clipboard. */
export async function shareText(text: string, useSheet = shouldUseShareSheet()): Promise<ShareOutcome> {
  if (useSheet) {
    try {
      await navigator.share({ title: "Picxle", text });
      return "shared";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "cancelled"; // user dismissed the sheet
      // anything else (e.g. share not permitted): fall through to the clipboard
    }
  }
  try {
    await navigator.clipboard?.writeText(text);
  } catch {}
  return "copied";
}
