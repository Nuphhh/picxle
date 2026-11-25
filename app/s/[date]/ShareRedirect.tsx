"use client";

// Humans who tap a shared link land here briefly and get sent to the game.
// Crawlers (which read the server-rendered OG tags but don't run JS) just see
// the meta — so the redirect is client-side only, on purpose.
import { useEffect } from "react";

export default function ShareRedirect() {
  useEffect(() => {
    try { window.location.replace("/play"); } catch {}
  }, []);
  return (
    <div style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--ink)", color: "var(--creamDim)", fontFamily: "var(--font-space-mono), monospace", fontSize: 14 }}>
      Opening Picxle…
      <a href="/play" style={{ color: "var(--blue)", textDecoration: "none" }}>Play now</a>
    </div>
  );
}
