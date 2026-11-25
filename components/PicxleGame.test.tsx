// @vitest-environment jsdom
//
// The whole game screen, played the way a person would: type, click, read.
//
// The comment above tells Vitest to run this file in jsdom, a fake browser
// written in JavaScript (the other test files run in plain Node). The game gets
// GameDeps whose API client talks to the REAL server handlers over the
// in-process "network". So these tests cover React + browser adapter + use
// cases + domain rules together, with no database and no real browser.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { GameApi, GameDeps } from "@/src/application/client-ports";
import { httpGameApi } from "@/src/adapters/browser/http-game-api";
import { fixedClock, memoryServerDeps } from "@/src/adapters/memory";
import { memoryProgressStore } from "@/src/adapters/memory/progress-store";
import { addGuess, guessRow, NEW_GAME } from "@/src/domain/game";
import { inProcessServer } from "@/src/test/in-process-server";
import { NOW, PLAYER, TODAY, YESTERDAY } from "@/src/test/fixtures";
import PicxleGame from "./PicxleGame";

beforeAll(() => {
  // jsdom has no <canvas> drawing and no media queries. Returning null makes
  // the pixelation code skip drawing (it already handles that case), and
  // "not dark" keeps the screen in the light theme.
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

afterEach(cleanup);

/** Build a game wired to an in-memory server. Yesterday is "declined" by
 *  default so the game goes straight to today's puzzle. */
function setup({
  server = inProcessServer(),
  store = memoryProgressStore(),
  declineYesterday = true,
  wrapApi = (api: GameApi) => api,
} = {}) {
  if (declineYesterday) store.markDeclined(YESTERDAY.id);
  const deps: GameDeps = {
    api: wrapApi(httpGameApi("", server.fetch)),
    progress: store,
    clock: fixedClock(NOW),
    playerId: () => PLAYER,
    track: vi.fn(),
    share: vi.fn(async () => "copied" as const),
    onWin: vi.fn(),
  };
  render(<PicxleGame deps={deps} />);
  return { deps, server, store };
}

const input = () => screen.findByPlaceholderText("type your guess");

async function guess(text: string) {
  fireEvent.change(await input(), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "GUESS" }));
}

describe("PicxleGame", () => {
  it("says so when there's no puzzle today", async () => {
    setup({ server: inProcessServer(memoryServerDeps([], NOW)) });
    expect(await screen.findByText("No puzzle today — check back tomorrow.")).toBeTruthy();
  });

  it("rejects words that aren't in the answer list without using a guess", async () => {
    const { server } = setup();
    await guess("qwertyuiop");
    expect(await screen.findByText("Not in the answer list — pick from the suggestions.")).toBeTruthy();
    expect(server.requests.some((r) => r.startsWith("POST /api/guess"))).toBe(false);
  });

  it("a wrong guess fills a row and keeps the game going", async () => {
    const { store } = setup();
    await guess("France");
    expect(await screen.findByText("France")).toBeTruthy();
    expect(store.load(TODAY.id)?.guesses).toHaveLength(1);
    expect(screen.getByPlaceholderText("type your guess")).toBeTruthy();
  });

  it("a right guess wins: the answer comes from the server, and the result is recorded once", async () => {
    const { deps, server, store } = setup();
    await guess("japan");

    // The answer is never in the page until the server reveals it.
    expect((await screen.findAllByText("Japan")).length).toBeGreaterThan(0);
    await waitFor(() => expect(store.isRecorded(TODAY.id)).toBe(true));
    expect(server.deps.completions.rows).toHaveLength(1);
    expect(server.deps.completions.rows[0]).toMatchObject({ puzzleId: TODAY.id, guessesTaken: 1, playerId: PLAYER });
    expect(deps.onWin).toHaveBeenCalledOnce();
    expect(deps.track).toHaveBeenCalledWith("puzzle_completed", expect.objectContaining({ result: "won", guesses: 1 }));
  });

  it("doesn't burn a guess if the server didn't record it", async () => {
    const { store } = setup({
      wrapApi: (api) => ({ ...api, submitGuess: async () => null }),
    });
    await guess("France");
    // Wait for the button to come back from "…" to GUESS.
    await screen.findByRole("button", { name: "GUESS" });
    expect(screen.queryByText("France")).toBeNull();
    expect(store.load(TODAY.id)?.guesses ?? []).toHaveLength(0);
  });

  it("restores a half-played game from the device", async () => {
    const saved = addGuess(addGuess(NEW_GAME, guessRow("Peru", false)), guessRow("Chile", false));
    setup({ store: memoryProgressStore({ [TODAY.id]: saved }) });
    expect(await screen.findByText("Peru")).toBeTruthy();
    expect(screen.getByText("Chile")).toBeTruthy();
  });

  it("offers yesterday's puzzle first, and remembers a 'no thanks'", async () => {
    const { store } = setup({ declineYesterday: false });
    expect(await screen.findByText("You missed yesterday's puzzle.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /No thanks/ }));
    expect(store.isDeclined(YESTERDAY.id)).toBe(true);
    // ...and today's game appears.
    expect(await input()).toBeTruthy();
  });

  it("shares the emoji grid after a game", async () => {
    const { deps } = setup();
    await guess("japan");
    fireEvent.click(await screen.findByRole("button", { name: "SHARE RESULT" }, { timeout: 3000 }));
    await waitFor(() => expect(deps.share).toHaveBeenCalledOnce());
    expect(vi.mocked(deps.share).mock.calls[0][0]).toMatch(/Picxle/);
  });
});
