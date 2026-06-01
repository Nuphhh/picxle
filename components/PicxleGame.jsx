"use client";
// "use client" tells Next.js this component runs in the browser, not on the server.
// We need it because this component uses useState, useEffect, canvas, and other
// browser-only APIs that don't exist on the server.

import { useState, useEffect, useRef, useCallback } from "react";
import { PUZZLES, DICTIONARY, MAX_GUESSES, RES_STEPS, FULL_RES, LAUNCH_EPOCH_DAY, CATEGORY_HINTS } from "@/data/puzzles";

const C = {
  ink: "#17130d",     // warm near-black
  ink2: "#221b12",    // warm dark surface
  cream: "#f4ead7",   // warm off-white
  creamDim: "#cdbfa6",// warm dim text
  coral: "#d97706",   // amber-600 — SKIP, wrong rows, logo X
  green: "#46c46a",
  amber: "#60a5fa",   // blue-400 — GUESS, skipped rows, share button
  line: "#3a3024",    // warm brown border
};

// Strip everything except lowercase letters and spaces so "Mona Lisa" === "mona lisa"
const norm = (s) =>
  s.trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

// Puzzle index = days elapsed since launch date, wrapping around the pool.
// Everyone on the same UTC day gets the same puzzle.
const todayIdx = () => (Math.floor(Date.now() / 86400000) - LAUNCH_EPOCH_DAY) % PUZZLES.length;

export default function PicxleGame() {
  const [puzzleIdx, setPuzzleIdx] = useState(todayIdx);
  const puzzle = PUZZLES[puzzleIdx];

  const [guesses, setGuesses] = useState([]);   // { text: string, correct: boolean }[]
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState("playing"); // "playing" | "won" | "lost"
  const [shake, setShake] = useState(false);
  const [copied, setCopied] = useState(false);
  // imgReady flips to true once the image has loaded into the offscreen canvas.
  // We need this because image loading is async — the canvas can't draw until it arrives.
  const [imgReady, setImgReady] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);

  // srcRef holds an offscreen 440×440 canvas with the full-resolution source image.
  // We draw from it repeatedly at different resolutions to create the pixelation effect.
  const srcRef = useRef(null);
  const canvasRef = useRef(null);
  const modalCanvasRef = useRef(null);

  const guessesMade = guesses.length;
  const revealed = status !== "playing";
  const res = revealed
    ? FULL_RES
    : RES_STEPS[Math.min(guessesMade, RES_STEPS.length - 1)];

  // Reset everything when the user cycles to a different puzzle (testing only)
  useEffect(() => {
    setGuesses([]);
    setInput("");
    setSuggestions([]);
    setStatus("playing");
    setShake(false);
    setImgReady(false);
    setIsExpanded(false);
    setHintOpen(false);
    srcRef.current = null;
  }, [puzzleIdx]);

  // Load the puzzle image into an offscreen canvas.
  // We do this once per puzzle. The result is stored in srcRef so draw() can use it.
  useEffect(() => {
    const img = new Image();
    // crossOrigin = "anonymous" lets canvas read pixel data from external images
    // without the browser blocking it with a CORS error.
    img.crossOrigin = "anonymous";
    img.src = puzzle.src;

    img.onload = () => {
      const s = document.createElement("canvas");
      s.width = 440;
      s.height = 440;
      const ctx = s.getContext("2d");

      // Center-crop the image to a square, then scale it to fill 440×440.
      // A landscape photo loses top/bottom; a portrait loses left/right.
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, 440, 440);

      srcRef.current = s;
      setImgReady(true); // triggers the draw effect below
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

  // Render one pixelated frame to the visible canvas.
  // The trick: shrink the source down to a tiny `res × res` grid (e.g. 7×7),
  // then blow it back up to 300×300 with smoothing OFF — that creates the blocky look.
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    const src = srcRef.current;
    if (!cv || !src) return;

    const ctx = cv.getContext("2d");
    const tmp = document.createElement("canvas");
    tmp.width = res;
    tmp.height = res;
    const tctx = tmp.getContext("2d");

    tctx.imageSmoothingEnabled = true;        // smooth on the way down (looks better)
    tctx.drawImage(src, 0, 0, res, res);

    ctx.imageSmoothingEnabled = false;        // NO smoothing on the way up → hard pixels
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(tmp, 0, 0, res, res, 0, 0, cv.width, cv.height);
  }, [res]);

  // Re-draw whenever: the resolution changes (new guess), game ends, or image loads
  useEffect(() => {
    draw();
  }, [draw, status, imgReady]);

  // Draw the same pixelated frame onto the larger modal canvas when it opens
  useEffect(() => {
    if (!isExpanded) return;
    const cv = modalCanvasRef.current;
    const src = srcRef.current;
    if (!cv || !src) return;
    const ctx = cv.getContext("2d");
    const tmp = document.createElement("canvas");
    tmp.width = res;
    tmp.height = res;
    const tctx = tmp.getContext("2d");
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(src, 0, 0, res, res);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(tmp, 0, 0, res, res, 0, 0, cv.width, cv.height);
  }, [isExpanded, res, imgReady]);

  // Close any open modal on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { setIsExpanded(false); setHintOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    const q = norm(val);
    if (q.length < 2) { setSuggestions([]); return; }
    setSuggestions(DICTIONARY.filter((w) => w.includes(q)).slice(0, 6));
  };

  const selectSuggestion = (word) => {
    setInput(word);
    setSuggestions([]);
  };

  const submit = () => {
    if (status !== "playing") return;
    const g = norm(input);
    if (!g) return;

    const correct = puzzle.accepts.some((a) => norm(a) === g);
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

  // Skip costs a turn (advances the resolution) without requiring a typed guess.
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
    navigator.clipboard?.writeText(`Picxle ${score}\n${row}\nplay daily`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const rows = [];
  for (let i = 0; i < MAX_GUESSES; i++) rows.push(guesses[i] || null);

  return (
    <div
      style={{
        background: `radial-gradient(120% 90% at 50% 0%, ${C.ink2} 0%, ${C.ink} 60%)`,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "28px 18px 40px",
        // Use the CSS variables set by Next.js font loader in layout.js
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
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <h1
          style={{
            fontFamily: "var(--font-bricolage), sans-serif",
            fontWeight: 800,
            fontSize: 46,
            letterSpacing: "-1.5px",
            margin: 0,
            lineHeight: 1,
            color: C.cream,
          }}
        >
          PIC<span style={{ color: C.amber }}>X</span>LE
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: C.creamDim, letterSpacing: "1px" }}>
          GUESS THE IMAGE · IT SHARPENS AS YOU MISS
        </p>
        <button
          onClick={() => setHintOpen(true)}
          style={{
            display: "inline-block",
            marginTop: 10,
            padding: "3px 12px",
            borderRadius: 20,
            border: `1px solid ${C.line}`,
            background: "transparent",
            fontSize: 11,
            letterSpacing: "1.5px",
            color: C.creamDim,
            cursor: "pointer",
            transition: "border-color .15s, color .15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.creamDim; e.currentTarget.style.color = C.cream; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.creamDim; }}
        >
          {puzzle.category.toUpperCase()} ›
        </button>
      </div>

      {/* ── Category hint modal ── */}
      {hintOpen && (
        <div
          onClick={() => setHintOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.ink2,
              border: `1px solid ${C.line}`,
              borderRadius: 16,
              padding: "24px 20px",
              width: "min(90vw, 380px)",
              maxHeight: "75vh",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <button
              onClick={() => setHintOpen(false)}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: C.line,
                border: "none",
                color: C.cream,
                fontSize: 18,
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
            <p style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: 18, color: C.cream, marginBottom: 4 }}>
              {puzzle.category}
            </p>
            <p style={{ fontSize: 11, color: C.creamDim, letterSpacing: "0.5px", marginBottom: 16 }}>
              Today's image is one of these.
            </p>
            <div style={{ overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(CATEGORY_HINTS[puzzle.category] ?? []).map((item) => (
                <span
                  key={item}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 20,
                    border: `1px solid ${C.line}`,
                    fontSize: 12,
                    color: C.creamDim,
                  }}
                >
                  {item}
                </span>
              ))}
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
          boxShadow: "0 18px 40px -20px #000",
          animation: shake ? "shk .38s ease" : "none",
          cursor: imgReady ? "zoom-in" : "default",
        }}
      >
        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          style={{
            width: 300,
            height: 300,
            borderRadius: 12,
            display: "block",
            imageRendering: "pixelated",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: "rgba(0,0,0,.45)",
            color: C.cream,
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 6,
            letterSpacing: "1px",
          }}
        >
          {!imgReady ? "LOADING…" : revealed ? "FULL RES" : `${res}×${res} PX`}
        </div>
      </div>

      {/* ── Fullscreen modal ── */}
      {isExpanded && (
        <div
          onClick={() => setIsExpanded(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative" }}
          >
            <canvas
              ref={modalCanvasRef}
              width={600}
              height={600}
              style={{
                width: "min(88vw, 80vh)",
                height: "min(88vw, 80vh)",
                imageRendering: "pixelated",
                borderRadius: 16,
                display: "block",
              }}
            />
            <button
              onClick={() => setIsExpanded(false)}
              style={{
                position: "absolute",
                top: -14,
                right: -14,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: C.ink2,
                border: `1px solid ${C.line}`,
                color: C.cream,
                fontSize: 20,
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Guess rows ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, margin: "18px 0", width: 316 }}>
        {rows.map((g, i) => {
          const borderColor = g
            ? g.correct ? C.green : g.skipped ? C.amber : C.coral
            : C.line;
          const bg = g
            ? g.correct ? "rgba(70,196,106,.12)" : g.skipped ? "rgba(255,182,39,.08)" : "rgba(255,90,54,.10)"
            : "transparent";
          const icon = g
            ? g.correct ? "✓" : g.skipped ? "→" : "✗"
            : i + 1;
          const iconColor = g
            ? g.correct ? C.green : g.skipped ? C.amber : C.coral
            : C.line;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                borderRadius: 9,
                border: `1px solid ${borderColor}`,
                background: bg,
                animation: g ? "pop .25s ease" : "none",
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

      {/* ── Input or end-game panel ── */}
      {status === "playing" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 316 }}>
          {/* Input with autocomplete suggestions */}
          <div style={{ position: "relative" }}>
            <input
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              onBlur={() => setTimeout(() => setSuggestions([]), 150)}
              placeholder="type your guess"
              style={{
                width: "100%",
                background: C.ink2,
                border: `1px solid ${C.line}`,
                borderRadius: 9,
                padding: "12px 14px",
                color: C.cream,
                fontFamily: "var(--font-space-mono), monospace",
                fontSize: 15,
                outline: "none",
              }}
            />
            {suggestions.length > 0 && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                background: C.ink2,
                border: `1px solid ${C.line}`,
                borderRadius: 9,
                overflow: "hidden",
                zIndex: 10,
              }}>
                {suggestions.map((s) => (
                  <div
                    key={s}
                    onMouseDown={() => selectSuggestion(s)}
                    style={{
                      padding: "9px 14px",
                      fontSize: 13,
                      color: C.cream,
                      cursor: "pointer",
                      borderBottom: `1px solid ${C.line}`,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = C.line}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* GUESS — big, full-width, amber */}
          <button
            className="pxbtn"
            onClick={submit}
            style={{
              background: C.amber,
              color: C.ink,
              border: "none",
              borderRadius: 9,
              padding: "14px 0",
              fontWeight: 700,
              fontFamily: "var(--font-bricolage), sans-serif",
              fontSize: 20,
              cursor: "pointer",
              width: "100%",
            }}
          >
            GUESS
          </button>
          {/* SKIP — smaller, coral */}
          <button
            className="pxbtn"
            onClick={skip}
            style={{
              background: C.coral,
              color: C.ink,
              border: "none",
              borderRadius: 9,
              padding: "7px 0",
              fontWeight: 700,
              fontFamily: "var(--font-bricolage), sans-serif",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            SKIP
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center", width: 316 }}>
          <p
            style={{
              fontFamily: "var(--font-bricolage), sans-serif",
              fontWeight: 800,
              fontSize: 24,
              margin: "0 0 4px",
              color: status === "won" ? C.green : C.coral,
            }}
          >
            {status === "won" ? "NAILED IT" : "OUT OF GUESSES"}
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: C.creamDim }}>
            it was{" "}
            <b style={{ color: C.cream, textTransform: "uppercase" }}>{puzzle.answer}</b>
          </p>
          <button
            className="pxbtn"
            onClick={shareGrid}
            style={{
              background: copied ? C.green : C.amber,
              color: C.ink,
              border: "none",
              borderRadius: 9,
              padding: "12px 26px",
              fontWeight: 700,
              fontFamily: "var(--font-bricolage), sans-serif",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            {copied ? "COPIED ✓" : "SHARE RESULT"}
          </button>
        </div>
      )}

      {/* ── Phase 0 testing controls — remove before launch ── */}
      <div
        style={{
          marginTop: 32,
          borderTop: `1px solid ${C.line}`,
          paddingTop: 16,
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <button
          onClick={() => setPuzzleIdx((i) => (i - 1 + PUZZLES.length) % PUZZLES.length)}
          style={{
            background: C.line, color: C.creamDim, border: "none",
            borderRadius: 7, padding: "6px 14px", cursor: "pointer",
            fontFamily: "var(--font-space-mono), monospace", fontSize: 12,
          }}
        >
          ← prev
        </button>
        <span style={{ fontSize: 11, color: C.creamDim }}>
          puzzle {puzzleIdx + 1} / {PUZZLES.length}
        </span>
        <button
          onClick={() => setPuzzleIdx((i) => (i + 1) % PUZZLES.length)}
          style={{
            background: C.line, color: C.creamDim, border: "none",
            borderRadius: 7, padding: "6px 14px", cursor: "pointer",
            fontFamily: "var(--font-space-mono), monospace", fontSize: 12,
          }}
        >
          next →
        </button>
      </div>
    </div>
  );
}
