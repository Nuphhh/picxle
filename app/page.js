"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const DARK = {
  ink:      "#17130d",
  ink2:     "#221b12",
  cream:    "#f4ead7",
  creamDim: "#cdbfa6",
  amber:    "#3b82f6",
  green:    "#46c46a",
  line:     "#3a3024",
};

const LIGHT = {
  ink:      "#faf6ef",
  ink2:     "#ede8de",
  cream:    "#1c1208",
  creamDim: "#7a6548",
  amber:    "#3b82f6",
  green:    "#16a34a",
  line:     "#d4c4b0",
};

const STEPS = ["8px", "12px", "19px", "29px", "✓"];

export default function LandingPage() {
  // Fixed default so server and first client render match (no hydration
  // mismatch); the saved / system theme is applied right after mount.
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("picxle-theme");
      if (saved !== null) setIsDark(saved === "dark");
      else setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    } catch {}
  }, []);

  const C = isDark ? DARK : LIGHT;

  const toggleTheme = () => {
    setIsDark((d) => {
      try { localStorage.setItem("picxle-theme", d ? "light" : "dark"); } catch {}
      return !d;
    });
  };

  return (
    <div className="page-root" style={{
      background: `radial-gradient(140% 100% at 50% 0%, ${C.ink2} 0%, ${C.ink} 60%)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 24px 52px",
      fontFamily: "var(--font-space-mono), monospace",
      color: C.cream,
      position: "relative",
    }}>
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-14px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        .cta-link {
          transition: transform .15s ease, box-shadow .2s ease !important;
        }
        .cta-link:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 10px 28px -8px rgba(0,0,0,.25) !important;
        }
        .cta-link:active { transform: translateY(0) !important; }
        .lp-theme-btn {
          transition: border-color .15s ease, color .15s ease;
        }
        .lp-theme-btn:hover {
          border-color: ${C.creamDim} !important;
          color: ${C.cream} !important;
        }
      `}</style>

      {/* Theme toggle — tucked top-right, out of the content flow */}
      <button
        onClick={toggleTheme}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="lp-theme-btn"
        style={{
          position: "absolute", top: 20, right: 20,
          background: "transparent",
          border: `1px solid ${C.line}`,
          borderRadius: 20, padding: "4px 10px",
          fontSize: 14, cursor: "pointer",
          color: C.creamDim, lineHeight: 1,
        }}
      >
        {isDark ? "☀" : "☾"}
      </button>

      {/* Logo */}
      <h1 style={{
        fontFamily: "var(--font-bricolage), sans-serif",
        fontWeight: 800,
        fontSize: "clamp(52px, 14vw, 96px)",
        letterSpacing: "-2px",
        margin: "0 0 10px",
        lineHeight: 1,
        color: C.cream,
        animation: "slideDown .4s ease both",
      }}>
        PIC<span style={{ color: C.amber }}>X</span>LE
      </h1>

      {/* Tagline */}
      <p style={{
        fontSize: "clamp(11px, 3vw, 13px)",
        letterSpacing: "2px",
        color: C.creamDim,
        margin: "0 0 52px",
        textAlign: "center",
        animation: "fadeUp .38s .07s ease both",
      }}>
        GUESS THE IMAGE · IT SHARPENS AS YOU MISS
      </p>

      {/* Pixel steps — each box represents one resolution step.
          Progressively lighter opacity left→right, last box is green (win). */}
      <div style={{ display: "flex", gap: 5, marginBottom: 52, alignItems: "center" }}>
        {STEPS.map((label, i) => {
          const isWin = i === 4;
          return (
            <div
              key={i}
              style={{
                width: 46, height: 46,
                borderRadius: 8,
                background: isWin
                  ? `rgba(${isDark ? "70,196,106" : "22,163,74"},.1)`
                  : isDark
                  ? `rgba(244,234,215,${0.03 + i * 0.038})`
                  : `rgba(28,18,8,${0.03 + i * 0.038})`,
                border: isWin
                  ? `1px solid ${C.green}55`
                  : `1px solid ${C.line}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isWin ? 17 : 9,
                color: isWin ? C.green : C.creamDim,
                letterSpacing: "0.5px",
                fontWeight: isWin ? 700 : 400,
                animation: `fadeUp .35s ${0.14 + i * 0.06}s ease both`,
              }}
            >
              {label}
            </div>
          );
        })}
      </div>

      {/* Description — short enough to read in one glance */}
      <p style={{
        fontSize: 13,
        color: C.creamDim,
        maxWidth: 264,
        textAlign: "center",
        lineHeight: 1.85,
        margin: "0 0 44px",
        animation: "fadeUp .35s .46s ease both",
      }}>
        One image. Five guesses.<br />
        Each miss sharpens the picture one step closer to the answer.
      </p>

      {/* CTA */}
      <Link href="/play" className="cta-link" style={{
        display: "block",
        textAlign: "center",
        padding: "17px 0",
        borderRadius: 10,
        background: C.cream,
        color: C.ink,
        fontFamily: "var(--font-bricolage), sans-serif",
        fontWeight: 800,
        fontSize: 18,
        textDecoration: "none",
        width: "100%",
        maxWidth: 300,
        letterSpacing: "-0.5px",
        animation: "fadeUp .35s .54s ease both",
      }}>
        Play today&apos;s puzzle
      </Link>

    </div>
  );
}
