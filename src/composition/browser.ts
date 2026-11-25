// COMPOSITION ROOT (browser): the real adapters behind the game screen.
// PicxleGame uses these unless a test hands it something else.
import type { GameDeps } from "@/src/application/client-ports";
import { track } from "@/src/adapters/browser/analytics";
import { httpGameApi } from "@/src/adapters/browser/http-game-api";
import { localProgressStore } from "@/src/adapters/browser/local-progress-store";
import { playerId } from "@/src/adapters/browser/player-id";
import { maybeRequestReview, recordWin } from "@/src/adapters/browser/review";
import { shareText } from "@/src/adapters/browser/share";

export const browserGameDeps: GameDeps = {
  api: httpGameApi(process.env.NEXT_PUBLIC_API_BASE ?? ""),
  progress: localProgressStore(),
  clock: { now: () => new Date() },
  playerId,
  track,
  share: (text) => shareText(text),
  onWin: () => {
    recordWin();
    // after the reveal settles, maybe ask for a Play review (gated inside)
    setTimeout(() => void maybeRequestReview(), 2500);
  },
};
