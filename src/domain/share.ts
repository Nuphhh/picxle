// The Wordle-style emoji result players paste into chats.
import type { GameProgress } from "./game.ts";
import type { IsoDay } from "./dates.ts";
import { MAX_GUESSES } from "./rules.ts";

export const SITE_URL = "https://picxle.vercel.app";

/** 🟩 correct · 🟥 wrong · ⬜ skipped · ⬛ unused */
export function emojiRow(p: GameProgress): string {
  let row = "";
  for (let i = 0; i < MAX_GUESSES; i++) {
    const g = p.guesses[i];
    if (g?.correct) row += "🟩";
    else if (g?.skipped) row += "⬜";
    else if (g) row += "🟥";
    else row += "⬛";
  }
  return row;
}

/**
 * "Picxle 3/5\n🟥🟥🟩⬛⬛\nhttps://picxle.vercel.app/s/2026-11-25"
 * The /s/<date> link shows that day's pixelated teaser as the link preview.
 */
export function buildShareText(p: GameProgress, puzzleDate: IsoDay): string {
  const score = p.status === "won" ? `${p.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  return `Picxle ${score}\n${emojiRow(p)}\n${SITE_URL}/s/${puzzleDate}`;
}
