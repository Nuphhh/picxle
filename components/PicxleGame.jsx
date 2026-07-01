"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { DICTIONARY, ARTIST_MAP, MAX_GUESSES, RES_STEPS, FULL_RES, CATEGORY_HINTS } from "@/data/puzzles";
import { apiUrl } from "@/lib/api";
import { track } from "@/lib/analytics";
import Link from "next/link";
import { getThemeMode, nextThemeMode, applyThemeMode, themeGlyph, themeLabel } from "@/lib/theme";
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

const norm = (s) =>
  s.trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

function getPlayerId() {
  try {
    let id = localStorage.getItem("picxle-player-id");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("picxle-player-id", id); }
    return id;
  } catch { return null; }
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imgReady, setImgReady] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [hintOpen, setHintOpen] = useState(false);
  const [revealedAnswer, setRevealedAnswer] = useState(null);
  const [stats, setStats] = useState(null);
  const [playerStreak, setPlayerStreak] = useState(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dictError, setDictError] = useState(false);
  const [showMissedPrompt, setShowMissedPrompt] = useState(false);
  const [yesterdayPuzzle, setYesterdayPuzzle] = useState(null);

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

  useEffect(() => {
    Promise.all([
      fetch(apiUrl("/api/puzzle/today")).then((r) => r.json()),
      fetch(apiUrl("/api/puzzle/yesterday")).then((r) => r.json()).catch(() => ({ error: true })),
    ])
      .then(([todayData, yesterdayData]) => {
        if (todayData.error) { setPuzzleError(true); return; }
        const missedYesterday =
          yesterdayData &&
          !yesterdayData.error &&
          !localStorage.getItem(`picxle-${yesterdayData.id}`);
        if (missedYesterday) {
          setYesterdayPuzzle(yesterdayData);
          pendingTodayRef.current = todayData;
          setShowMissedPrompt(true);
        } else {
          activatePuzzle(todayData);
        }
      })
      .catch(() => setPuzzleError(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!puzzle) return;
    localStorage.setItem(`picxle-${puzzle.id}`, JSON.stringify({ guesses, status }));
  }, [puzzle, guesses, status]);

  useEffect(() => {
    if (status === "playing" || !puzzle) return;
    fetch(apiUrl(`/api/puzzle/reveal?puzzleId=${puzzle.id}`))
      .then((r) => r.json())
      .then((data) => setRevealedAnswer(data.answer ?? null))
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
    img.src = puzzle.image_src;
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
    const artistWorks = new Set();
    for (const [artist, works] of Object.entries(ARTIST_MAP)) {
      if (artist.includes(q)) works.forEach((w) => artistWorks.add(w));
    }
    const titleMatches = DICTIONARY.filter((w) => w.includes(q) && !artistWorks.has(w));
    setSuggestions([...artistWorks, ...titleMatches].slice(0, 6));
  };

  const selectSuggestion = (word) => {
    setInput(word);
    setSuggestions([]);
  };

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
    let correct = false;
    try {
      const res = await fetch(apiUrl("/api/guess"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.id, guess: g }),
      });
      ({ correct } = await res.json());
    } catch {}
    setIsSubmitting(false);
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

  const skip = () => {
    if (status !== "playing") return;
    setSuggestions([]);
    const next = [...guesses, { text: null, correct: false, skipped: true }];
    setGuesses(next);
    track("guess_skipped", { guess_number: next.length });
    if (next.length >= MAX_GUESSES) setStatus("lost");
  };

  const shareGrid = () => {
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
    navigator.clipboard?.writeText(`Picxle ${score}\n${row}\nhttps://picxle.vercel.app`);
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
            You missed yesterday&apos;s puzzle.
          </p>
          <p style={{ fontSize: 13, color: C.creamDim, lineHeight: 1.7, margin: "0 0 28px" }}>
            Want to play it now before today&apos;s?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="pxbtn" onClick={() => { setShowMissedPrompt(false); activatePuzzle(yesterdayPuzzle); }}
              style={{ background: C.cream, color: C.ink, border: "none", borderRadius: 9, padding: "14px 0", fontWeight: 800, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 16, cursor: "pointer", width: "100%" }}>
              Play yesterday&apos;s
            </button>
            <button className="pxbtn" onClick={() => { setShowMissedPrompt(false); activatePuzzle(pendingTodayRef.current); }}
              style={{ background: "transparent", color: C.creamDim, border: `1px solid ${C.line}`, borderRadius: 9, padding: "14px 0", fontWeight: 700, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 14, cursor: "pointer", width: "100%" }}>
              Skip to today&apos;s
            </button>
          </div>
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
        .px-suggestion { padding: 9px 14px; font-size: 13px; color: ${C.cream}; cursor: pointer; border-bottom: 1px solid ${C.line}; transition: background .1s ease; }
        .px-suggestion:hover { background: ${C.line}; }
        .px-suggestion:last-child { border-bottom: none; }
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
                <img src={puzzle.image_src} alt="today's puzzle" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>

              {revealedAnswer && (
                <p style={{ textAlign: "center", margin: "14px 20px 0", fontSize: 13, color: C.creamDim }}>
                  it was{" "}
                  <span style={{ color: C.cream, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
                    {revealedAnswer}
                  </span>
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
                  {copied ? "COPIED ✓" : "SHARE RESULT"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Profile modal ── */}
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
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              onFocus={() => setInputFocused(true)}
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
                fontSize: 15,
                outline: "none",
                opacity: isSubmitting ? 0.6 : 1,
                boxShadow: inputFocused ? `0 0 0 3px rgba(${C.blueRGB}, .13)` : "none",
                transition: "border-color .15s ease, box-shadow .15s ease",
              }}
            />
            {suggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                background: C.ink2, border: `1px solid ${C.line}`,
                borderRadius: 9, overflow: "hidden", zIndex: 10,
                animation: "dropIn .14s ease",
                maxHeight: 220, overflowY: "auto",
              }}>
                {suggestions.map((s) => (
                  <div key={s} className="px-suggestion" onMouseDown={() => selectSuggestion(s)}>{s}</div>
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
            {copied ? "COPIED ✓" : "SHARE RESULT"}
          </button>
          {isYesterdaysPuzzle ? (
            <button className="pxbtn" onClick={switchToToday}
              style={{ marginTop: 20, background: C.cream, color: C.ink, border: "none", borderRadius: 9, padding: "14px 0", fontWeight: 800, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 16, cursor: "pointer", width: "100%" }}>
              Play today&apos;s puzzle →
            </button>
          ) : (
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <p style={{ fontSize: 10, color: C.creamDim, letterSpacing: "2px", margin: 0 }}>
                NEXT PICXLE IN
              </p>
              <p style={{ fontFamily: "var(--font-space-mono), monospace", fontSize: 28, fontWeight: 700, color: C.cream, margin: 0, letterSpacing: "4px", lineHeight: 1 }}>
                {countdown}
              </p>
            </div>
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
