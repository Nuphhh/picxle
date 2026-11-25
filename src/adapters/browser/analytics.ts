// Thin, safe wrapper around PostHog. Every call is a no-op unless PostHog has
// actually been initialised (i.e. an API key is configured) — so the game keeps
// working with analytics turned off, and nothing throws if the SDK is blocked.
import posthog from "posthog-js";
import { capacitor } from "./capacitor";

const OPT_OUT_KEY = "picxle-analytics-optout";

export type Platform = "android-app" | "ios-app" | "web";

// Where the session is running: the installed app vs a normal browser.
// Capacitor's getPlatform() returns "android" | "ios" | "web". Fall back to the
// Android WebView UA token ("wv)").
export function getPlatform(): Platform {
  try {
    const p = capacitor()?.getPlatform?.() ?? null;
    if (p === "android") return "android-app";
    if (p === "ios") return "ios-app";
    if (typeof navigator !== "undefined" && /wv\)/.test(navigator.userAgent)) return "android-app";
    return "web";
  } catch {
    return "web";
  }
}

/** Capture a product event. Safe to call anywhere on the client. */
export function track(event: string, props?: Record<string, unknown>): void {
  try {
    if (typeof window !== "undefined" && posthog.__loaded) posthog.capture(event, props);
  } catch {
    /* analytics must never break gameplay */
  }
}

// ── Opt-out (per device) ─────────────────────────────────────────────────────
// Persisted in localStorage and honoured on every load by app/providers.tsx.
export function isAnalyticsOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAnalyticsOptOut(optedOut: boolean): void {
  try {
    if (optedOut) {
      localStorage.setItem(OPT_OUT_KEY, "1");
      if (posthog.__loaded) posthog.opt_out_capturing();
    } else {
      localStorage.removeItem(OPT_OUT_KEY);
      if (posthog.__loaded) posthog.opt_in_capturing();
    }
  } catch {
    /* ignore storage failures */
  }
}
