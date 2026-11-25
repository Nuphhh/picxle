// The anonymous per-device player ID: a random UUID kept in localStorage.
// It links a player's guesses, completions and analytics events together
// without knowing who they are.
const KEY = "picxle-player-id";

/** The saved ID (created on first use), or null if storage is blocked. */
export function storedPlayerId(): string | null {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

// The guess API needs SOME ID to count guesses against. If storage is blocked
// (private mode etc.) fall back to one that lasts for this page load.
let sessionPlayerId: string | null = null;

/** Always returns an ID: the saved one, or a per-page-load fallback. */
export function playerId(): string {
  return storedPlayerId() ?? (sessionPlayerId ??= crypto.randomUUID());
}
