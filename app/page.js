"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { track, getPlatform } from "@/lib/analytics";
import DailyReminder from "@/components/DailyReminder";
import { getThemeMode, nextThemeMode, applyThemeMode, themeGlyph, themeLabel } from "@/lib/theme";

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.penrose.picxle";

// Theme colours are CSS custom properties (globals.css) driven by data-theme
// on <html>. Every value here is a var() reference, so the markup is
// theme-agnostic — the correct theme paints on the first frame, no flash.
const C = {
  ink:      "var(--ink)",
  ink2:     "var(--ink2)",
  cream:    "var(--cream)",
  creamDim: "var(--creamDim)",
  amber:    "var(--blue)",
  green:    "var(--green)",
  line:     "var(--line)",
};

const STEPS = ["8px", "12px", "19px", "29px", "✓"];

export default function LandingPage() {
  // The pre-paint script in the root layout already applied the correct theme.
  // We mirror that into state here only so the toggle button reflects it.
  const [themeMode, setThemeMode] = useState("system");
  useEffect(() => {
    setThemeMode(getThemeMode());
    const onChange = () => setThemeMode(getThemeMode());
    window.addEventListener("picxle-themechange", onChange);
    return () => window.removeEventListener("picxle-themechange", onChange);
  }, []);

  // The Android app IS this site in a native shell, so a "get it on Google Play"
  // prompt would be telling people to install what they are already using. Show
  // it on the web only. Resolved after mount because getPlatform() reads window.
  const [isWeb, setIsWeb] = useState(false);
  useEffect(() => setIsWeb(getPlatform() === "web"), []);

  const cycleTheme = () => {
    const next = nextThemeMode(themeMode);
    applyThemeMode(next);
    setThemeMode(next);
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
        onClick={cycleTheme}
        title={`Theme: ${themeLabel(themeMode)} — tap to change`}
        aria-label={`Theme: ${themeLabel(themeMode)}. Tap to change.`}
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
        {themeGlyph(themeMode)}
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
                  ? `rgba(var(--green-rgb), .1)`
                  : `rgba(var(--cream-rgb), ${0.03 + i * 0.038})`,
                border: isWin
                  ? `1px solid rgba(var(--green-rgb), .33)`
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
      <Link href="/play" className="cta-link" onClick={() => track("play_clicked")} style={{
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

      {/* Google Play — secondary to the CTA above: the point of the page is still
          to get people playing, and the app is the same game. Web only. */}
      {isWeb && (
        <a
          href={PLAY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="cta-link"
          onClick={() => track("play_store_clicked", { from: "landing" })}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            marginTop: 12,
            padding: "13px 0",
            borderRadius: 10,
            background: "transparent",
            border: `1px solid ${C.line}`,
            color: C.creamDim,
            fontFamily: "var(--font-bricolage), sans-serif",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
            width: "100%",
            maxWidth: 300,
            letterSpacing: "-0.2px",
            animation: "fadeUp .35s .58s ease both",
          }}
        >
          {/* Play's four-way triangle, drawn inline so there's no external asset
              and no misuse of the official badge artwork. */}
          <svg width="15" height="16" viewBox="0 0 24 26" aria-hidden="true" focusable="false">
            <path d="M1.6.7 14.3 13 1.6 25.3A2.4 2.4 0 0 1 .8 23.5V2.5C.8 1.8 1.1 1.1 1.6.7Z" fill="var(--blue)" />
            <path d="M18.9 8.6 15.9 11.6 3.6 0 18.9 8.6Z" fill="var(--green)" />
            <path d="M18.9 17.4 3.6 26l12.3-11.6 3 3Z" fill="var(--coral, #dc5050)" />
            <path d="M22.9 11.4c1 .6 1 2 0 2.6l-3.4 1.9-3.3-3.3 3.3-3.3 3.4 2.1Z" fill="var(--creamDim)" />
          </svg>
          Get it on Google Play
        </a>
      )}

      {/* Daily reminder — renders only inside the installed app (native plugin
          present); invisible on the website and on builds before the plugin. */}
      <DailyReminder />

      {/* Footer links — required reachable pages (credits for image licences,
          privacy for the store listing). Kept quiet so they don't compete. */}
      <nav style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 14,
        marginTop: 36,
        maxWidth: 300,
        fontSize: 12,
        letterSpacing: "0.5px",
        animation: "fadeUp .35s .62s ease both",
      }}>
        <Link href="/credits" style={{ color: C.creamDim, textDecoration: "none" }}>Credits</Link>
        <span style={{ color: C.line }}>·</span>
        <Link href="/privacy" style={{ color: C.creamDim, textDecoration: "none" }}>Privacy</Link>
        <span style={{ color: C.line }}>·</span>
        <a href="https://play.google.com/store/apps/details?id=com.penrose.picxle"
           target="_blank" rel="noopener noreferrer"
           onClick={() => track("rate_clicked")}
           style={{ color: C.creamDim, textDecoration: "none" }}>Rate</a>
        <span style={{ color: C.line }}>·</span>
        <a href="mailto:picxlebypenrose@gmail.com?subject=Picxle%20feedback"
           onClick={() => track("feedback_clicked")}
           style={{ color: C.creamDim, textDecoration: "none" }}>Feedback</a>
      </nav>

    </div>
  );
}
