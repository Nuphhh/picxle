"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { DICTIONARY, ARTIST_MAP, MAX_GUESSES, RES_STEPS, FULL_RES, CATEGORY_HINTS } from "@/data/puzzles";

const DARK = {
  ink:      "#17130d",
  ink2:     "#221b12",
  cream:    "#f4ead7",
  creamDim: "#cdbfa6",
  coral:    "#e05252",
  green:    "#46c46a",
  blue:     "#3b82f6",
  line:     "#3a3024",
};

const LIGHT = {
  ink:      "#faf6ef",
  ink2:     "#ede8de",
  cream:    "#1c1208",
  creamDim: "#7a6548",
  coral:    "#c23b3b",
  green:    "#16a34a",
  blue:     "#3b82f6",
  line:     "#d4c4b0",
};

const norm = (s) =>
  s.trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

// Returns a stable anonymous UUID for this browser, creating one on first visit.
function getPlayerId() {
  try {
    let id = localStorage.getItem("picxle-player-id");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("picxle-player-id", id); }
    return id;
  } catch { return null; }
}

export default function PicxleGame() {
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem("picxle-theme");
      if (saved !== null) return saved === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {}
    return false;
  });
  const C = isDark ? DARK : LIGHT;

  // puzzle is fetched from /api/puzzle/today — it never contains the answer.
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
  // Fetched from /api/puzzle/reveal only after the game ends.
  const [revealedAnswer, setRevealedAnswer] = useState(null);
  const [stats, setStats] = useState(null);
  const [playerStreak, setPlayerStreak] = useState(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dictError, setDictError] = useState(false);
  const [showMissedPrompt, setShowMissedPrompt] = useState(false);
  const [yesterdayPuzzle, setYesterdayPuzzle] = useState(null);

  const srcRef = useRef(null);
  const canvasRef = useRef(null);
  const modalCanvasRef = useRef(null);
  // True when the page loads with a game already finished (refresh) — prevents
  // the stats modal auto-opening on revisit; it should only open on completion.
  const alreadyFinishedOnMount = useRef(false);
  // Holds today's puzzle data while the missed-yesterday prompt is shown
  const pendingTodayRef = useRef(null);

  const guessesMade = guesses.length;
  const revealed = status !== "playing";
  const res = revealed
    ? FULL_RES
    : RES_STEPS[Math.min(guessesMade, RES_STEPS.length - 1)];

  const isYesterdaysPuzzle = puzzle &&
    puzzle.puzzle_date !== new Date().toISOString().slice(0, 10);

  // Helper: activate a puzzle — restores saved progress and fetches difficulty stats
  const activatePuzzle = (data) => {
    setPuzzle(data);
    fetch(`/api/stats/today?puzzleId=${data.id}`).then((r) => r.json()).then((d) => setStats(d)).catch(() => {});
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

  // Switch to today's puzzle after finishing yesterday's — resets state then activates
  const switchToToday = () => {
    setGuesses([]);
    setStatus("playing");
    setRevealedAnswer(null);
    setStats(null);
    setPlayerStreak(null);
    alreadyFinishedOnMount.current = false;
    if (pendingTodayRef.current) {
      activatePuzzle(pendingTodayRef.current);
    } else {
      fetch("/api/puzzle/today")
        .then((r) => r.json())
        .then((data) => { if (!data.error) activatePuzzle(data); })
        .catch(() => {});
    }
  };

  // ── Fetch today + yesterday on mount; prompt if yesterday was missed ──
  useEffect(() => {
    Promise.all([
      fetch("/api/puzzle/today").then((r) => r.json()),
      fetch("/api/puzzle/yesterday").then((r) => r.json()).catch(() => ({ error: true })),
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

  // ── Persist progress whenever guesses or status change ──
  useEffect(() => {
    if (!puzzle) return;
    localStorage.setItem(`picxle-${puzzle.id}`, JSON.stringify({ guesses, status }));
  }, [puzzle, guesses, status]);

  // ── Fetch the answer once the game ends so we can show it ──
  useEffect(() => {
    if (status === "playing" || !puzzle) return;
    fetch(`/api/puzzle/reveal?puzzleId=${puzzle.id}`)
      .then((r) => r.json())
      .then((data) => setRevealedAnswer(data.answer ?? null))
      .catch(() => {});
  }, [status, puzzle]);

  // ── Record this play + fetch distribution once the game ends ──
  useEffect(() => {
    if (status === "playing" || !puzzle) return;

    const playerId = getPlayerId();

    const fetchStreak = () => {
      if (!playerId) return;
      fetch(`/api/stats/streak?playerId=${playerId}`)
        .then((r) => r.json())
        .then((data) => setPlayerStreak(data))
        .catch(() => {});
    };

    const fetchDistribution = () => {
      const openOnComplete = !alreadyFinishedOnMount.current;
      fetch(`/api/stats/today?puzzleId=${puzzle.id}`)
        .then((r) => r.json())
        .then((data) => { setStats(data); if (openOnComplete) setStatsOpen(true); })
        .catch(() => {});
    };

    const recordedKey = `picxle-recorded-${puzzle.id}`;
    if (!localStorage.getItem(recordedKey)) {
      // 1–5 = won on that guess, 6 = lost
      const guessesTaken = status === "won" ? guesses.length : 6;
      fetch("/api/stats/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.id, guessesTaken, playerId }),
      })
        .then(() => {
          localStorage.setItem(recordedKey, "1");
          // Fetch distribution and streak only after the record is confirmed in the DB
          fetchDistribution();
          fetchStreak();
        })
        .catch(() => {});
    } else {
      // Already recorded on a previous visit — fetch distribution and streak directly
      fetchDistribution();
      fetchStreak();
    }
  }, [status, puzzle]); // guesses.length is stable by the time status flips

  // ── Load the puzzle image into an offscreen 440×440 canvas ──
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
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, 440, 440);
      srcRef.current = s;
      setImgReady(true);
    };

    img.onerror = () => {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = C.ink2;
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = C.creamDim;
      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("image failed to load", cv.width / 2, cv.height / 2);
    };
  }, [puzzle]);

  // ── Pixelation draw ──
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    const src = srcRef.current;
    if (!cv || !src) return;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (res === FULL_RES) {
      // Draw the full 440×440 source directly with smoothing for a crisp result
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, 0, 0, cv.width, cv.height);
    } else {
      // Downsample to a tiny canvas then upscale without smoothing for the pixel effect
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

  // ── Modal canvas ──
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

  // ── Keyboard / body ──
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

  // Countdown to next puzzle — ticks every second once the game ends
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

  // ── Input ──
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    setDictError(false);
    const q = norm(val);
    if (q.length < 2) { setSuggestions([]); return; }

    // Collect works by any artist whose name contains the query
    const artistWorks = new Set();
    for (const [artist, works] of Object.entries(ARTIST_MAP)) {
      if (artist.includes(q)) works.forEach((w) => artistWorks.add(w));
    }

    // Artist matches first, then title matches (deduped), capped at 6
    const titleMatches = DICTIONARY.filter((w) => w.includes(q) && !artistWorks.has(w));
    setSuggestions([...artistWorks, ...titleMatches].slice(0, 6));
  };

  const selectSuggestion = (word) => {
    setInput(word);
    setSuggestions([]);
  };

  // ── Guess — now async, validated server-side ──
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
      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.id, guess: g }),
      });
      ({ correct } = await res.json());
    } catch {
      // Network error — treat as wrong guess rather than crashing
    }
    setIsSubmitting(false);

    const next = [...guesses, { text: input.trim(), correct, skipped: false }];
    setGuesses(next);
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
    if (next.length >= MAX_GUESSES) setStatus("lost");
  };

  const shareGrid = () => {
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

  // ── Loading / error states ──
  if (puzzleError) {
    return (
      <div style={{ background: C.ink, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.creamDim, fontFamily: "var(--font-space-mono), monospace", fontSize: 14 }}>
        No puzzle today — check back tomorrow.
      </div>
    );
  }

  // ── Missed yesterday prompt ──
  if (showMissedPrompt && yesterdayPuzzle) {
    return (
      <div className="page-root" style={{ background: `radial-gradient(140% 100% at 50% 0%, ${C.ink2} 0%, ${C.ink} 55%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", fontFamily: "var(--font-space-mono), monospace" }}>
        <style>{`.pxbtn{transition:transform .12s ease,background .15s ease}.pxbtn:hover{transform:translateY(-2px)}.pxbtn:active{transform:translateY(0)}`}</style>
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
            <button
              className="pxbtn"
              onClick={() => { setShowMissedPrompt(false); activatePuzzle(yesterdayPuzzle); }}
              style={{ background: C.cream, color: C.ink, border: "none", borderRadius: 9, padding: "14px 0", fontWeight: 800, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 16, cursor: "pointer", width: "100%" }}
            >
              Play yesterday&apos;s
            </button>
            <button
              className="pxbtn"
              onClick={() => { setShowMissedPrompt(false); activatePuzzle(pendingTodayRef.current); }}
              style={{ background: "transparent", color: C.creamDim, border: `1px solid ${C.line}`, borderRadius: 9, padding: "14px 0", fontWeight: 700, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 14, cursor: "pointer", width: "100%" }}
            >
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

  return (
    <div
      className="page-root"
      style={{
        background: `radial-gradient(120% 90% at 50% 0%, ${C.ink2} 0%, ${C.ink} 60%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "28px 18px 40px",
        fontFamily: "var(--font-space-mono), monospace",
        color: C.cream,
      }}
    >
      <style>{`
        @keyframes shk {
          0%,100% { transform: translateX(0) }
          20%      { transform: translateX(-7px) }
          40%      { transform: translateX(6px) }
          60%      { transform: translateX(-4px) }
          80%      { transform: translateX(3px) }
        }
        @keyframes pop {
          from { transform: scale(.9); opacity: 0 }
          to   { transform: scale(1);  opacity: 1 }
        }
        .pxbtn { transition: transform .12s ease, background .15s ease }
        .pxbtn:hover  { transform: translateY(-2px) }
        .pxbtn:active { transform: translateY(0) }
        input::placeholder { color: ${C.creamDim}; opacity: .7 }
      `}</style>

      {/* ── Header ── */}
      <div style={{ textAlign: "center", marginBottom: 18, position: "relative" }}>

        {/* Profile button — top left */}
        <button
          onClick={() => {
            setProfileOpen(true);
            if (!playerStreak) {
              const pid = getPlayerId();
              if (pid) fetch(`/api/stats/streak?playerId=${pid}`).then(r => r.json()).then(d => setPlayerStreak(d)).catch(() => {});
            }
          }}
          title="Your profile"
          style={{
            position: "absolute", top: 0, left: 0,
            background: "transparent", border: `1px solid ${C.line}`,
            borderRadius: 20, padding: "4px 10px", fontSize: 13,
            cursor: "pointer", color: C.creamDim, lineHeight: 1, display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="7" r="5"/>
            <path d="M3 21c0-5 4-8 9-8s9 3 9 8"/>
          </svg>
        </button>

        {/* Theme toggle — top right */}
        <button
          onClick={() => setIsDark((d) => {
          try { localStorage.setItem("picxle-theme", d ? "light" : "dark"); } catch {}
          return !d;
        })}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            position: "absolute", top: 0, right: 0,
            background: "transparent", border: `1px solid ${C.line}`,
            borderRadius: 20, padding: "4px 10px", fontSize: 14,
            cursor: "pointer", color: C.creamDim, lineHeight: 1,
          }}
        >
          {isDark ? "☀" : "☾"}
        </button>

        <h1 style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: 46, letterSpacing: "-1.5px", margin: 0, lineHeight: 1, color: C.cream }}>
          PIC<span style={{ color: C.blue }}>X</span>LE
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: C.creamDim, letterSpacing: "1px" }}>
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
        <div onClick={() => setHintOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 16, padding: "24px 20px", width: "min(90vw, 380px)", maxHeight: "75vh", display: "flex", flexDirection: "column", position: "relative" }}>
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
        <div onClick={() => setStatsOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          {/* outer: clips rounded corners + anchors the × button */}
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 16, width: "min(90vw, 380px)", position: "relative", overflow: "hidden" }}>
            <button onClick={() => setStatsOpen(false)} style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: "none", color: "#fff", fontSize: 18, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>×</button>

            {/* inner: scrollable so tall content doesn't overflow screen */}
            <div style={{ maxHeight: "90vh", overflowY: "auto" }}>

            {/* Full-res image — capped so it doesn't dominate on small phones */}
            <div style={{ width: "100%", height: "min(55vw, 220px)", overflow: "hidden" }}>
              <img src={puzzle.image_src} alt="today's puzzle" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>

            {/* Answer reveal */}
            {revealedAnswer && (
              <p style={{ textAlign: "center", margin: "14px 20px 0", fontSize: 13, color: C.creamDim }}>
                it was{" "}
                <span style={{ color: C.cream, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
                  {revealedAnswer}
                </span>
              </p>
            )}

            {/* Tiered result message */}
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
            {/* Personal stat boxes */}
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

            {/* Distribution bars */}
            <p style={{ fontSize: 10, letterSpacing: "2px", color: C.creamDim, margin: "0 0 10px", textAlign: "center" }}>GUESS DISTRIBUTION</p>
            {(() => {
              const maxCount = Math.max(...Object.values(stats.counts), 1);
              return [1, 2, 3, 4, 5, 6].map((n) => {
                const count = stats.counts[n] ?? 0;
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                const barPct = Math.round((count / maxCount) * 100);
                const isMe = (status === "won" && n === guesses.length) || (status === "lost" && n === 6);
                const barColor = isMe ? (status === "won" ? C.green : C.coral) : C.line;
                return (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 14, textAlign: "right", fontSize: 13, color: isMe ? C.cream : C.creamDim, fontWeight: isMe ? 700 : 400, flexShrink: 0 }}>
                      {n === 6 ? "X" : n}
                    </span>
                    <div style={{ flex: 1, background: C.ink, borderRadius: 3, height: 22, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: count > 0 ? `${Math.max(barPct, 8)}%` : "4%",
                        background: barColor,
                        borderRadius: 3,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        paddingRight: 7,
                        transition: "width .5s ease",
                      }}>
                        {count > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: isMe ? "#fff" : C.creamDim }}>{pct}%</span>}
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
            </div>{/* end padding wrapper */}
            </div>{/* end inner scroll */}
          </div>{/* end outer card */}
        </div>
      )}

      {/* ── Profile modal ── */}
      {profileOpen && (
        <div onClick={() => setProfileOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 16, width: "min(90vw, 380px)", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
            <button onClick={() => setProfileOpen(false)} style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%", background: C.line, border: "none", color: C.cream, fontSize: 18, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>×</button>

            <div style={{ padding: "24px 20px 20px" }}>
              {/* Name */}
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
                  {/* Stat boxes */}
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

                  {/* All-time guess distribution */}
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
        style={{ position: "relative", padding: 8, background: C.ink2, borderRadius: 18, border: `1px solid ${C.line}`, boxShadow: "0 18px 40px -20px #000", animation: shake ? "shk .38s ease" : "none", cursor: imgReady ? "zoom-in" : "default" }}
      >
        <canvas ref={canvasRef} width={300} height={300} style={{ width: 300, height: 300, borderRadius: 12, display: "block", imageRendering: "pixelated" }} />
        <div style={{ position: "absolute", top: 16, left: 16, background: "rgba(0,0,0,.45)", color: "#f4ead7", fontSize: 11, padding: "3px 8px", borderRadius: 6, letterSpacing: "1px" }}>
          {!imgReady ? "LOADING…" : revealed ? "FULL RES" : `${res}×${res} PX`}
        </div>
      </div>

      {/* ── Fullscreen modal ── */}
      {isExpanded && (
        <div onClick={() => setIsExpanded(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
            <canvas ref={modalCanvasRef} width={600} height={600} style={{ width: "min(88vw, 80vh)", height: "min(88vw, 80vh)", imageRendering: "pixelated", borderRadius: 16, display: "block" }} />
            <button onClick={() => setIsExpanded(false)} style={{ position: "absolute", top: -14, right: -14, width: 32, height: 32, borderRadius: "50%", background: C.ink2, border: `1px solid ${C.line}`, color: C.cream, fontSize: 20, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </div>
      )}

      {/* ── Guess rows ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, margin: "18px 0", width: 316 }}>
        {rows.map((g, i) => {
          const borderColor = g ? (g.correct ? C.green : g.skipped ? C.blue : C.coral) : C.line;
          const bg = g ? (g.correct ? "rgba(70,196,106,.12)" : g.skipped ? "rgba(59,130,246,.08)" : "rgba(220,80,80,.10)") : "transparent";
          const icon = g ? (g.correct ? "✓" : g.skipped ? "→" : "✗") : i + 1;
          const iconColor = g ? (g.correct ? C.green : g.skipped ? C.blue : C.coral) : C.line;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, border: `1px solid ${borderColor}`, background: bg, animation: g ? "pop .25s ease" : "none" }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 316 }}>
          <div style={{ position: "relative" }}>
            <input
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              onBlur={() => setTimeout(() => setSuggestions([]), 150)}
              placeholder="type your guess"
              disabled={isSubmitting}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{ width: "100%", background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 9, padding: "12px 14px", color: C.cream, fontFamily: "var(--font-space-mono), monospace", fontSize: 15, outline: "none", opacity: isSubmitting ? 0.6 : 1 }}
            />
            {suggestions.length > 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 9, overflow: "hidden", zIndex: 10 }}>
                {suggestions.map((s) => (
                  <div key={s} onMouseDown={() => selectSuggestion(s)}
                    style={{ padding: "9px 14px", fontSize: 13, color: C.cream, cursor: "pointer", borderBottom: `1px solid ${C.line}` }}
                    onMouseEnter={(e) => e.currentTarget.style.background = C.line}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >{s}</div>
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
            style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 9, padding: "14px 0", fontWeight: 700, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 20, cursor: isSubmitting ? "wait" : "pointer", width: "100%", opacity: isSubmitting ? 0.7 : 1 }}>
            {isSubmitting ? "…" : "GUESS"}
          </button>
          <button className="pxbtn" onClick={skip}
            style={{ background: C.coral, color: "#fff", border: "none", borderRadius: 9, padding: "13px 0", fontWeight: 700, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 13, cursor: "pointer" }}>
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
              <p style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: 24, margin: "0 0 4px", color }}>
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
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <p style={{ fontSize: 11, color: C.creamDim, letterSpacing: "1px", margin: 0 }}>
                NEXT PICXLE IN
              </p>
              <p style={{ fontFamily: "var(--font-space-mono), monospace", fontSize: 22, fontWeight: 700, color: C.cream, margin: 0, letterSpacing: "2px" }}>
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
