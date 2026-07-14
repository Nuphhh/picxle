import { getPlatform } from "@/lib/analytics";

// Should sharing open the OS share sheet, or just copy to the clipboard?
//
// `navigator.share` exists on desktop Chrome too, so testing for it alone is not
// enough: on Windows it pops the OS share dialog and makes you choose an app just
// to hand over a few emoji. The sheet is genuinely good on a phone (one tap into
// WhatsApp) and a nuisance on a desktop, so decide on the DEVICE, not the API.
export function shouldUseShareSheet() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  if (!navigator.share) return false;

  // Inside the installed app the native sheet is exactly what we want.
  if (getPlatform() !== "web") return true;

  // Chromium states outright whether this is a mobile device — trust it. This is
  // what tells Windows/macOS Chrome (false) apart from Android Chrome (true).
  const uaMobile = navigator.userAgentData?.mobile;
  if (typeof uaMobile === "boolean") return uaMobile;

  // Safari and Firefox do not expose User-Agent Client Hints, so fall back to the
  // pointer: a touch-primary device (phone, iPad) is one where the sheet belongs,
  // a mouse-driven one is not.
  return window.matchMedia?.("(any-pointer: coarse)")?.matches ?? false;
}
