// Thin, safe wrapper around PostHog. Every call is a no-op unless PostHog has
// actually been initialised (i.e. an API key is configured) — so the game keeps
// working with analytics turned off, and nothing throws if the SDK is blocked.
import posthog from "posthog-js";

// Anonymous, per-device id. Same key the completions logging already uses, so a
// player's events and their solved-puzzle records line up under one id.
export function getPlayerId() {
  try {
    let id = localStorage.getItem("picxle-player-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("picxle-player-id", id);
    }
    return id;
  } catch {
    return null;
  }
}

// Capture a product event. Safe to call anywhere on the client.
export function track(event, props) {
  try {
    if (typeof window !== "undefined" && posthog.__loaded) {
      posthog.capture(event, props);
    }
  } catch {
    /* analytics must never break gameplay */
  }
}
