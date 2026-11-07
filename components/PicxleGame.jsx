"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { DICTIONARY, ARTIST_MAP, MAX_GUESSES, RES_STEPS, FULL_RES, CATEGORY_HINTS } from "@/data/puzzles";
import { apiUrl } from "@/lib/api";
import { track } from "@/lib/analytics";
import Link from "next/link";
import { getThemeMode, nextThemeMode, applyThemeMode, themeGlyph, themeLabel } from "@/lib/theme";
import { shouldUseShareSheet } from "@/lib/share";
import { normaliseGuess } from "@/lib/normalise";
import { recordWin, maybeRequestReview } from "@/lib/review";

// Colours are CSS custom properties (defined in globals.css) driven by the
// data-theme attribute on <html>. Because every value below is a var()
// reference, the rendered markup is identical regardless of theme — so the
// correct theme paints on the very first frame with no flash and no
// hydration mismatch. The -RGB entries compose translucent colours via rgba().
const C = {
  ink:      "var(--ink)",
  ink2:     "var(--ink2)",
  cream:    "var(--cream)",
  creamDim: "var(--creamDim)",
  coral:    "var(--coral)",
  green:    "var(--green)",
  blue:     "var(--blue)",
  line:     "var(--line)",
  greenRGB: "var(--green-rgb)",
  coralRGB: "var(--coral-rgb)",
  blueRGB:  "var(--blue-rgb)",
};

// Shared with the guess API — the client blocks anything not in the dictionary,
// so if the two normalised differently a player could type a word the server
// would happily accept and be told it isn't a word.
const norm = normaliseGuess;

// Images load through our own server, by puzzle ID only. The real file address
// usually contains the answer ("Axolotl.jpg"), so it never reaches the browser.
const puzzleImageUrl = (p) => apiUrl(`/api/puzzle/image?puzzleId=${p.id}`);

// The guess API needs an ID to count guesses against. If storage is blocked
// (private mode etc.) fall back to one that lasts for this page load.
let sessionPlayerId = null;
function getPlayerId() {
  try {
    let id = localStorage.getItem("picxle-player-id");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("picxle-player-id", id); }
    return id;
  } catch {
    return (sessionPlayerId ??= crypto.randomUUID());
  }
}

export default function PicxleGame() {
  // The pre-paint script in the root layout already applied the correct theme
  // (data-theme on <html>), so colours never flash. We only mirror that choice
  // into React state for the toggle button and a couple of JS-only needs
  // (the canvas fallback and the difficulty pill read live values).
  const [themeMode, setThemeMode] = useState("system");
  useEffect(() => {
    setThemeMode(getThemeMode());
    const onChange = () => setThemeMode(getThemeMode());
    window.addEventListener("picxle-themechange", onChange);
    return () => window.removeEventListener("picxle-themechange", onChange);
  }, []);

  const [puzzle, setPuzzle] = useState(null);
  const [puzzleError, setPuzzleError] = useState(false);

  const [guesses, setGuesses] = useState([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState("playing");
  const [shake, setShake] = useState(false);
  const [copied, setCopied] = useState(false);
  // Whether sharing should open the OS sheet (phone) or just copy (desktop).
  // Resolved after mount because the check reads navigator/window.
  const [useShareSheet, setUseShareSheet] = useState(false);
  useEffect(() => setUseShareSheet(shouldUseShareSheet()), []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imgReady, setImgReady] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [hintOpen, setHintOpen] = useState(false);
  const [revealedAnswer, setRevealedAnswer] = useState(null);
  // Image credit ("Rossysphotos, CC BY 4.0"), sent with the answer once finished.
  const [imageCredit, setImageCredit] = useState(null);
  const [stats, setStats] = useState(null);
  const [playerStreak, setPlayerStreak] = useState(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dictError, setDictError] = useState(false);
  const [showMissedPrompt, setShowMissedPrompt] = useState(false);
  const [yesterdayPuzzle, setYesterdayPuzzle] = useState(null);
  // Guesses already made on yesterday's puzzle, so the prompt can offer to resume.
  const [yesterdayGuesses, setYesterdayGuesses] = useState(0);

  // Design state
  const [flashing, setFlashing] = useState(false);   // canvas sharpen flash
  const [inputFocused, setInputFocused] = useState(false);
  const [barsActive, setBarsActive] = useState(false); // stats bar animation trigger

  const srcRef = useRef(null);
  const canvasRef = useRef(null);
  const modalCanvasRef = useRef(null);
  const alreadyFinishedOnMount = useRef(false);
  const pendingTodayRef = useRef(null);
  // Tracks which guess row indices have already played their entrance animation
  const animatedRowIndices = useRef(new Set());
  // Tracks previous res value to detect sharpening moments
  const prevResRef = useRef(null);

  const guessesMade = guesses.length;
  const revealed = status !== "playing";
  const res = revealed
    ? FULL_RES
    : RES_STEPS[Math.min(guessesMade, RES_STEPS.length - 1)];

  const isYesterdaysPuzzle = puzzle &&
    puzzle.puzzle_date !== new Date().toISOString().slice(0, 10);

  // Read a puzzle's saved progress ({ guesses, status }), or null if never opened.
  const readProgress = (id) => {
    if (!id) return null;
    try { return JSON.parse(localStorage.getItem(`picxle-${id}`)); } catch { return null; }
  };

  // "No thanks" is the only thing (besides finishing) that stops us offering
  // yesterday's puzzle, so remember it against that specific puzzle.
  const declineYesterday = () => {
    if (yesterdayPuzzle) {
      localStorage.setItem(`picxle-declined-${yesterdayPuzzle.id}`, "1");
      track("yesterday_declined", { guesses_made: yesterdayGuesses });
    }
    setShowMissedPrompt(false);
    activatePuzzle(pendingTodayRef.current);
  };

  const activatePuzzle = (data) => {
    setPuzzle(data);
    fetch(apiUrl(`/api/stats/today?puzzleId=${data.id}`)).then((r) => r.json()).then((d) => setStats(d)).catch(() => {});
    const saved = localStorage.getItem(`picxle-${data.id}`);
    if (saved) {
      try {
        const { guesses: g, status: s } = JSON.parse(saved);
        setGuesses(g);
        setStatus(s);
        if (s !== "playing") alreadyFinishedOnMount.current = true;
      } catch {}
    }
  };

  const switchToToday = () => {
    setGuesses([]);
    setStatus("playing");
    setRevealedAnswer(null);
    setImageCredit(null);
    setStats(null);
    setPlayerStreak(null);
    animatedRowIndices.current.clear();
    prevResRef.current = null;
    alreadyFinishedOnMount.current = false;
    if (pendingTodayRef.current) {
      activatePuzzle(pendingTodayRef.current);
    } else {
      fetch(apiUrl("/api/puzzle/today"))
        .then((r) => r.json())
        .then((data) => { if (!data.error) activatePuzzle(data); })
        .catch(() => {});
    }
  };

  // Re-read yesterday's progress on every render rather than trusting the value
  // captured at page load — the player may have just finished it in this session,
  // in which case the results screen must stop offering it.
  const yesterdaySaved = yesterdayPuzzle ? readProgress(yesterdayPuzzle.id) : null;
  const yesterdayUnfinished =
    !!yesterdayPuzzle && (!yesterdaySaved || yesterdaySaved.status === "playing");
  const yesterdaySoFar = yesterdaySaved?.guesses?.length ?? 0;

  // Jump to yesterday's puzzle from the results screen. Same reset as
  // switchToToday; activatePuzzle then restores any saved guesses, so a
  // part-played puzzle picks up where it left off rather than restarting.
  const switchToYesterday = () => {
    if (!yesterdayPuzzle) return;
    track("yesterday_opened", {
      from: "after_today",
      resumed: yesterdayGuesses > 0,
      guesses_made: yesterdayGuesses,
    });
    setGuesses([]);
    setStatus("playing");
    setRevealedAnswer(null);
    setImageCredit(null);
    setStats(null);
    setPlayerStreak(null);
    setStatsOpen(false);
    animatedRowIndices.current.clear();
    prevResRef.current = null;
    alreadyFinishedOnMount.current = false;
    activatePuzzle(yesterdayPuzzle);
  };

  useEffect(() => {
    Promise.all([
      fetch(apiUrl("/api/puzzle/today")).then((r) => r.json()),
      fetch(apiUrl("/api/puzzle/yesterday")).then((r) => r.json()).catch(() => ({ error: true })),
    ])
      .then(([todayData, yesterdayData]) => {
        if (todayData.error) { setPuzzleError(true); return; }
        // Keep offering yesterday's puzzle until it is actually FINISHED (won/lost)
        // or the player has explicitly said no. Checking only "is there a saved
        // entry" would hide the offer forever, because the autosave effect writes
        // an entry the moment the puzzle is opened — so someone who tapped in and
        // closed the app mid-puzzle could never get back to it.
        const saved = readProgress(yesterdayData?.id);
        const finished = saved ? saved.status !== "playing" : false;
        const declined = yesterdayData?.id
          ? !!localStorage.getItem(`picxle-declined-${yesterdayData.id}`)
          : false;

        // Hold on to yesterday's puzzle whenever it is unfinished — even if the
        // player declined the prompt. Declining means "not before today's", not
        // "never": players finish today's, want to keep going, and expect to find
        // yesterday's waiting. It is offered again on the results screen.
        const unfinished = yesterdayData && !yesterdayData.error && !finished;
        if (unfinished) {
          setYesterdayPuzzle(yesterdayData);
          setYesterdayGuesses(saved?.guesses?.length ?? 0);
        }
        pendingTodayRef.current = todayData;

        if (unfinished && !declined) setShowMissedPrompt(true);
        else activatePuzzle(todayData);
      })
      .catch(() => setPuzzleError(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!puzzle) return;
    localStorage.setItem(`picxle-${puzzle.id}`, JSON.stringify({ guesses, status }));
  }, [puzzle, guesses, status]);

  useEffect(() => {
    if (status === "playing" || !puzzle) return;
    fetch(apiUrl(`/api/puzzle/reveal?puzzleId=${puzzle.id}&playerId=${getPlayerId()}`))
      .then((r) => r.json())
      .then((data) => {
        setRevealedAnswer(data.answer ?? null);
        setImageCredit(data.attribution ?? null);
      })
      .catch(() => {});
  }, [status, puzzle]);

  useEffect(() => {
    if (status === "playing" || !puzzle) return;
    const playerId = getPlayerId();
    const fetchStreak = () => {
      if (!playerId) return;
      fetch(apiUrl(`/api/stats/streak?playerId=${playerId}`))
        .then((r) => r.json())
        .then((data) => setPlayerStreak(data))
        .catch(() => {});
    };
    const fetchDistribution = () => {
      const openOnComplete = !alreadyFinishedOnMount.current;
      fetch(apiUrl(`/api/stats/today?puzzleId=${puzzle.id}`))
        .then((r) => r.json())
        .then((data) => { setStats(data); if (openOnComplete) setStatsOpen(true); })
        .catch(() => {});
    };
    const recordedKey = `picxle-recorded-${puzzle.id}`;
    if (!localStorage.getItem(recordedKey)) {
      const guessesTaken = status === "won" ? guesses.length : 6;
      track("puzzle_completed", { result: status, guesses: guesses.length, category: puzzle.category, puzzle_date: puzzle.puzzle_date });
      if (status === "won") {
        recordWin();
        // after the reveal settles, maybe ask for a Play review (gated inside)
        setTimeout(() => maybeRequestReview(), 2500);
      }
      fetch(apiUrl("/api/stats/record"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.id, guessesTaken, playerId }),
      })
        .then(() => {
          localStorage.setItem(recordedKey, "1");
          fetchDistribution();
          fetchStreak();
        })
        .catch(() => {});
    } else {
      fetchDistribution();
      fetchStreak();
    }
  }, [status, puzzle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire once per puzzle when it's first shown — the denominator for "viewed
  // but didn't finish" (abandonment), and the entry point of the play funnel.
  const viewedRef = useRef(null);
  useEffect(() => {
    if (!puzzle || viewedRef.current === puzzle.id) return;
    viewedRef.current = puzzle.id;
    track("puzzle_viewed", { puzzle_date: puzzle.puzzle_date, category: puzzle.category });
  }, [puzzle]);

  useEffect(() => {
    if (!puzzle) return;
    setImgReady(false);
    srcRef.current = null;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = puzzleImageUrl(puzzle);
    img.onload = () => {
      const s = document.createElement("canvas");
      s.width = 440; s.height = 440;
      const ctx = s.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (puzzle.category === "Flag") {
        const scale = Math.min(440 / img.naturalWidth, 440 / img.naturalHeight);
        const dw = Math.round(img.naturalWidth * scale);
        const dh = Math.round(img.naturalHeight * scale);
        const dx = Math.round((440 - dw) / 2);
        const dy = Math.round((440 - dh) / 2);
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx, dy, dw, dh);
      } else {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, 440, 440);
      }
      srcRef.current = s;
      setImgReady(true);
    };
    img.onerror = () => {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      // Canvas needs concrete colours, so resolve the theme vars at draw time.
      const cs = getComputedStyle(document.documentElement);
      ctx.fillStyle = cs.getPropertyValue("--ink2").trim() || "#ede8de";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = cs.getPropertyValue("--creamDim").trim() || "#7a6548";
      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("image failed to load", cv.width / 2, cv.height / 2);
    };
  }, [puzzle]); // eslint-disable-line react-hooks/exhaustive-deps

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    const src = srcRef.current;
    if (!cv || !src) return;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (res === FULL_RES) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, 0, 0, cv.width, cv.height);
    } else {
      const tmp = document.createElement("canvas");
      tmp.width = res; tmp.height = res;
      const tctx = tmp.getContext("2d");
      tctx.imageSmoothingEnabled = true;
      tctx.drawImage(src, 0, 0, res, res);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, res, res, 0, 0, cv.width, cv.height);
    }
  }, [res]);

  useEffect(() => { draw(); }, [draw, status, imgReady]);

  // Flash the canvas when the image sharpens to a new resolution —
  // a brief bright overlay fades out to reveal the crisper image.
  // This makes the core game mechanic feel like a real reveal moment.
  useEffect(() => {
    if (!imgReady) return;
    if (prevResRef.current !== null && prevResRef.current !== res) {
      setFlashing(true);
      const t = setTimeout(() => setFlashing(false), 420);
      prevResRef.current = res;
      return () => clearTimeout(t);
    }
    prevResRef.current = res;
  }, [res, imgReady]);

  useEffect(() => {
    if (!isExpanded) return;
    const cv = modalCanvasRef.current;
    const src = srcRef.current;
    if (!cv || !src) return;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (res === FULL_RES) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, 0, 0, cv.width, cv.height);
    } else {
      const tmp = document.createElement("canvas");
      tmp.width = res; tmp.height = res;
      const tctx = tmp.getContext("2d");
      tctx.imageSmoothingEnabled = true;
      tctx.drawImage(src, 0, 0, res, res);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, res, res, 0, 0, cv.width, cv.height);
    }
  }, [isExpanded, res, imgReady]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { setIsExpanded(false); setHintOpen(false); setStatsOpen(false); setProfileOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.background = C.ink;
  }, [C.ink]);

  // Trigger bar animation after stats modal has opened and rendered
  useEffect(() => {
    if (statsOpen) {
      setBarsActive(false);
      const t = setTimeout(() => setBarsActive(true), 80);
      return () => clearTimeout(t);
    }
  }, [statsOpen]);

  useEffect(() => {
    if (status === "playing") return;
    const tick = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setUTCHours(24, 0, 0, 0);
      const diff = midnight - now;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    setDictError(false);
    const q = norm(val);
    if (q.length < 2) { setSuggestions([]); return; }
    // How well a name matches what was typed — lower is better:
    //   0  starts with it            "ca" -> "cat"
    //   1  a later word starts with it  "ca" -> "antelope canyon"
    //   2  contains it anywhere      "ca" -> "pelican"
    const rank = (s) => (s.startsWith(q) ? 0 : s.includes(" " + q) ? 1 : s.includes(q) ? 2 : 9);

    // Every matching answer gets its best rank: either from its own name, or
    // from its artist's name (typing "monet" offers "water lilies"). Ranking
    // artists the same way stops "ca" filling every slot with Picasso
    // paintings just because "ca" sits in the middle of "picasso".
    const best = new Map(); // answer -> [rank, viaArtist]
    for (const w of DICTIONARY) {
      const r = rank(w);
      if (r < 9) best.set(w, [r, 0]);
    }
    for (const [artist, works] of Object.entries(ARTIST_MAP)) {
      const r = rank(artist);
      if (r === 9) continue;
      for (const w of works) {
        const prev = best.get(w);
        if (!prev || r < prev[0]) best.set(w, [r, 1]);
      }
    }
    // Sort by rank; on a tie, a direct name match beats an artist match, then
    // shorter beats longer ("cat" is a likelier guess than "caterpillar").
    const ordered = [...best.entries()]
      .sort(([a, [ra, va]], [b, [rb, vb]]) => ra - rb || va - vb || a.length - b.length)
      .map(([w]) => w);
    setSuggestions(ordered.slice(0, 6));
  };

  // Picking a suggestion closes the keyboard on purpose: on a phone the GUESS
  // button sits underneath it, so this brings the button back into view.
  const selectSuggestion = (word) => {
    setInput(word);
    setSuggestions([]);
    inputRef.current?.blur();
  };

  // ── Which way the suggestion list opens ──
  // The list normally drops BELOW the guess box. On a phone the keyboard covers
  // the bottom of the screen, so below is exactly where the list gets hidden.
  // window.visualViewport is the part of the page actually visible right now
  // (it shrinks when the keyboard opens), so we measure the room above and
  // below the box inside it and open upward when there isn't room below.
  const inputRef = useRef(null);
  const [dropUp, setDropUp] = useState(false);
  const [listMaxH, setListMaxH] = useState(220);
  const placeSuggestions = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const vv = window.visualViewport;
    const box = el.getBoundingClientRect();
    const visibleTop = vv ? vv.offsetTop : 0;
    const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const roomBelow = visibleBottom - box.bottom - 8;
    const roomAbove = box.top - visibleTop - 8;
    const up = roomBelow < 160 && roomAbove > roomBelow;
    setDropUp(up);
    // Never taller than the room it has — or 220px, which keeps it over the
    // guess rows and off the picture.
    setListMaxH(Math.max(100, Math.min(220, up ? roomAbove : roomBelow)));
  }, []);
  // useLayoutEffect runs before the browser paints, so the list never flashes
  // in the wrong direction first. Re-measure while it's open, because iOS
  // scrolls the page and resizes the visible area as the keyboard animates in.
  const suggestionsOpen = suggestions.length > 0;
  useLayoutEffect(() => {
    if (!suggestionsOpen) return;
    placeSuggestions();
    const vv = window.visualViewport;
    if (!vv) return;
    vv.addEventListener("resize", placeSuggestions);
    vv.addEventListener("scroll", placeSuggestions);
    window.addEventListener("scroll", placeSuggestions);
    return () => {
      vv.removeEventListener("resize", placeSuggestions);
      vv.removeEventListener("scroll", placeSuggestions);
      window.removeEventListener("scroll", placeSuggestions);
    };
  }, [suggestionsOpen, placeSuggestions]);

  // ── Park the guess box just above the keyboard ──
  // When you tap the box, the phone's keyboard slides up over the bottom of the
  // screen. The browser tries to scroll the box into view itself, but on iPhone
  // it often leaves it hidden behind the keyboard or Chrome's toolbar. So once
  // the keyboard has FINISHED opening, we scroll the page one time so the box's
  // bottom edge sits 12px above the keyboard. That also leaves as much of the
  // picture as possible visible above it. After that one nudge we let go — you
  // can scroll freely, and we don't fight you.
  //
  // How we know the keyboard has finished: visualViewport (the visible part of
  // the page) fires "resize" events while the keyboard animates. We wait until
  // they've stopped for 120ms ("debouncing"), then measure. If the visible area
  // never shrank, there's no on-screen keyboard (a computer), so we don't scroll.
  const stopKeyboardWatch = useRef(null);
  const placeInputAboveKeyboard = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    stopKeyboardWatch.current?.(); // cancel any watch left over from a previous tap
    const heightBefore = vv.height;
    let settleTimer;
    const stop = () => {
      vv.removeEventListener("resize", onResize);
      clearTimeout(settleTimer);
      clearTimeout(giveUpTimer);
      stopKeyboardWatch.current = null;
    };
    const onResize = () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        stop();
        const el = inputRef.current;
        if (!el || document.activeElement !== el) return; // they tapped away already
        if (vv.height > heightBefore - 120) return;       // visible area barely changed: no keyboard
        const box = el.getBoundingClientRect();
        const keyboardTop = vv.offsetTop + vv.height;     // bottom of what you can see
        const distance = box.bottom - (keyboardTop - 12);
        if (Math.abs(distance) > 4) window.scrollBy({ top: distance, behavior: "smooth" });
      }, 120);
    };
    // If no keyboard shows up within 1.2s (e.g. a hardware keyboard), give up.
    const giveUpTimer = setTimeout(stop, 1200);
    stopKeyboardWatch.current = stop;
    vv.addEventListener("resize", onResize);
  }, []);
  // Tidy up the listener if the game unmounts mid-watch.
  useEffect(() => () => stopKeyboardWatch.current?.(), []);

  const submit = async () => {
    if (status !== "playing" || !puzzle || isSubmitting) return;
    const g = norm(input);
    if (!g) return;
    if (!DICTIONARY.includes(g)) {
      setDictError(true);
      setShake(true);
      setTimeout(() => setShake(false), 380);
      return;
    }
    setIsSubmitting(true);
    const result = await sendGuess({ guess: g });
    setIsSubmitting(false);
    // The server keeps the real guess count — if it didn't record this one
    // (network blip, or it says the puzzle's already over), don't burn a guess.
    if (!result) return;
    const { correct } = result;
    const next = [...guesses, { text: input.trim(), correct, skipped: false }];
    setGuesses(next);
    // guess (a dictionary subject, not free text/PII) lets us spot where people
    // stall and which wrong answers are common per puzzle.
    track("guess_submitted", { guess_number: next.length, correct, guess: g });
    setInput("");
    setSuggestions([]);
    if (correct) {
      setStatus("won");
    } else if (next.length >= MAX_GUESSES) {
      setStatus("lost");
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 380);
    }
  };

  // POST a guess (or a skip) to the server. Returns { correct, guessNumber },
  // or null if the server didn't record it.
  const sendGuess = async (body) => {
    try {
      const res = await fetch(apiUrl("/api/guess"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.id, playerId: getPlayerId(), ...body }),
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  };

  // Skips go through the server too: they use up a guess, and the server has
  // to count them or it would think a player who skipped hasn't finished.
  const skip = async () => {
    if (status !== "playing" || isSubmitting) return;
    setIsSubmitting(true);
    const result = await sendGuess({ skip: true });
    setIsSubmitting(false);
    if (!result) return;
    setSuggestions([]);
    const next = [...guesses, { text: null, correct: false, skipped: true }];
    setGuesses(next);
    track("guess_skipped", { guess_number: next.length });
    if (next.length >= MAX_GUESSES) setStatus("lost");
  };

  const shareGrid = async () => {
    track("result_shared", { result: status, guesses: guesses.length });
    const n = guesses.length;
    const won = status === "won";
    const score = won ? `${n}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
    let row = "";
    for (let i = 0; i < MAX_GUESSES; i++) {
      const g = guesses[i];
      if (g?.correct) row += "🟩";
      else if (g?.skipped) row += "⬜";
      else if (g) row += "🟥";
      else row += "⬛";
    }
    const text = `Picxle ${score}\n${row}\nhttps://picxle.vercel.app/s/${puzzle.puzzle_date}`;
    // On a phone the OS share sheet is the right thing — one tap into WhatsApp.
    // On a desktop it is not: Windows Chrome implements navigator.share, so it
    // used to pop the OS dialog and make you pick an app just to pass along a
    // line of emoji. Desktop just copies. See useShareSheet().
    if (useShareSheet) {
      try {
        await navigator.share({ title: "Picxle", text });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return; // user dismissed the sheet
        // anything else (e.g. share not permitted): fall through to clipboard
      }
    }
    try { await navigator.clipboard?.writeText(text); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const rows = [];
  for (let i = 0; i < MAX_GUESSES; i++) rows.push(guesses[i] || null);

  if (puzzleError) {
    return (
      <div style={{ background: C.ink, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.creamDim, fontFamily: "var(--font-space-mono), monospace", fontSize: 14 }}>
        No puzzle today — check back tomorrow.
      </div>
    );
  }

  if (showMissedPrompt && yesterdayPuzzle) {
    return (
      <div className="page-root" style={{ background: `radial-gradient(140% 100% at 50% 0%, ${C.ink2} 0%, ${C.ink} 55%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", fontFamily: "var(--font-space-mono), monospace" }}>
        <style>{`
          .pxbtn{transition:transform .12s ease,background .2s ease,color .2s ease}
          .pxbtn:hover{transform:translateY(-2px)}
          .pxbtn:active{transform:translateY(1px)}
        `}</style>
        <h1 style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: 46, letterSpacing: "-1.5px", margin: "0 0 32px", lineHeight: 1, color: C.cream }}>
          PIC<span style={{ color: C.blue }}>X</span>LE
        </h1>
        <div style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 340, textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: 20, color: C.cream, margin: "0 0 10px", letterSpacing: "-0.5px" }}>
            {yesterdayGuesses > 0
              ? "You didn't finish yesterday's puzzle."
              : "You missed yesterday's puzzle."}
          </p>
          <p style={{ fontSize: 13, color: C.creamDim, lineHeight: 1.7, margin: "0 0 28px" }}>
            {yesterdayGuesses > 0
              ? `Your ${yesterdayGuesses} ${yesterdayGuesses === 1 ? "guess is" : "guesses are"} saved — pick up where you left off.`
              : "Want to play it now before today's?"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="pxbtn" onClick={() => { setShowMissedPrompt(false); track("yesterday_opened", { resumed: yesterdayGuesses > 0, guesses_made: yesterdayGuesses }); activatePuzzle(yesterdayPuzzle); }}
              style={{ background: C.cream, color: C.ink, border: "none", borderRadius: 9, padding: "14px 0", fontWeight: 800, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 16, cursor: "pointer", width: "100%" }}>
              {yesterdayGuesses > 0
                ? `Resume yesterday's (${yesterdayGuesses}/${MAX_GUESSES})`
                : "Play yesterday's"}
            </button>
            <button className="pxbtn" onClick={declineYesterday}
              style={{ background: "transparent", color: C.creamDim, border: `1px solid ${C.line}`, borderRadius: 9, padding: "14px 0", fontWeight: 700, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 14, cursor: "pointer", width: "100%" }}>
              No thanks — play today&apos;s
            </button>
          </div>
          <p style={{ fontSize: 11, color: C.creamDim, lineHeight: 1.6, margin: "16px 0 0", opacity: 0.75 }}>
            We&apos;ll keep offering it until you finish it or say no.
          </p>
        </div>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div style={{ background: C.ink, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.creamDim, fontFamily: "var(--font-space-mono), monospace", fontSize: 13, letterSpacing: "1px" }}>
        LOADING…
      </div>
    );
  }

  // Derive canvas glow based on game state
  const canvasGlow = status === "won"
    ? `0 18px 40px -20px #000, 0 0 0 2px rgba(${C.greenRGB}, .33)`
    : status === "lost"
    ? `0 18px 40px -20px #000, 0 0 0 2px rgba(${C.coralRGB}, .27)`
    : "0 18px 40px -20px #000";

  return (
    <div
      className="page-root"
      style={{
        background: `radial-gradient(120% 90% at 50% 0%, ${C.ink2} 0%, ${C.ink} 60%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "var(--px-pad-top) 18px var(--px-pad-bottom)",
        fontFamily: "var(--font-space-mono), monospace",
        color: C.cream,
        animation: "pageIn .35s ease both",
      }}
    >
      <style>{`
        @keyframes shk {
          0%,100% { transform: translateX(0) }
          20%      { transform: translateX(-8px) }
          40%      { transform: translateX(6px) }
          60%      { transform: translateX(-4px) }
          80%      { transform: translateX(2px) }
        }
        @keyframes pop {
          0%   { transform: scale(.86) translateY(6px); opacity: 0 }
          65%  { transform: scale(1.04) translateY(-2px); opacity: 1 }
          100% { transform: scale(1) translateY(0); opacity: 1 }
        }
        @keyframes flashFade {
          0%   { opacity: .8 }
          40%  { opacity: .5 }
          100% { opacity: 0 }
        }
        @keyframes modalIn {
          from { transform: scale(0.95) translateY(10px); opacity: 0 }
          to   { transform: scale(1) translateY(0); opacity: 1 }
        }
        @keyframes overlayIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-5px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes pageIn {
          from { opacity: 0; transform: translateY(10px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes sharpPulse {
          0%,100% { opacity: 1; transform: scaleY(1) }
          50%     { opacity: .6; transform: scaleY(1.14) }
        }
        .pxbtn { transition: transform .12s ease, background .2s ease, color .2s ease, box-shadow .2s ease }
        .pxbtn:hover  { transform: translateY(-2px) }
        .pxbtn:active { transform: translateY(1px) }
        input::placeholder { color: ${C.creamDim}; opacity: .6 }
        @keyframes riseIn {
          from { opacity: 0; transform: translateY(5px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        /* 44px tall rows = Apple's minimum comfortable touch target. */
        .px-suggestion { flex-shrink: 0; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; padding: 10px 14px; font-size: 15px; color: ${C.cream}; cursor: pointer; border-bottom: 1px solid ${C.line}; transition: background .1s ease; -webkit-tap-highlight-color: transparent; user-select: none; }
        .px-suggestion:hover, .px-suggestion:active { background: ${C.line}; }
        .px-suggestion:last-child { border-bottom: none; }
        /* Flipped list: the dividers have to flip too, or the row next to the box
           gets a doubled border. */
        .px-sugg-up .px-suggestion { border-bottom: none; border-top: 1px solid ${C.line}; }
        .px-sugg-up .px-suggestion:last-child { border-top: none; }
      `}</style>

      {/* ── Header ── */}
      {/* Fixed width keeps the corner buttons pinned to the layout edges —
          without it, hiding the tagline on short screens shrink-wraps the
          header to the logo and the buttons collide with it. */}
      <div style={{ textAlign: "center", marginBottom: "var(--px-head-mb)", position: "relative", width: "min(316px, 100%)" }}>

        {/* Profile button */}
        <button
          onClick={() => {
            setProfileOpen(true);
            if (!playerStreak) {
              const pid = getPlayerId();
              if (pid) fetch(apiUrl(`/api/stats/streak?playerId=${pid}`)).then(r => r.json()).then(d => setPlayerStreak(d)).catch(() => {});
            }
          }}
          title="Your profile"
          style={{
            position: "absolute", top: 0, left: 0,
            background: "transparent", border: `1px solid ${C.line}`,
            borderRadius: 20, padding: "4px 10px", fontSize: 13,
            cursor: "pointer", color: C.creamDim, lineHeight: 1, display: "flex", alignItems: "center", gap: 5,
            transition: "border-color .15s, color .15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.creamDim; e.currentTarget.style.color = C.cream; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.creamDim; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="7" r="5"/>
            <path d="M3 21c0-5 4-8 9-8s9 3 9 8"/>
          </svg>
        </button>

        {/* How to play */}
        <button
          onClick={() => setHelpOpen(true)}
          title="How to play"
          aria-label="How to play"
          style={{
            position: "absolute", top: 0, left: 42,
            background: "transparent", border: `1px solid ${C.line}`,
            borderRadius: 20, padding: "4px 10px", fontSize: 13, fontWeight: 700,
            cursor: "pointer", color: C.creamDim, lineHeight: 1,
            transition: "border-color .15s, color .15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.creamDim; e.currentTarget.style.color = C.cream; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.creamDim; }}
        >
          ?
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => { const next = nextThemeMode(themeMode); applyThemeMode(next); setThemeMode(next); }}
          title={`Theme: ${themeLabel(themeMode)} — tap to change`}
          aria-label={`Theme: ${themeLabel(themeMode)}. Tap to change.`}
          style={{
            position: "absolute", top: 0, right: 0,
            background: "transparent", border: `1px solid ${C.line}`,
            borderRadius: 20, padding: "4px 10px", fontSize: 14,
            cursor: "pointer", color: C.creamDim, lineHeight: 1,
            transition: "border-color .15s, color .15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.creamDim; e.currentTarget.style.color = C.cream; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.creamDim; }}
        >
          {themeGlyph(themeMode)}
        </button>

        <h1 style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: "var(--px-logo)", letterSpacing: "-1.5px", margin: 0, lineHeight: 1, color: C.cream }}>
          <Link href="/" aria-label="Back to Picxle home" style={{ color: "inherit", textDecoration: "none", display: "inline-block" }}>
            PIC<span style={{ color: C.blue }}>X</span>LE
          </Link>
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: C.creamDim, letterSpacing: "1px", display: "var(--px-tagline)" }}>
          GUESS THE IMAGE · IT SHARPENS AS YOU MISS
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}>
          <button
            onClick={() => setHintOpen(true)}
            style={{
              padding: "3px 12px", borderRadius: 20, border: `1px solid ${C.line}`, background: "transparent",
              fontSize: 11, letterSpacing: "1.5px", color: C.creamDim, cursor: "pointer",
              transition: "border-color .15s, color .15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.creamDim; e.currentTarget.style.color = C.cream; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.creamDim; }}
          >
            {puzzle.category.toUpperCase()} ›
          </button>
          {(() => {
            if (!stats || stats.total < 5) return null;
            const avg = [1,2,3,4,5,6].reduce((sum, n) => sum + n * (stats.counts[n] ?? 0), 0) / stats.total;
            const { label, color } =
              avg <= 2 ? { label: "EASY",   color: C.green } :
              avg <= 3 ? { label: "MEDIUM", color: C.blue } :
              avg <= 4 ? { label: "HARD",   color: "#f97316" } :
                         { label: "BRUTAL", color: C.coral };
            return (
              <span style={{ padding: "3px 10px", borderRadius: 20, border: `1px solid ${color}`, fontSize: 11, letterSpacing: "1.5px", color }}>
                {label}
              </span>
            );
          })()}
        </div>
      </div>

      {/* ── Category hint modal ── */}
      {hintOpen && (
        <div onClick={() => setHintOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, animation: "overlayIn .15s ease" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 16, padding: "24px 20px", width: "min(90vw, 380px)", maxHeight: "75vh", display: "flex", flexDirection: "column", position: "relative", animation: "modalIn .22s cubic-bezier(0.175,0.885,0.32,1.275) both" }}>
            <button onClick={() => setHintOpen(false)} style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%", background: C.line, border: "none", color: C.cream, fontSize: 18, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            <p style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: 18, color: C.cream, marginBottom: 4 }}>{puzzle.category}</p>
            <p style={{ fontSize: 11, color: C.creamDim, letterSpacing: "0.5px", marginBottom: 16 }}>Examples from this category — your answer is something like these.</p>
            <div style={{ overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(CATEGORY_HINTS[puzzle.category] ?? []).map((item) => (
                <span key={item} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${C.line}`, fontSize: 12, color: C.creamDim }}>{item}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Stats modal ── */}
      {statsOpen && stats && (
        <div onClick={() => setStatsOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, animation: "overlayIn .15s ease" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 16, width: "min(90vw, 380px)", position: "relative", overflow: "hidden", animation: "modalIn .22s cubic-bezier(0.175,0.885,0.32,1.275) both" }}>
            <button onClick={() => setStatsOpen(false)} style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: "none", color: "#fff", fontSize: 18, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>×</button>

            <div style={{ maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ width: "100%", height: "min(55vw, 220px)", overflow: "hidden" }}>
                <img src={puzzleImageUrl(puzzle)} alt="today's puzzle" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>

              {revealedAnswer && (
                <p style={{ textAlign: "center", margin: "14px 20px 0", fontSize: 13, color: C.creamDim }}>
                  it was{" "}
                  <span style={{ color: C.cream, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
                    {revealedAnswer}
                  </span>
                </p>
              )}

              {/* CC-BY needs a credit where the image is shown. The credits page
                  only lists a puzzle once its day is over, so today's lives here. */}
              {imageCredit && (
                <p style={{ textAlign: "center", margin: "4px 20px 0", fontSize: 11, color: C.creamDim }}>
                  Image: {imageCredit} ·{" "}
                  <a href="/credits" style={{ color: C.creamDim }}>credits</a>
                </p>
              )}

              <div style={{ padding: "8px 20px 0", textAlign: "center" }}>
                {(() => {
                  const { text, color } = status === "won"
                    ? [
                        { text: "Absolutely unreal.",    color: C.blue },
                        { text: "Sharp eye.",            color: C.green },
                        { text: "Solid.",                color: C.green },
                        { text: "Got there in the end.", color: C.cream },
                        { text: "That was close.",       color: C.creamDim },
                      ][guesses.length - 1]
                    : { text: "Better luck tomorrow.",   color: C.coral };
                  return <p style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: 20, color, margin: 0, letterSpacing: "-0.5px" }}>{text}</p>;
                })()}
              </div>

              <div style={{ padding: "16px 20px 20px" }}>
                {playerStreak && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    {[
                      { label: "PLAYED", value: playerStreak.played },
                      { label: "WIN %",  value: `${playerStreak.winPct}%` },
                      { label: "STREAK", value: playerStreak.current },
                      { label: "BEST",   value: playerStreak.max },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ flex: 1, textAlign: "center", background: C.ink, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 4px" }}>
                        <div style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: 22, color: C.cream, lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 9, letterSpacing: "1px", color: C.creamDim, marginTop: 4 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                )}

                <p style={{ fontSize: 10, letterSpacing: "2px", color: C.creamDim, margin: "0 0 10px", textAlign: "center" }}>GUESS DISTRIBUTION</p>
                {(() => {
                  const maxCount = Math.max(...Object.values(stats.counts), 1);
                  return [1, 2, 3, 4, 5, 6].map((n) => {
                    const count = stats.counts[n] ?? 0;
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                    const barPct = Math.round((count / maxCount) * 100);
                    const isMe = (status === "won" && n === guesses.length) || (status === "lost" && n === 6);
                    const barColor = isMe ? (status === "won" ? C.green : C.coral) : C.line;
                    // Bars animate from 0 → target width after modal opens (barsActive state)
                    const targetWidth = count > 0 ? `${Math.max(barPct, 8)}%` : "4%";
                    return (
                      <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ width: 14, textAlign: "right", fontSize: 13, color: isMe ? C.cream : C.creamDim, fontWeight: isMe ? 700 : 400, flexShrink: 0 }}>
                          {n === 6 ? "X" : n}
                        </span>
                        <div style={{ flex: 1, background: C.ink, borderRadius: 3, height: 22, overflow: "hidden" }}>
                          <div style={{
                            height: "100%",
                            width: barsActive ? targetWidth : "0%",
                            background: barColor,
                            borderRadius: 3,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            paddingRight: 7,
                            transition: `width .5s cubic-bezier(0.22,1,0.36,1) ${n * 40}ms`,
                          }}>
                            {count > 0 && barsActive && <span style={{ fontSize: 10, fontWeight: 700, color: isMe ? "#fff" : C.creamDim }}>{pct}%</span>}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
                <p style={{ fontSize: 11, color: C.creamDim, textAlign: "center", margin: "12px 0 0", letterSpacing: "0.5px" }}>
                  {stats.total.toLocaleString()} {stats.total === 1 ? "player" : "players"} today
                </p>

                <button className="pxbtn" onClick={shareGrid}
                  style={{ marginTop: 16, width: "100%", background: copied ? C.green : C.blue, color: C.ink, border: "none", borderRadius: 9, padding: "12px 0", fontWeight: 700, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 16, cursor: "pointer" }}>
                  {/* Always "share" — that's the intent. Copying is just how it's done on a
    desktop, and the COPIED confirmation says so after the fact. */}
{copied ? "COPIED ✓" : "SHARE RESULT"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Profile modal ── */}
      {helpOpen && (
        <div onClick={() => setHelpOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, animation: "overlayIn .15s ease", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 16, width: "min(90vw, 380px)", maxHeight: "90vh", overflowY: "auto", position: "relative", animation: "modalIn .22s cubic-bezier(0.175,0.885,0.32,1.275) both" }}>
            <button onClick={() => setHelpOpen(false)} aria-label="Close" style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%", background: C.line, border: "none", color: C.cream, fontSize: 18, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>×</button>
            <div style={{ padding: "24px 22px 22px" }}>
              <h2 style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: 22, color: C.cream, margin: "0 0 6px", letterSpacing: "-0.5px" }}>How to play</h2>
              <p style={{ fontSize: 13, color: C.creamDim, margin: "0 0 18px", lineHeight: 1.6 }}>Guess the daily image before it comes into focus.</p>
              <ol style={{ margin: 0, paddingLeft: 20, color: C.cream, fontSize: 14, lineHeight: 1.7 }}>
                <li style={{ marginBottom: 8 }}>A new <strong>pixelated image</strong> appears each day — blocky and hard to make out.</li>
                <li style={{ marginBottom: 8 }}>Type your guess and <strong>pick from the suggestions</strong>.</li>
                <li style={{ marginBottom: 8 }}>Every <strong>wrong guess sharpens</strong> the picture one step.</li>
                <li style={{ marginBottom: 8 }}>You get <strong>5 guesses</strong> — solve it before it&apos;s fully revealed.</li>
                <li><strong>Share</strong> your emoji result and keep your streak going.</li>
              </ol>
              <p style={{ fontSize: 12, color: C.creamDim, textAlign: "center", margin: "18px 0 0", letterSpacing: "0.3px" }}>🟩 correct &nbsp;·&nbsp; 🟥 wrong &nbsp;·&nbsp; ⬜ skipped</p>
              <button onClick={() => setHelpOpen(false)} className="pxbtn" style={{ marginTop: 20, width: "100%", background: C.blue, color: C.ink, border: "none", borderRadius: 9, padding: "12px 0", fontWeight: 700, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 15, cursor: "pointer" }}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {profileOpen && (
        <div onClick={() => setProfileOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, animation: "overlayIn .15s ease" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 16, width: "min(90vw, 380px)", maxHeight: "90vh", overflowY: "auto", position: "relative", animation: "modalIn .22s cubic-bezier(0.175,0.885,0.32,1.275) both" }}>
            <button onClick={() => setProfileOpen(false)} style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%", background: C.line, border: "none", color: C.cream, fontSize: 18, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>×</button>

            <div style={{ padding: "24px 20px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.line, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={C.creamDim}>
                    <circle cx="12" cy="7" r="5"/>
                    <path d="M3 21c0-5 4-8 9-8s9 3 9 8"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: 18, color: C.cream, margin: 0, letterSpacing: "-0.5px" }}>Guest</p>
                  <p style={{ fontSize: 11, color: C.creamDim, margin: 0, letterSpacing: "0.5px" }}>anonymous player</p>
                </div>
              </div>

              {playerStreak ? (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    {[
                      { label: "PLAYED",       value: playerStreak.played },
                      { label: "WIN %",        value: `${playerStreak.winPct}%` },
                      { label: "STREAK",       value: playerStreak.current },
                      { label: "BEST STREAK",  value: playerStreak.max },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ flex: 1, textAlign: "center", background: C.ink, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 4px" }}>
                        <div style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: 22, color: C.cream, lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 9, letterSpacing: "1px", color: C.creamDim, marginTop: 4 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: 10, letterSpacing: "2px", color: C.creamDim, margin: "0 0 10px", textAlign: "center" }}>YOUR GUESS DISTRIBUTION</p>
                  {(() => {
                    const counts = playerStreak.counts ?? {};
                    const total = playerStreak.played;
                    const maxCount = Math.max(...Object.values(counts), 1);
                    return [1, 2, 3, 4, 5, 6].map((n) => {
                      const count = counts[n] ?? 0;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      const barPct = Math.round((count / maxCount) * 100);
                      return (
                        <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ width: 14, textAlign: "right", fontSize: 13, color: C.creamDim, flexShrink: 0 }}>{n === 6 ? "X" : n}</span>
                          <div style={{ flex: 1, background: C.ink, borderRadius: 3, height: 22, overflow: "hidden" }}>
                            <div style={{
                              height: "100%",
                              width: count > 0 ? `${Math.max(barPct, 8)}%` : "4%",
                              background: n === 6 ? C.coral : C.blue,
                              borderRadius: 3,
                              display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 7,
                              transition: "width .5s ease",
                            }}>
                              {count > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{pct}%</span>}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </>
              ) : (
                <p style={{ textAlign: "center", color: C.creamDim, fontSize: 13 }}>Loading…</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Image canvas ── */}
      <div
        onClick={() => imgReady && setIsExpanded(true)}
        style={{
          position: "relative",
          padding: 8,
          background: C.ink2,
          borderRadius: 18,
          border: `1px solid ${C.line}`,
          boxShadow: canvasGlow,
          animation: shake ? "shk .38s ease" : "none",
          cursor: imgReady ? "zoom-in" : "default",
          transition: "box-shadow .4s ease",
        }}
      >
        <canvas ref={canvasRef} width={300} height={300} style={{ width: "var(--px-canvas)", height: "var(--px-canvas)", borderRadius: 12, display: "block", imageRendering: "pixelated" }} />

        {/* Resolution badge — theme-matched, sits in top-left of canvas */}
        <div style={{
          position: "absolute", top: 16, left: 16,
          background: C.ink2,
          border: `1px solid ${C.line}`,
          color: C.creamDim,
          fontSize: 11, padding: "3px 8px", borderRadius: 6, letterSpacing: "1px",
        }}>
          {!imgReady ? "LOADING…" : revealed ? "FULL RES" : `${res}×${res} PX`}
        </div>

        {/* Flash overlay — fades in and out when image sharpens to next resolution */}
        {flashing && (
          <div style={{
            position: "absolute",
            inset: 8,
            borderRadius: 12,
            background: "var(--flash)",
            animation: "flashFade .42s ease forwards",
            pointerEvents: "none",
          }} />
        )}

        {/* Zoom affordance — signals the image is tappable to enlarge.
            Essential on touch, where there is no hover cursor to hint it. */}
        {imgReady && (
          <div style={{
            position: "absolute", bottom: 16, right: 16,
            width: 28, height: 28, borderRadius: 7,
            background: C.ink2, border: `1px solid ${C.line}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: C.creamDim, pointerEvents: "none",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </div>
        )}
      </div>

      {/* ── Fullscreen modal ── */}
      {isExpanded && (
        <div onClick={() => setIsExpanded(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, animation: "overlayIn .15s ease" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", animation: "modalIn .2s ease both" }}>
            <canvas ref={modalCanvasRef} width={600} height={600} style={{ width: "min(88vw, 80vh)", height: "min(88vw, 80vh)", imageRendering: "pixelated", borderRadius: 16, display: "block" }} />
            <button onClick={() => setIsExpanded(false)} style={{ position: "absolute", top: -14, right: -14, width: 32, height: 32, borderRadius: "50%", background: C.ink2, border: `1px solid ${C.line}`, color: C.cream, fontSize: 20, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </div>
      )}

      {/* ── Sharpness meter — visualizes the core mechanic: the image
             resolves one step sharper with each miss. Ascending bars read
             as increasing clarity; the active step breathes. ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 7, height: 24, marginTop: "var(--px-meter-mt)" }}>
        <span style={{ alignSelf: "center", fontSize: 9, letterSpacing: "1.5px", color: C.creamDim, marginRight: 5 }}>
          {status === "won" ? "SOLVED" : status === "lost" ? "REVEALED" : "SHARPNESS"}
        </span>
        {RES_STEPS.map((_, i) => {
          const reached = revealed || i <= guessesMade;
          const isActive = !revealed && i === guessesMade;
          const fill = status === "won" ? C.green : status === "lost" ? C.coral : C.blue;
          return (
            <div
              key={i}
              style={{
                width: 20,
                height: 8 + i * 3, // 8,11,14,17,20 — ascending = sharper
                borderRadius: 3,
                background: reached ? fill : C.line,
                opacity: reached ? (isActive ? 1 : revealed ? 1 : 0.5) : 0.5,
                transformOrigin: "bottom",
                animation: isActive ? "sharpPulse 1.9s ease-in-out infinite" : "none",
                transition: "background .35s ease, opacity .35s ease",
              }}
            />
          );
        })}
      </div>

      {/* ── Guess rows ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--px-rows-gap)", margin: "var(--px-rows-m)", width: 316 }}>
        {rows.map((g, i) => {
          // The next empty row is where the current guess will land — give it
          // a brighter outline so the eye connects the input to its slot.
          const isNextRow = status === "playing" && !g && i === guessesMade;
          const borderColor = g ? (g.correct ? C.green : g.skipped ? C.blue : C.coral) : isNextRow ? C.creamDim : C.line;
          const bg = g ? (g.correct ? "rgba(70,196,106,.12)" : g.skipped ? "rgba(59,130,246,.08)" : "rgba(220,80,80,.10)") : "transparent";
          const icon = g ? (g.correct ? "✓" : g.skipped ? "→" : "✗") : i + 1;
          const iconColor = g ? (g.correct ? C.green : g.skipped ? C.blue : C.coral) : isNextRow ? C.creamDim : C.line;

          // Only play entrance animation once per row (tracked in a ref Set)
          const isNewRow = g && !animatedRowIndices.current.has(i);
          if (isNewRow) animatedRowIndices.current.add(i);

          return (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "var(--px-row-py) 12px", borderRadius: 9,
                border: `1px solid ${borderColor}`,
                background: bg,
                opacity: g ? 1 : isNextRow ? 0.85 : 0.4,
                animation: isNewRow ? "pop .32s cubic-bezier(0.175,0.885,0.32,1.275) both" : "none",
                transition: "border-color .2s ease, background .2s ease, opacity .2s ease",
              }}
            >
              <span style={{ color: iconColor, fontWeight: 700, width: 16 }}>{icon}</span>
              <span style={{ fontSize: 14, textTransform: "lowercase", color: g ? (g.skipped ? C.creamDim : C.cream) : C.line }}>
                {g ? (g.skipped ? "skipped" : g.text) : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Input or end-game ── */}
      {status === "playing" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--px-input-gap)", width: 316 }}>
          <div style={{ position: "relative" }}>
            <input
              ref={inputRef}
              // Labels the keyboard's return key "go" — a second way to guess
              // while the keyboard is covering the GUESS button.
              enterKeyHint="go"
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              onFocus={() => { setInputFocused(true); placeInputAboveKeyboard(); }}
              onBlur={() => { setInputFocused(false); setTimeout(() => setSuggestions([]), 150); }}
              placeholder="type your guess"
              disabled={isSubmitting}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{
                width: "100%",
                background: C.ink2,
                border: `1px solid ${inputFocused ? C.blue : C.line}`,
                borderRadius: 9,
                padding: "var(--px-input-py) 14px",
                color: C.cream,
                fontFamily: "var(--font-space-mono), monospace",
                // 16px is the magic number: iPhone browsers auto-zoom into any
                // text box smaller than 16px when you tap it, and the zoomed
                // page then slides left/right under your thumb.
                fontSize: 16,
                outline: "none",
                opacity: isSubmitting ? 0.6 : 1,
                boxShadow: inputFocused ? `0 0 0 3px rgba(${C.blueRGB}, .13)` : "none",
                transition: "border-color .15s ease, box-shadow .15s ease",
              }}
            />
            {suggestions.length > 0 && (
              <div role="listbox" className={dropUp ? "px-sugg-up" : undefined} style={{
                position: "absolute", left: 0, right: 0, zIndex: 10,
                // Opening upward sits the list over the guess rows instead of
                // under the keyboard (see placeSuggestions).
                ...(dropUp ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }),
                // Upward, the list is flipped so the best match sits right next
                // to the box, where your thumb already is.
                display: "flex", flexDirection: dropUp ? "column-reverse" : "column",
                background: C.ink2, border: `1px solid ${C.line}`,
                borderRadius: 9, overflow: "hidden",
                boxShadow: "0 6px 24px rgba(0,0,0,.12)",
                animation: `${dropUp ? "riseIn" : "dropIn"} .14s ease`,
                maxHeight: listMaxH, overflowY: "auto",
              }}>
                {suggestions.map((s) => (
                  <div
                    key={s}
                    role="option"
                    aria-selected={false}
                    className="px-suggestion"
                    // Cancelling the press stops the box losing focus before the
                    // tap lands. That used to race a 150ms timer that cleared the
                    // list, so on touch screens taps sometimes missed. The pick
                    // itself happens on click, so scrolling the list never selects.
                    onPointerDown={(e) => e.preventDefault()}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(s)}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
          {dictError && (
            <p style={{ margin: "0", fontSize: 12, color: C.coral, textAlign: "center", letterSpacing: "0.5px" }}>
              Not in the answer list — pick from the suggestions.
            </p>
          )}
          <button className="pxbtn" onClick={submit} disabled={isSubmitting}
            style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 9, padding: "var(--px-btn-py) 0", fontWeight: 700, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 20, cursor: isSubmitting ? "wait" : "pointer", width: "100%", opacity: isSubmitting ? 0.7 : 1 }}>
            {isSubmitting ? "…" : "GUESS"}
          </button>
          {/* SKIP is a costly concession — visually subordinate to GUESS */}
          <button className="pxbtn" onClick={skip}
            style={{ background: "transparent", color: C.coral, border: `1px solid ${C.line}`, borderRadius: 9, padding: "var(--px-skip-py) 0", fontWeight: 700, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 12, letterSpacing: "1.5px", cursor: "pointer" }}>
            SKIP
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center", width: 316 }}>
          {(() => {
            const { text, color } = status === "won"
              ? [
                  { text: "Absolutely unreal.", color: C.blue },
                  { text: "Sharp eye.",         color: C.green },
                  { text: "Solid.",             color: C.green },
                  { text: "Got there in the end.", color: C.cream },
                  { text: "That was close.",    color: C.creamDim },
                ][guesses.length - 1]
              : { text: "Better luck tomorrow.", color: C.coral };
            return (
              <p style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: 28, margin: "0 0 4px", color, letterSpacing: "-0.5px" }}>
                {text}
              </p>
            );
          })()}
          <p style={{ margin: "0 0 16px", fontSize: 14, color: C.creamDim }}>
            {revealedAnswer
              ? <>it was <b style={{ color: C.cream, textTransform: "uppercase" }}>{revealedAnswer}</b></>
              : "fetching answer…"}
          </p>
          <button className="pxbtn" onClick={shareGrid}
            style={{ background: copied ? C.green : C.blue, color: C.ink, border: "none", borderRadius: 9, padding: "12px 26px", fontWeight: 700, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 16, cursor: "pointer" }}>
            {/* Always "share" — that's the intent. Copying is just how it's done on a
    desktop, and the COPIED confirmation says so after the fact. */}
{copied ? "COPIED ✓" : "SHARE RESULT"}
          </button>
          {isYesterdaysPuzzle ? (
            <button className="pxbtn" onClick={switchToToday}
              style={{ marginTop: 20, background: C.cream, color: C.ink, border: "none", borderRadius: 9, padding: "14px 0", fontWeight: 800, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 16, cursor: "pointer", width: "100%" }}>
              Play today&apos;s puzzle →
            </button>
          ) : (
            <>
              {/* Finished today's and yesterday's is still going spare — let them
                  keep playing. Offered here even if they declined it before
                  today's game: "not now" is not "never", and the moment people
                  actually want more is right after a win. */}
              {yesterdayUnfinished && (
                <button className="pxbtn" onClick={switchToYesterday}
                  style={{ marginTop: 20, background: C.cream, color: C.ink, border: "none", borderRadius: 9, padding: "14px 0", fontWeight: 800, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 16, cursor: "pointer", width: "100%" }}>
                  {yesterdaySoFar > 0
                    ? `Resume yesterday's (${yesterdaySoFar}/${MAX_GUESSES}) →`
                    : "Play yesterday's puzzle →"}
                </button>
              )}
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <p style={{ fontSize: 10, color: C.creamDim, letterSpacing: "2px", margin: 0 }}>
                  NEXT PICXLE IN
                </p>
                <p style={{ fontFamily: "var(--font-space-mono), monospace", fontSize: 28, fontWeight: 700, color: C.cream, margin: 0, letterSpacing: "4px", lineHeight: 1 }}>
                  {countdown}
                </p>
              </div>
            </>
          )}

          {stats && (
            <button className="pxbtn" onClick={() => setStatsOpen(true)}
              style={{ marginTop: 16, background: "transparent", color: C.creamDim, border: `1px solid ${C.line}`, borderRadius: 9, padding: "14px 26px", fontWeight: 700, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 14, cursor: "pointer", width: "100%" }}>
              STATS
            </button>
          )}
        </div>
      )}
    </div>
  );
}
