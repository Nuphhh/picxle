"use client";

import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";

const C = {
  ink:      "#17130d",
  ink2:     "#221b12",
  cream:    "#f4ead7",
  creamDim: "#cdbfa6",
  amber:    "#3b82f6",
  line:     "#3a3024",
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

export default function LandingPage() {
  const signInWithGoogle = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div style={{
      background: `radial-gradient(140% 100% at 50% 0%, ${C.ink2} 0%, ${C.ink} 55%)`,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      fontFamily: "var(--font-space-mono), monospace",
      color: C.cream,
    }}>

      {/* Logo */}
      <h1 style={{
        fontFamily: "var(--font-bricolage), sans-serif",
        fontWeight: 800,
        fontSize: "clamp(52px, 14vw, 96px)",
        letterSpacing: "-2px",
        margin: "0 0 8px",
        lineHeight: 1,
        color: C.cream,
      }}>
        PIC<span style={{ color: C.amber }}>X</span>LE
      </h1>

      {/* Tagline */}
      <p style={{ fontSize: "clamp(11px, 3vw, 13px)", letterSpacing: "2px", color: C.creamDim, margin: "0 0 40px", textAlign: "center" }}>
        GUESS THE IMAGE · IT SHARPENS AS YOU MISS
      </p>

      {/* Pixel art decorative strip */}
      <div style={{ display: "flex", gap: 4, marginBottom: 48 }}>
        {[7, 12, 20, 40, 999].map((res, i) => (
          <div key={i} style={{
            width: 44, height: 44, borderRadius: 6,
            background: `rgba(244,234,215,${0.03 + i * 0.04})`,
            border: `1px solid rgba(244,234,215,${0.06 + i * 0.05})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, color: C.creamDim, letterSpacing: "0.5px",
            fontFamily: "var(--font-space-mono), monospace",
          }}>
            {res === 999 ? "✓" : `${res}px`}
          </div>
        ))}
      </div>

      {/* How it works */}
      <p style={{ fontSize: 13, color: C.creamDim, maxWidth: 280, textAlign: "center", lineHeight: 1.7, margin: "0 0 40px" }}>
        One puzzle a day. Five guesses. Each wrong answer sharpens the image one step.
      </p>

      {/* CTAs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 300 }}>
        <button
          onClick={signInWithGoogle}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            background: C.cream, color: C.ink,
            border: "none", borderRadius: 10, padding: "14px 0",
            fontWeight: 700, fontFamily: "var(--font-bricolage), sans-serif",
            fontSize: 16, cursor: "pointer", width: "100%",
            transition: "opacity .15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
          onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
        >
          <GoogleIcon />
          Sign in with Google
        </button>

        <Link href="/play" style={{
          display: "block", textAlign: "center",
          padding: "14px 0", borderRadius: 10,
          border: `1px solid ${C.line}`, color: C.creamDim,
          fontFamily: "var(--font-bricolage), sans-serif",
          fontWeight: 700, fontSize: 16,
          textDecoration: "none",
          transition: "border-color .15s, color .15s",
        }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.creamDim; e.currentTarget.style.color = C.cream; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.creamDim; }}
        >
          Continue as guest
        </Link>
      </div>

      <p style={{ marginTop: 32, fontSize: 11, color: C.line, letterSpacing: "0.5px", textAlign: "center" }}>
        Sign in to save your streak across devices.
      </p>
    </div>
  );
}
