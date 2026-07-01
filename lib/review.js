// In-app review prompt (Google Play In-App Review API via the community plugin).
// Fired at a high-satisfaction moment (after a win), but only:
//   - inside the installed native app (never the website)
//   - after the player has won a few times (not a brand-new user)
//   - once, ever (we set the "asked" flag before calling)
// Google additionally rate-limits how often the card actually appears, so the
// dialog may not show every time even when requested — that's expected.
const WIN_KEY = "picxle-wins";
const ASKED_KEY = "picxle-review-asked";
const THRESHOLD = 3; // ask after the 3rd win

export function recordWin() {
  try {
    const n = parseInt(localStorage.getItem(WIN_KEY) || "0", 10) + 1;
    localStorage.setItem(WIN_KEY, String(n));
    return n;
  } catch {
    return 0;
  }
}

export async function maybeRequestReview() {
  try {
    const cap = typeof window !== "undefined" ? window.Capacitor : null;
    if (!(cap && cap.isNativePlatform && cap.isNativePlatform())) return; // native app only
    if (localStorage.getItem(ASKED_KEY) === "1") return;
    const wins = parseInt(localStorage.getItem(WIN_KEY) || "0", 10);
    if (wins < THRESHOLD) return;
    localStorage.setItem(ASKED_KEY, "1"); // set first so we never double-ask
    const { InAppReview } = await import("@capacitor-community/in-app-review");
    await InAppReview.requestReview();
  } catch {
    /* a review prompt must never break gameplay */
  }
}
