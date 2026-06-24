"use client";

import { useState, useEffect } from "react";
import { isAnalyticsOptedOut, setAnalyticsOptOut } from "@/lib/analytics";

// Theme-aware via globals.css: resolve to the right colour in light and dark.
const cream = "var(--cream)";
const dim = "var(--creamDim)";
const blue = "var(--blue)";
const line = "var(--line)";

export default function PrivacyPolicy() {
  // Read the saved opt-out state after mount (localStorage isn't available during
  // SSR). First render matches the server (opted-in) to avoid a hydration mismatch.
  const [optedOut, setOptedOut] = useState(false);
  useEffect(() => {
    setOptedOut(isAnalyticsOptedOut());
  }, []);
  const toggleAnalytics = () => {
    const next = !optedOut;
    setAnalyticsOptOut(next);
    setOptedOut(next);
  };

  return (
    <div style={{
      maxWidth: 680,
      margin: "0 auto",
      padding: "48px 24px 80px",
      fontFamily: "Georgia, serif",
      color: cream,
      lineHeight: 1.8,
      fontSize: 16,
    }}>
      <a href="/" style={{ fontFamily: "monospace", fontSize: 13, color: dim, textDecoration: "none", letterSpacing: "1px" }}>
        ← PICXLE
      </a>

      <h1 style={{ fontFamily: "sans-serif", fontWeight: 800, fontSize: 32, margin: "32px 0 4px", letterSpacing: "-1px", color: cream }}>
        Privacy Policy
      </h1>
      <p style={{ color: dim, fontSize: 14, margin: "0 0 40px" }}>Last updated: June 2026</p>

      <p>
        Picxle is a free daily image-guessing game. This policy explains what
        information the app collects and how it is used.
      </p>

      <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, margin: "40px 0 8px", color: cream }}>
        What we collect
      </h2>
      <p>
        Picxle does not collect your name, email address, location, or any
        other personally identifying information.
      </p>
      <p>
        When you first open the app, a random anonymous ID (a UUID) is generated
        and stored on your device. This ID is not linked to you as a person in
        any way. It is used only to track your personal game streak and
        statistics within the app.
      </p>
      <p>When you complete a puzzle, the following is recorded:</p>
      <ul style={{ paddingLeft: 24, color: cream }}>
        <li>Your anonymous ID</li>
        <li>The puzzle identifier for that day</li>
        <li>How many guesses you took</li>
      </ul>
      <p style={{ marginTop: 16 }}>
        Your in-progress guesses and theme preference are stored locally on your
        device only and are never sent anywhere.
      </p>
      <p style={{ marginTop: 16 }}>
        We also collect anonymous usage analytics to understand how the game is
        played — for example which puzzles are viewed, the guesses made in a
        puzzle, and when a result is shared. These events are linked only to your
        random anonymous ID and never include your name, email, or location.
      </p>

      <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, margin: "40px 0 8px", color: cream }}>
        How we use it
      </h2>
      <p>
        Your completion data powers your personal streak, win percentage and
        guess distribution, plus a difficulty rating shown to all players. The
        anonymous usage analytics help us see where the game is confusing or
        unfair so we can make it better. None of this is ever used for
        advertising, and it is never sold. We honour your browser&apos;s
        &ldquo;Do Not Track&rdquo; setting.
      </p>

      <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, margin: "40px 0 8px", color: cream }}>
        Your choices
      </h2>
      <p>
        You can turn anonymous analytics on or off on this device whenever you
        like. This never affects your gameplay, streak or stats.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
        <button
          onClick={toggleAnalytics}
          role="switch"
          aria-checked={!optedOut}
          aria-label="Analytics on or off"
          style={{
            position: "relative", width: 52, height: 30, flexShrink: 0,
            borderRadius: 999, border: "none", cursor: "pointer", padding: 0,
            background: optedOut ? line : blue, transition: "background .2s ease",
          }}
        >
          <span style={{
            position: "absolute", top: 3, left: optedOut ? 3 : 25,
            width: 24, height: 24, borderRadius: "50%", background: "#fff",
            transition: "left .2s ease", boxShadow: "0 1px 3px rgba(0,0,0,.3)",
          }} />
        </button>
        <span style={{ fontFamily: "sans-serif", fontWeight: 600, fontSize: 16, color: cream }}>
          Analytics {optedOut ? "off" : "on"}
        </span>
      </div>
      <p style={{ fontSize: 13, color: dim, marginTop: 8 }}>
        Saved on this device only. We also honour your browser&apos;s
        &ldquo;Do Not Track&rdquo; setting automatically.
      </p>

      <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, margin: "40px 0 8px", color: cream }}>
        Third-party services
      </h2>
      <p>Picxle uses the following third-party services to operate:</p>
      <ul style={{ paddingLeft: 24, color: cream }}>
        <li style={{ marginBottom: 8 }}>
          <strong>Supabase</strong> — stores puzzle data and anonymous completion
          records. Data may be stored in the EU or US.{" "}
          <a href="https://supabase.com/privacy" style={{ color: blue }}>Supabase Privacy Policy</a>
        </li>
        <li style={{ marginBottom: 8 }}>
          <strong>Vercel</strong> — hosts the app and handles web requests.
          Standard server access logs may be retained briefly by Vercel.{" "}
          <a href="https://vercel.com/legal/privacy-policy" style={{ color: blue }}>Vercel Privacy Policy</a>
        </li>
        <li>
          <strong>PostHog</strong> — privacy-focused product analytics, hosted in
          the EU. Receives the anonymous usage events described above, tied only
          to your random anonymous ID. We do not use session recording or
          advertising features.{" "}
          <a href="https://posthog.com/privacy" style={{ color: blue }}>PostHog Privacy Policy</a>
        </li>
      </ul>

      <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, margin: "40px 0 8px", color: cream }}>
        Children
      </h2>
      <p>
        Picxle does not knowingly collect any information from children under
        the age of 13.
      </p>

      <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, margin: "40px 0 8px", color: cream }}>
        Changes
      </h2>
      <p>
        If this policy changes, the updated version will be posted at this URL
        with a revised date.
      </p>

      <h2 style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: 20, margin: "40px 0 8px", color: cream }}>
        Contact
      </h2>
      <p>
        Questions about this policy can be sent to{" "}
        <a href="mailto:picxlebypenrose@gmail.com" style={{ color: blue }}>
          picxlebypenrose@gmail.com
        </a>
      </p>
    </div>
  );
}
